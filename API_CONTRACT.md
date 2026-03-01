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
    "_id": "jn7ewfpj0keefnvbt5c9s9wcws822edy",
    "name": "OR-3",
    "status": "idle",
    "deviceCount": 5,
    "devicesReady": 0,
    "updatedAt": 1772340463471
  },
  "devices": [
    {
      "_id": "jd74zb957j4a83r2q1y5zxjwsh8237by",
      "name": "UV Robot",
      "category": "sterilization",
      "roomId": "jn7ewfpj0keefnvbt5c9s9wcws822edy",
      "url": "http://localhost:3001",
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
| OR-1 | `jn79y9jj2g38wjmv81vmhweq4n823s1x` | ready | 0 |
| OR-2 | `jn75c2eryk3rm98y3q7d4vtmd9823zbn` | ready | 0 |
| OR-3 | `jn7ewfpj0keefnvbt5c9s9wcws822edy` | idle | 5 |
| OR-4 | `jn7etvj27d8rmsrdj50trkwz0n823v78` | ready | 0 |

### Devices (OR-3)

| Device | ID | Category | URL |
|--------|----|----------|-----|
| UV Robot | `jd74zb957j4a83r2q1y5zxjwsh8237by` | sterilization | :3001 |
| Env Monitoring | `jd7a5wdr3kc9p7krjep93paptn8235qk` | monitoring | :3002 |
| Sterilizer | `jd7eh4r1c2fxc3rq1axt30zha5823x6m` | sterilization | :3003 |
| Scheduling | `jd7ekvwvtgs4y560qmr61983v1823ewy` | scheduling | :4004 |
| Surveillance | `jd79cdv4fn4d2jyk562vhtz0p58226e8` | monitoring | :3005 |

---

## Convex Client Queries (React Dashboard)

| Function | Type | Args |
|----------|------|------|
| `api.rooms.list` | query | none |
| `api.rooms.get` | query | `{ roomId }` |
| `api.devices.listByRoom` | query | `{ roomId }` |
| `api.commands.getLatest` | query | `{ roomId }` |
| `api.commands.submit` | mutation | `{ text, roomId }` |
| `api.actionLogs.byCommand` | query | `{ commandId }` |
| `api.actionLogs.log` | mutation | `{ deviceId, commandId, action, result }` |
