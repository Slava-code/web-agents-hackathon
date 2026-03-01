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
    "_id": "jn73r5arpm1m4trqt44ean1hhh822j46",
    "name": "OR-3",
    "status": "idle",
    "deviceCount": 2,
    "devicesReady": 0,
    "updatedAt": 1772340463471
  },
  "devices": [
    {
      "_id": "jd7746s4q8nf1qz7mm12sctdch823n4y",
      "name": "UV Robot",
      "category": "sterilization",
      "roomId": "jn73r5arpm1m4trqt44ean1hhh822j46",
      "url": "http://localhost:3000/uv-robot",
      "status": "idle",
      "fields": {},
      "updatedAt": 1772340463471
    },
    {
      "_id": "jd79qkkb7hts62yqxkv5srwapd823an9",
      "name": "TUG Fleet Monitor",
      "category": "transport",
      "roomId": "jn73r5arpm1m4trqt44ean1hhh822j46",
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
| OR-1 | `jn727k23ar820y8tgx894c39k5822emc` | ready | 0 |
| OR-2 | `jn73m907ax98083sk0brmhp55h823tty` | ready | 0 |
| OR-3 | `jn73r5arpm1m4trqt44ean1hhh822j46` | idle | 2 |
| OR-4 | `jn70f574pbckmsqd36jp1t1q5d822mvj` | ready | 0 |

### Devices (OR-3)

| Device | ID | Category | URL |
|--------|----|----------|-----|
| UV Robot | `jd7746s4q8nf1qz7mm12sctdch823n4y` | sterilization | localhost:3000/uv-robot |
| TUG Fleet Monitor | `jd79qkkb7hts62yqxkv5srwapd823an9` | transport | localhost:3000/tug-robot |

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
  roomId: "jn73r5arpm1m4trqt44ean1hhh822j46",  // OR-3
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
