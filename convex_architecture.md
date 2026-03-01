# Convex Backend Architecture

## Why Convex

Convex solves three problems instantly:

| Problem | Without Convex | With Convex |
|---------|---------------|-------------|
| Real-time dashboard updates | WebSockets, Redis pub/sub, cache invalidation | `useQuery()` — auto-updates when data changes |
| Background job orchestration | Job queue, polling, state machines | `ctx.scheduler.runAfter()` + mutations |
| Multi-agent state coordination | Shared DB + locking + race conditions | Transactional mutations, consistency guaranteed |

When a BrowserUse agent updates a device's status, every connected dashboard client sees it in milliseconds. No WebSocket setup, no polling, no pub/sub.

---

## Architecture Overview

```
┌─────────────────────────┐   ┌──────────────────────────┐
│     React Dashboard     │   │    Unity OR Simulation   │
│  Room list, device      │   │  3D OR with robots that  │
│  cards, progress bar,   │   │  move/act according to   │
│  activity feed, env     │   │  device status in DB     │
│  (auto-update:useQuery) │   │  (polls GET /room-state  │
│                         │   │   every 0.5s)            │
└────────────┬────────────┘   └────────────┬─────────────┘
             │ useMutation / useQuery       │ HTTP GET
             ▼                              ▼
┌──────────────────────────────────────────────────────┐
│                   CONVEX BACKEND                     │
│                                                      │
│  Mutations ──▶ Scheduled Actions                     │
│                    │                                 │
│             Convex Database                          │
│   rooms · devices · commands                         │
│   actionLogs · environmentReadings                   │
│                    │                                 │
│  Reactive queries (auto-push to React clients)       │
│                                                      │
│  HTTP Endpoints:                                     │
│   POST /device-update  (status + action updates)     │
│   POST /field-update   (device field values)         │
│   GET  /room-state     (Unity polls this)            │
└──────────────────────────────────────────────────────┘
                         ▲
                         │ HTTP POST
          ┌──────────────┴──────────────┐
          │                             │
┌─────────┴──────────┐   ┌─────────────┴────────────┐
│  Mock Device WebUIs │   │ LOCAL PYTHON AGENT SERVER │
│  (built by WebUI    │   │                           │
│   teammate)         │   │ BrowserUse agents         │
│  POST /device-update│   │ (1 per device)            │
│  when user interacts│   │ Generated monitoring      │
│  with the UI        │   │ scripts POST              │
│                     │   │ /device-update and        │
│                     │   │ /field-update             │
└─────────────────────┘   └───────────────────────────┘
```

---

## Team Responsibilities & Integration

Four teammates, one shared backend:

| Teammate | Builds | Talks to Convex via |
|----------|--------|---------------------|
| **Convex (you)** | Schema, mutations, queries, HTTP endpoints, seed data | Direct — you own the backend |
| **WebUI** | Mock device dashboards (localhost:3001-3005) | `POST /device-update` and `POST /field-update` when user interacts with UI |
| **BrowserUse** | Agents that monitor/control webUIs, generate scripts | `POST /device-update` and `POST /field-update` from agents and generated scripts |
| **Unity** | 3D OR simulation with animated robots | `GET /room-state` polled every 0.5s to read current device states |

### Integration Flow

```
Mock WebUI (user clicks button) ──POST /device-update──▶ Convex DB
BrowserUse agent (reads DOM)    ──POST /field-update───▶ Convex DB
BrowserUse agent (takes action) ──POST /device-update──▶ Convex DB
React Dashboard                 ──useQuery()───────────▶ Convex DB (reactive, auto-updates)
Unity Simulation                ──GET /room-state──────▶ Convex DB (polls every 0.5s)
```

---

## Schema

### Design Principles

- **One `devices` table with a flexible `fields` object** — each device type has different fields, stored as `v.any()` rather than creating a separate table per device type
- **Room-level aggregation** — `rooms` table tracks overall readiness derived from device statuses
- **Hardcoded for demo, dynamic in production** — we know our mock webUI fields; in production, BrowserUse agents would infer and write field definitions dynamically
- **Environmental readings as a separate table** — time-series data for the decision layer, with a quick `allWithinRange` flag for fast status checks

### Schema Definition

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Rooms in the facility
  rooms: defineTable({
    name: v.string(),                            // "OR-3"
    status: v.union(
      v.literal("idle"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("in_use"),
      v.literal("needs_attention"),              // environmental values out of range
    ),
    procedure: v.optional(v.string()),           // "Knee Replacement" — affects environmental thresholds
    deviceCount: v.number(),
    devicesReady: v.number(),
    updatedAt: v.number(),
  }),

  // Each device/robot in the OR
  devices: defineTable({
    name: v.string(),                            // "UV Disinfection Robot"
    category: v.string(),                        // "disinfection", "environment", etc.
    roomId: v.id("rooms"),                       // which room this device belongs to
    url: v.string(),                             // webUI URL
    status: v.union(
      v.literal("idle"),
      v.literal("configuring"),
      v.literal("ready"),
      v.literal("error"),
    ),
    currentAction: v.optional(v.string()),       // "Clicking Verify Completion..."
    lastError: v.optional(v.string()),
    fields: v.any(),                             // device-specific data from the webUI
    fieldSchema: v.optional(v.any()),            // metadata: what fields exist, their types
                                                 // in production, auto-generated by BrowserUse
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_status", ["status"]),

  // User commands ("Prepare OR-3 for knee replacement")
  commands: defineTable({
    text: v.string(),
    roomId: v.id("rooms"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    deviceCount: v.number(),
    devicesReady: v.number(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    elapsedMs: v.optional(v.number()),
  })
    .index("by_room", ["roomId"]),

  // Per-step action log (activity feed)
  actionLogs: defineTable({
    deviceId: v.id("devices"),
    commandId: v.id("commands"),
    action: v.string(),                          // "Navigated to Control tab"
    result: v.union(
      v.literal("success"),
      v.literal("failure"),
      v.literal("in_progress"),
    ),
    timestamp: v.number(),
  })
    .index("by_device", ["deviceId"])
    .index("by_command", ["commandId"]),

  // Environmental readings (for the decision layer)
  environmentReadings: defineTable({
    roomId: v.id("rooms"),
    temperature: v.optional(v.number()),         // °C
    humidity: v.optional(v.number()),             // %
    bacterialConcentration: v.optional(v.number()), // CFU/m³
    co2: v.optional(v.number()),                 // ppm
    oxygen: v.optional(v.number()),              // %
    particulateCount: v.optional(v.number()),     // particles/m³
    pressureDifferential: v.optional(v.number()), // Pa
    allWithinRange: v.boolean(),                  // quick flag: everything OK?
    outOfRangeFields: v.optional(v.array(v.string())), // ["humidity", "co2"]
    timestamp: v.number(),
  })
    .index("by_room", ["roomId"]),
});
```

### Table Relationships

```
rooms (1)
  ├──▶ devices (many) — each device belongs to a room
  ├──▶ commands (many) — commands target a room
  └──▶ environmentReadings (many) — time-series environmental data

commands (1)
  └──▶ actionLogs (many) — per-step log entries

devices (1)
  └──▶ actionLogs (many) — per-step log entries
```

### The `fields` Column

Each device type has different webUI fields. Instead of separate tables, we store them in a flexible `fields` object on the device row. Examples of what `fields` would contain per device type:

**UV Disinfection Robot:**
`{ cycleStatus: "complete", cycleType: "full_room", uvIntensity: 342, exposureDuration: 1800 }`

**Environmental Sensors:**
`{ temperature: 21.5, humidity: 45, co2: 410, oxygen: 20.9, particulateCount: 12, pressureOk: true }`

**Sterilizer/Autoclave:**
`{ trayCount: 4, traysVerified: 4, allSterile: true, procedureType: "knee_replacement" }`

**Room Scheduling:**
`{ nextProcedure: "Knee Replacement", surgeon: "Dr. Smith", scheduledTime: "14:00", roomStatus: "turnover" }`

**Surveillance Cameras:**
`{ occupancy: "empty", lastMotion: 1709123000000, snapshotCaptured: true }`

The `fieldSchema` column stores metadata about what fields exist, their types, and valid ranges. For the demo this is hardcoded. In production, it would be auto-generated by the BrowserUse agent during its initial DOM read (Phase 1).

---

## Room Status Logic

Multiple rooms are shown on the dashboard. For the demo, only OR-3 is actively tracked — other rooms display as permanently "ready."

Room status transitions for the active room:

```
idle → preparing (command submitted, agents dispatched)
  → ready (all devices report ready AND environmental check passes)
  → needs_attention (environmental values out of range after robots finish)
  → preparing (corrective devices dispatched by decision layer)
  → ready (values now within range)
```

---

## Data Flow

### Command Execution Flow

1. User types: "Prepare OR-3 for knee replacement"
2. React calls `useMutation(api.commands.submit)`
3. Convex mutation: inserts command, sets all devices to "configuring", schedules one action per device
4. Each Convex action POSTs to local Python agent server (localhost:8000)
5. Python server spawns one BrowserUse agent per device (parallel)
6. Agents navigate webUIs, perform actions, report progress via HTTP POST to Convex
7. Convex mutations update DB → dashboard auto-re-renders
8. When all devices report "ready" → room status changes to "ready"

### Monitoring Flow (Continuous)

1. BrowserUse agent reads the webUI DOM once (Phase 1 — LLM, expensive)
2. Agent generates a lightweight monitoring script
3. Script runs continuously, POSTs field changes to `/field-update` (Phase 2 — no LLM, cheap)
4. If DOM structure changes, script wakes the agent to re-read (Phase 3 → back to Phase 1)

---

## HTTP Endpoints

Three endpoints. That's it.

### POST `/device-update`

Called by both mock webUIs (when user interacts) and BrowserUse agents (when agent takes action). Same endpoint, doesn't matter who calls it.

Request body:
- `deviceId` (string) — Convex device ID
- `status` (string) — "idle" | "configuring" | "ready" | "error"
- `currentAction` (string, optional) — "Clicking Verify Completion..."
- `lastError` (string, optional) — error message if status is "error"

Triggers: device status mutation → room aggregation check → auto-push to React dashboard.

### POST `/field-update`

Called by BrowserUse monitoring scripts (Phase 2 generated scripts) and mock webUIs to push device-specific field values.

Request body:
- `deviceId` (string) — Convex device ID
- `fields` (object) — partial update, merged into existing fields, e.g. `{ temperature: 22.1, humidity: 44 }`

Triggers: device fields mutation → auto-push to React dashboard and reflected on next Unity poll.

### GET `/room-state`

Called by Unity simulation every 0.5 seconds. Returns everything Unity needs in one response.

Query params:
- `roomId` (string) — Convex room ID

Response:
- Room name, status, procedure
- Array of all devices with their status, currentAction, and fields
- Latest environmental readings

This is the only GET endpoint. Everything else is POST.

---

## What Convex Gives Us for Free

| Feature | Without Convex | With Convex |
|---------|---------------|-------------|
| Real-time dashboard | WebSocket server + Redis + reconnection | `useQuery()` |
| Job orchestration | Celery/Bull + workers + retries | `ctx.scheduler.runAfter()` |
| Webhook ingestion | Express server + deploy + SSL | `http.route()` auto-deployed |
| TypeScript types | Manual maintenance | Auto-generated from schema |
| Deployment | Docker + CI/CD + DB provisioning | `npx convex dev` |
