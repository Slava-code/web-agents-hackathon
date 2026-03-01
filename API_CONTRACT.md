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
    "_id": "jn70gpgs6pz5px867y7wak311s823sm0",
    "name": "OR-3",
    "status": "idle",
    "deviceCount": 4,
    "devicesReady": 0,
    "updatedAt": 1772340463471
  },
  "devices": [
    {
      "_id": "jd766xcd11tc7jbbfqpgmmr73s8225mg",
      "name": "UV Robot",
      "category": "sterilization",
      "status": "idle",
      "fields": { "..." : "..." }
    },
    {
      "_id": "jd76tazf69jdn56bafxb76zbfn823azs",
      "name": "TUG Fleet Monitor",
      "category": "transport",
      "status": "idle",
      "fields": { "..." : "..." }
    },
    {
      "_id": "jd7dq5j3qdhdt6j8eh0n4s63eh82211t",
      "name": "Environmental Monitoring",
      "category": "monitoring",
      "status": "idle",
      "fields": { "co2": 750, "particulate": 95, "..." : "..." }
    },
    {
      "_id": "jd7fas480h1xaf65ny9t42xawd823k3p",
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

## Seed Data IDs

### Rooms

| Room | ID | Status | Devices |
|------|----|--------|---------|
| OR-1 | `jn78nzxs95pfp15xrv43t5b6ks823tv4` | ready | 0 |
| OR-2 | `jn78n3nbtv60ead9xe81mwx24d822qrf` | ready | 0 |
| OR-3 | `jn70gpgs6pz5px867y7wak311s823sm0` | idle | 4 |
| OR-4 | `jn7bdjywxy9ks7fffc9ys96001823pfk` | ready | 0 |

### Devices (OR-3)

| Device | ID | Category | URL |
|--------|----|----------|-----|
| UV Robot | `jd766xcd11tc7jbbfqpgmmr73s8225mg` | sterilization | localhost:3000/uv-robot |
| TUG Fleet Monitor | `jd76tazf69jdn56bafxb76zbfn823azs` | transport | localhost:3000/tug-robot |
| Environmental Monitoring | `jd7dq5j3qdhdt6j8eh0n4s63eh82211t` | monitoring | localhost:3000/environmental |
| Room Scheduling | `jd7fas480h1xaf65ny9t42xawd823k3p` | scheduling | localhost:3000/ehr |

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
  roomId: "jn70gpgs6pz5px867y7wak311s823sm0",  // OR-3
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
