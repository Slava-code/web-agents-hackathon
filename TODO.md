# TODO — Convex Backend

## Phase 1: Scaffold & Deploy (do first — unblocks everyone)

- [ ] `npm init -y` + `npm install convex`
- [ ] `npx convex init` — creates `convex/` directory, log in, get deployment
- [ ] Run `npx convex dev` — get a live deployment URL
- [ ] Share deployment URL with all teammates immediately

## Phase 2: Schema & Seed Data

- [ ] Create `convex/schema.ts` with all 5 tables (rooms, devices, commands, actionLogs, environmentReadings)
- [ ] Create `convex/seed.ts` — populate rooms (OR-1 through OR-4, only OR-3 is active) and 5 devices for OR-3
- [ ] Run seed script via `npx convex run seed:init`
- [ ] Verify data appears in Convex dashboard

## Phase 3: HTTP Endpoints (this is what unblocks teammates)

### POST `/device-update`
- [ ] Create `convex/http.ts` with httpRouter
- [ ] Implement handler: receives `{ deviceId, status, currentAction?, lastError? }`
- [ ] Calls internal mutation to patch device row
- [ ] On status "ready": check if all devices in room are ready → update room status
- [ ] Write action to `actionLogs` table

### POST `/field-update`
- [ ] Implement handler: receives `{ deviceId, fields }`
- [ ] Calls internal mutation to merge `fields` into device's existing `fields` object
- [ ] If environmentReadings fields detected, also update `environmentReadings` table

### GET `/room-state`
- [ ] Implement handler: receives `roomId` as query param
- [ ] Returns JSON: room info + all devices (status, currentAction, fields) + latest env readings
- [ ] Test with curl to make sure Unity teammate can parse it from C#

### After endpoints are live:
- [ ] Write API_CONTRACT.md with exact request/response shapes for each endpoint
- [ ] Share with all teammates

## Phase 4: Convex Queries (for React Dashboard)

- [ ] `api.rooms.list` — all rooms with statuses
- [ ] `api.devices.listByRoom` — all devices for a given room
- [ ] `api.commands.getLatest` — most recent command with progress (devicesReady/deviceCount)
- [ ] `api.commands.submit` — mutation: insert command, set devices to "configuring", schedule actions
- [ ] `api.actionLogs.byCommand` — activity feed for a command
- [ ] `api.environmentReadings.latest` — most recent env reading for a room

## Phase 5: Room Status Aggregation Logic

- [ ] When a device status changes to "ready": count ready devices in room, if all ready → room "ready"
- [ ] When a device status changes to "error": room → "needs_attention"
- [ ] When a command is submitted: room → "preparing"
- [ ] Handle `devicesReady` counter on the command record
- [ ] When `devicesReady === deviceCount`: command → "completed", set `completedAt` and `elapsedMs`

## Phase 6: Environmental Readings (stretch goal)

- [ ] Mutation to insert environmental reading for a room
- [ ] Logic to check if all values are within range for the room's procedure type
- [ ] Set `allWithinRange` flag and `outOfRangeFields` array
- [ ] If not all within range after all devices ready: room → "needs_attention" instead of "ready"

## Teammate Support

- [ ] Sit with Unity teammate: confirm they can parse `GET /room-state` response from C#
- [ ] Sit with WebUI teammate: confirm they can POST to `/device-update` from their mock UIs
- [ ] Sit with BrowserUse teammate: confirm agent can POST to `/device-update` and `/field-update`

## Notes

- You are the bottleneck — Phases 1-3 must be done ASAP so teammates can integrate
- Phase 4 can happen in parallel with teammates integrating
- Phase 6 is stretch — only if Phase 5 is solid and there's time
- Keep `/device-update` flexible — the BrowserUse agent may send data in unexpected shapes
