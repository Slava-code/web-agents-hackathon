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
    "_id": "jn7fbnzdjjxxsq1c5v03ptq2hx822h41",
    "name": "OR-3",
    "status": "idle",
    "deviceCount": 2,
    "devicesReady": 0,
    "updatedAt": 1772340463471
  },
  "devices": [
    {
      "_id": "jd72bxwjgw87028ccbp6zzmaes823nys",
      "name": "UV Robot",
      "category": "sterilization",
      "roomId": "jn7fbnzdjjxxsq1c5v03ptq2hx822h41",
      "url": "http://localhost:3000/uv-robot",
      "status": "idle",
      "fields": {},
      "updatedAt": 1772340463471
    },
    {
      "_id": "jd74ec16aby2rbteq1rwjcc0t1822pfx",
      "name": "TUG Fleet Monitor",
      "category": "transport",
      "roomId": "jn7fbnzdjjxxsq1c5v03ptq2hx822h41",
      "url": "http://localhost:3000/tug-robot",
      "status": "idle",
      "fields": {},
      "updatedAt": 1772340463471
    }
  ],
  "environmentReadings": []
}
```

---

## Seed Data IDs

### Rooms

| Room | ID | Status | Devices |
|------|----|--------|---------|
| OR-1 | `jn74ng7t47dm867bf9ysewzx61823jcd` | ready | 0 |
| OR-2 | `jn7dyd2x59n44q4bwxve0ghk3h822kr2` | ready | 0 |
| OR-3 | `jn7fbnzdjjxxsq1c5v03ptq2hx822h41` | idle | 2 |
| OR-4 | `jn7e11r2yq5mfbyz7v1x1e81wn823gmj` | ready | 0 |

### Devices (OR-3)

| Device | ID | Category | URL |
|--------|----|----------|-----|
| UV Robot | `jd72bxwjgw87028ccbp6zzmaes823nys` | sterilization | localhost:3000/uv-robot |
| TUG Fleet Monitor | `jd74ec16aby2rbteq1rwjcc0t1822pfx` | transport | localhost:3000/tug-robot |

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
  roomId: "jn7fbnzdjjxxsq1c5v03ptq2hx822h41",  // OR-3
});
```

> **Note:** `getRoomState` (internal query) is identical but restricted to server-side use only. Use `getRoomStatePublic` from the client.

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
| `api.actionLogs.log` | mutation | `{ deviceId, commandId, action, result }` |
