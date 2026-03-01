# API Contract — Convex HTTP Endpoints

Base URL: `https://impartial-whale-32.convex.site`

All responses are JSON with `Access-Control-Allow-Origin: *`.

---

## POST `/device-update`

Update a device's status (and trigger room aggregation).

**Request:**
```json
{
  "deviceId": "<Id<devices>>",
  "status": "idle" | "configuring" | "ready" | "error",
  "currentAction": "(optional) string",
  "lastError": "(optional) string"
}
```

**Response (200):**
```json
{ "ok": true }
```

**Side effects:**
- Patches the device row
- Recounts ready/error devices in the room
- If all devices ready → room status = `"ready"`
- If any device error → room status = `"needs_attention"`
- If a running command exists: updates `devicesReady`; if all ready → command `"completed"` with `elapsedMs`

---

## POST `/field-update`

Shallow-merge fields into a device's `fields` object.

**Request:**
```json
{
  "deviceId": "<Id<devices>>",
  "fields": { "temperature": 22.5, "humidity": 45, ... }
}
```

**Response (200):**
```json
{ "ok": true }
```

---

## GET `/room-state?roomId=<Id<rooms>>`

Get full room state including devices and environment readings.

**Response (200):**
```json
{
  "room": {
    "_id": "jn7bw19xt7a818kvh3w5dhxvvd823j8a",
    "name": "OR-3",
    "status": "idle",
    "deviceCount": 4,
    "devicesReady": 0,
    "updatedAt": 1772340463471
  },
  "devices": [
    {
      "_id": "jd71dxprgfe2c1m191bt6a79g98225x2",
      "name": "UV Robot",
      "category": "sterilization",
      "status": "idle",
      "fields": { "..." : "..." }
    },
    {
      "_id": "jd70sm9tht7kq7p0t20n22ptrn822tn5",
      "name": "TUG Fleet Monitor",
      "category": "transport",
      "status": "idle",
      "fields": { "..." : "..." }
    },
    {
      "_id": "jd79481zr4jt3pggjebcf7y2nn823cp5",
      "name": "Environmental Monitoring",
      "category": "monitoring",
      "status": "idle",
      "fields": { "co2": 750, "particulate": 95, "..." : "..." }
    },
    {
      "_id": "jd7d79sep5x1q0hmetevhmcnbx8231js",
      "name": "Room Scheduling",
      "category": "scheduling",
      "status": "idle",
      "fields": { "selectedRoom": "OR-3", "..." : "..." }
    }
  ],
  "environmentReadings": []
}
```

---

## POST `/trigger-anomaly`

Trigger an anomaly scenario on a room's devices for demo purposes.

**Request:**
```json
{
  "roomId": "<Id<rooms>>",
  "scenario": "ventilation_failure" | "battery_failure" | "co2_spike"
}
```

**Scenarios:**

| Scenario | Target Device | Effects |
|----------|--------------|---------|
| `ventilation_failure` | Environmental Monitoring | CO2→1200, particulate→150, temp+3°F, device status→error, room→needs_attention, inserts environmentReadings record |
| `battery_failure` | UV Robot | battery→15%, health→Critical, cycleMode→Aborted, device status→error, room→needs_attention |
| `co2_spike` | Environmental Monitoring | CO2→1050, device status→error, room→needs_attention |

**Response (200):**
```json
{ "ok": true, "scenario": "ventilation_failure", "triggeredAt": 1772345678901 }
```

**Errors:**
- `400` — missing `roomId` or `scenario`, or invalid scenario value
- `500` — target device not found in room

---

## POST `/action-log`

Post an agent action log entry (with optional chain-of-thought reasoning).

**Request:**
```json
{
  "deviceId": "<Id<devices>>",
  "commandId": "<Id<commands>>",
  "action": "string — what the agent did",
  "result": "success" | "failure" | "in_progress",
  "reasoning": "(optional) string — agent's chain-of-thought"
}
```

**Response (200):**
```json
{ "ok": true, "logId": "<Id<actionLogs>>" }
```

**Errors:**
- `400` — missing `deviceId`, `commandId`, `action`, or `result`; or invalid `result` value
- `500` — device or command ID not found

---

---

# Agent Coordination Endpoints

## POST `/agent-claim`

Acquire a resource lock (device or room). Idempotent if same agent re-claims. Blocked if held by another agent. Lazy TTL expiry on stale locks.

**Request:**
```json
{
  "agentId": "env-agent",
  "resourceType": "room" | "device",
  "resourceId": "<Id<devices>> or <Id<rooms>>",
  "action": "Assessing anomaly readings",
  "ttlMs": 300000  // optional, default 5 min
}
```

**Response (200) — granted:**
```json
{ "ok": true, "lockId": "<Id<resourceLocks>>" }
```

**Response (200) — idempotent re-claim:**
```json
{ "ok": true, "lockId": "<Id<resourceLocks>>", "idempotent": true }
```

**Response (200) — blocked:**
```json
{ "ok": false, "error": "resource_locked", "heldBy": "other-agent", "lockId": "..." }
```

**Errors:** `400` — missing required fields or invalid resourceType

---

## POST `/agent-release`

Release a resource lock. Only the owning agent can release.

**Request:**
```json
{
  "agentId": "env-agent",
  "resourceId": "<Id<devices>> or <Id<rooms>>"
}
```

**Response (200):**
```json
{ "ok": true }
```

**Response (200) — not owner:**
```json
{ "ok": false, "error": "not_owner", "heldBy": "other-agent" }
```

**Errors:** `400` — missing required fields

---

## POST `/agent-message`

Post a message to the agent communication bus. Defaults to broadcast if `toAgent` omitted.

**Request:**
```json
{
  "fromAgent": "env-agent",
  "toAgent": "tug-agent",          // optional, defaults to "broadcast"
  "type": "intent" | "claim" | "release" | "request" | "response" | "alert" | "heartbeat",
  "payload": { ... },              // any JSON
  "roomId": "<Id<rooms>>"
}
```

**Response (200):**
```json
{ "ok": true, "messageId": "<Id<agentMessages>>" }
```

**Errors:** `400` — missing required fields or invalid type

---

## GET `/agent-messages?agentId=X&roomId=Y&since=Z&limit=N`

Poll messages for a specific agent (returns broadcast + directed messages).

**Query params:**
- `agentId` (required) — agent to filter for
- `roomId` (required) — room scope
- `since` (optional) — timestamp in ms, only return messages after this time
- `limit` (optional) — max messages to return (default 50)

**Response (200):**
```json
{ "messages": [ { "fromAgent": "...", "toAgent": "...", "type": "...", "payload": {}, "timestamp": 123 }, ... ] }
```

---

## POST `/agent-task-update`

Update a task's status in the task graph. Validates state transitions (ready→running→completed/failed). On completion, auto-promotes downstream tasks whose dependencies are all met. When all tasks complete, auto-resolves the anomaly.

**Request:**
```json
{
  "taskId": "<Id<taskGraph>>",
  "status": "running" | "completed" | "failed",
  "output": { ... }  // optional, recorded on completion
}
```

**Response (200):**
```json
{ "ok": true, "unblockedTasks": ["<taskId>", ...], "allDone": false }
```

**State transitions:**
- `ready` → `running`
- `running` → `completed` | `failed`
- Other transitions → error

**Side effects on completion:**
- Promotes dependent pending tasks to "ready" if all their deps are met
- If ALL tasks in command are completed → auto-calls `resolveAnomaly` to restore safe readings and room to "ready"

**Errors:** `400` — missing fields or invalid status; `500` — invalid state transition

---

## GET `/agent-next-task?agentId=X&commandId=Y`

Poll for the next runnable task for an agent. Used by agent orchestrators to discover when their task is ready.

**Query params:**
- `agentId` (required) — agent identifier
- `commandId` (required) — coordination command ID

**Response (200) — task ready:**
```json
{ "task": { "_id": "...", "taskName": "...", "status": "ready", "input": { "instructions": "...", "deviceId": "...", ... } }, "waiting": false }
```

**Response (200) — waiting (blocked):**
```json
{ "task": null, "waiting": true, "blockedBy": [{ "taskId": "...", "taskName": "...", "agentId": "env-agent", "status": "running" }] }
```

**Response (200) — all done:**
```json
{ "task": null, "waiting": false, "allDone": true }
```

---

## POST `/coordination-start`

Initialize a coordination scenario, creating the full task dependency graph.

**Request:**
```json
{
  "commandId": "unique-command-id",
  "roomId": "<Id<rooms>>",
  "scenario": "emergency_air_quality_response"  // optional, defaults to this
}
```

**Response (200):**
```json
{
  "ok": true,
  "commandId": "...",
  "tasks": { "env": "<taskId>", "tug": "<taskId>", "uv": "<taskId>", "ehr": "<taskId>" },
  "taskCount": 4
}
```

**Scenario: `emergency_air_quality_response`** creates 4 tasks:
1. **ENV Detect & Assess** (phase 1, no deps → ready)
2. **TUG Emergency Supply Delivery** (phase 2, depends on ENV → pending)
3. **UV Sterilization Cycle** (phase 3, depends on TUG → pending)
4. **EHR Confirm Room Ready** (phase 4, depends on UV → pending)

Each task's `input` includes `deviceId`, `deviceUrl`, `instructions` (natural language for BrowserUse), and `expectedOutput` hints.

**Errors:** `400` — missing fields or invalid scenario; `500` — required devices not found in room

---

## POST `/coordination-reset`

Clear all coordination data (agentMessages, resourceLocks, taskGraph tables).

**Request:** `{}` (empty body)

**Response (200):**
```json
{ "ok": true, "deleted": 15 }
```

---

## GET `/coordination-state?roomId=X`

Full coordination state for Unity 3D visualization polling. Returns current scenario progress, active agent/phase, locks, messages, and completion status.

**Query params:**
- `roomId` (required) — room to get coordination state for

**Response (200):**
```json
{
  "activeScenario": "emergency_air_quality_response" | null,
  "commandId": "...",
  "currentPhase": 2,
  "activeAgent": "tug-agent",
  "activeTask": { "taskName": "TUG Emergency Supply Delivery", "status": "running", "phase": 2 },
  "locks": [{ "agentId": "tug-agent", "resourceType": "device", "action": "Delivering HEPA filters" }],
  "tasks": [
    { "taskId": "...", "taskName": "ENV Detect & Assess Anomaly", "phase": 1, "status": "completed", "agentId": "env-agent" },
    { "taskId": "...", "taskName": "TUG Emergency Supply Delivery", "phase": 2, "status": "running", "agentId": "tug-agent" },
    { "taskId": "...", "taskName": "UV Sterilization Cycle", "phase": 3, "status": "pending", "agentId": "uv-agent" },
    { "taskId": "...", "taskName": "EHR Confirm Room Ready", "phase": 4, "status": "pending", "agentId": "ehr-agent" }
  ],
  "recentMessages": [ ... ],
  "progress": { "total": 4, "completed": 1, "running": 1, "pending": 2, "failed": 0 },
  "allDone": false
}
```

**Unity animation mapping:**
- Phase 1 (env-agent running): sensor scan animation
- Phase 2 (tug-agent running): TUG bot drives into OR-3
- Phase 3 (uv-agent running): UV lamp powers on + cycling
- Phase 4 (ehr-agent running): screen update animation
- `allDone=true`: green "READY" state

---

## POST `/resolve-anomaly`

Manually restore safe environmental readings and reset room to ready. Called automatically when all coordination tasks complete, but also available for manual reset.

**Request:**
```json
{
  "roomId": "<Id<rooms>>"
}
```

**Response (200):**
```json
{ "ok": true, "resolvedAt": 1772345678901 }
```

**Side effects:**
- Environmental Monitoring: CO2→450, particulate→25, temp→70.2, humidity→45, pressure→0.05, allWithinRange→true, riskLevel→normal
- All devices in room → status "idle"
- Room → status "ready"
- Inserts clean environmentReadings record

**Errors:** `400` — missing roomId

---

## Seed Data IDs

### Rooms

| Room | ID | Status | Devices |
|------|----|--------|---------|
| OR-1 | `jn77dth55k7d2600v9hx3dbk4s822646` | ready | 3 |
| OR-2 | `jn78nfx1s528tz8cknq4c8g44d823yvv` | ready | 2 |
| OR-3 | `jn7bw19xt7a818kvh3w5dhxvvd823j8a` | idle | 4 |
| OR-4 | `jn7caae78h5qg7pthmzav3yx4n8224ee` | ready | 4 |

### Devices (OR-3)

| Device | ID | Category | URL |
|--------|----|----------|-----|
| UV Robot | `jd71dxprgfe2c1m191bt6a79g98225x2` | sterilization | localhost:3000/uv-robot |
| TUG Fleet Monitor | `jd70sm9tht7kq7p0t20n22ptrn822tn5` | transport | localhost:3000/tug-robot |
| Environmental Monitoring | `jd79481zr4jt3pggjebcf7y2nn823cp5` | monitoring | localhost:3000/environmental |
| Room Scheduling | `jd7d79sep5x1q0hmetevhmcnbx8231js` | scheduling | localhost:3000/ehr |

---

## Public Query: `getRoomStatePublic`

A public Convex query that returns the same data as the `GET /room-state` HTTP endpoint. Use this from the frontend via Convex React hooks for real-time subscriptions instead of polling the HTTP endpoint.

**Module:** `convex/roomQueries.ts`
**API path:** `api.roomQueries.getRoomStatePublic`

**Args:**
```ts
{ roomId: Id<"rooms"> }
```

**Returns:**
```ts
{
  room: Doc<"rooms">,
  devices: Doc<"devices">[],
  environmentReadings: Doc<"environmentReadings">[]   // latest 10, descending
}
```

**Usage (React):**
```tsx
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const state = useQuery(api.roomQueries.getRoomStatePublic, {
  roomId: "jn7bw19xt7a818kvh3w5dhxvvd823j8a",  // OR-3
});
```

> **Note:** `getRoomState` (internal query) is identical but restricted to server-side use only. Use `getRoomStatePublic` from the client.

---

---

# Next.js API Routes

## POST `/api/orchestrate`

SSE streaming orchestrator for the full 4-agent emergency response scenario. Triggers anomaly, creates task graph, launches BrowserUse agents sequentially for each phase, and streams progress events.

**Request:**
```json
{
  "roomId": "<Id<rooms>>",
  "scenario": "ventilation_failure"  // which anomaly to trigger (default: ventilation_failure)
}
```

**Response:** SSE stream (`text/event-stream`)

Each SSE event is a JSON object on a `data:` line. Event types:

| Event | Fields | When |
|-------|--------|------|
| `scenario_start` | `commandId`, `roomId`, `tasks`, `taskCount` | Task graph created |
| `anomaly_triggered` | `scenario` | Anomaly triggered on room |
| `phase_start` | `phase`, `agentId`, `taskName` | Agent's task becomes ready |
| `agent_start` | `phase`, `sessionId`, `liveUrl` | BrowserUse session launched |
| `agent_status` | `phase`, `status` | BrowserUse status change |
| `phase_complete` | `phase`, `agentId`, `output`, `cost` | Agent finished successfully |
| `phase_error` | `phase`, `agentId`, `error` | Agent failed |
| `scenario_complete` | `commandId`, `totalCost`, `elapsedMs`, `allDone`, `failed` | All phases done |
| `error` | `message` | Fatal error |

**Phase order:** ENV (1) → TUG (2) → UV (3) → EHR (4)

**Side effects:**
- Triggers anomaly on room devices
- Creates coordination task graph (4 tasks with dependencies)
- Claims/releases device locks for each agent
- Launches BrowserUse sessions (bu-mini model)
- Posts agent messages to coordination bus
- Auto-resolves anomaly when all 4 tasks complete

**Cost:** ~$0.05–0.15 per run (4 bu-mini BrowserUse sessions)

**Errors:**
- `400` — missing `roomId`
- `500` — `BROWSER_USE_API_KEY` not set

---

## Convex Client Queries (React Dashboard)

| Function | Type | Args |
|----------|------|------|
| `api.rooms.list` | query | none |
| `api.rooms.get` | query | `{ roomId }` |
| `api.devices.listByRoom` | query | `{ roomId }` |
| `api.roomQueries.getRoomStatePublic` | query | `{ roomId }` |
| `api.commands.getLatest` | query | `{ roomId }` |
| `api.commands.submit` | mutation | `{ text, roomId }` |
| `api.actionLogs.byCommand` | query | `{ commandId }` |
| `api.actionLogs.log` | mutation | `{ deviceId, commandId, action, result, reasoning? }` |
| `api.coordination.getActiveLocks` | query | `{ roomId }` |
| `api.coordination.getAgentMessages` | query | `{ roomId, limit? }` |
| `api.taskGraph.getTaskGraph` | query | `{ commandId }` |
