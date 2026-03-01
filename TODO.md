# TODO — Convex Backend

## Phase 1: Scaffold & Deploy ✅

- [x] `npm init -y` + `npm install convex`
- [x] `npx convex init` — creates `convex/` directory, log in, get deployment
- [x] Run `npx convex dev` — get a live deployment URL
- [x] Share deployment URL with all teammates
- Deployment: `dev:impartial-whale-32`
- HTTP: `https://impartial-whale-32.convex.site`
- Cloud: `https://impartial-whale-32.convex.cloud`

## Phase 2: Schema & Seed Data ✅

- [x] Create `convex/schema.ts` with all 5 tables (rooms, devices, commands, actionLogs, environmentReadings)
- [x] Create `convex/seed.ts` — populate rooms (OR-1 through OR-4, only OR-3 is active)
- [x] Seed includes `fieldSchema` on each device so BrowserUse agents know what to extract
- [x] `seed:reset` helper to clear all data for re-seeding
- [x] Run seed script via `npx convex run seed:init`
- [x] Verify data appears in Convex dashboard

### Current seed: OR-3 has 2 devices
| Device | Category | URL |
|--------|----------|-----|
| UV Robot | sterilization | `http://localhost:3000/uv-robot` |
| TUG Fleet Monitor | transport | `http://localhost:3000/tug-fleet` |

### ⚠️ Known issues
- [ ] **BUG: TUG Fleet URL mismatch** — seed has `/tug-fleet` but actual WebUI route is `/tug-robot`. Fix seed URL.
- [ ] **Seed only has 2 of 5 devices** — WebUI teammate built all 5 dashboards (uv-robot, environmental, tug-robot, ehr, camera). Consider adding the other 3 back with correct URLs and fieldSchemas if we want full demo coverage.

## Phase 3: HTTP Endpoints ✅

### POST `/device-update` ✅
- [x] Create `convex/http.ts` with httpRouter
- [x] Implement handler: receives `{ deviceId, status, currentAction?, lastError? }`
- [x] Calls internal mutation to patch device row
- [x] On status "ready": check if all devices in room are ready → update room status
- [ ] Write action to `actionLogs` table automatically (currently manual via separate mutation)

### POST `/field-update` ✅
- [x] Implement handler: receives `{ deviceId, fields }`
- [x] Calls internal mutation to merge `fields` into device's existing `fields` object
- [ ] If environmentReadings fields detected, also update `environmentReadings` table (Phase 6)

### GET `/room-state` ✅
- [x] Implement handler: receives `roomId` as query param
- [x] Returns JSON: room info + all devices (status, currentAction, fields) + latest env readings
- [x] CORS headers on all endpoints (`Access-Control-Allow-Origin: *`)
- [x] OPTIONS preflight handlers

### After endpoints are live ✅
- [x] Write API_CONTRACT.md with exact request/response shapes for each endpoint
- [ ] **API_CONTRACT.md is stale** — seed data IDs and device count need refreshing

## Phase 4: Convex Queries (for React Dashboard) ✅

- [x] `api.rooms.list` — all rooms with statuses (`convex/rooms.ts`)
- [x] `api.rooms.get` — single room by ID (`convex/rooms.ts`)
- [x] `api.devices.listByRoom` — all devices for a given room (`convex/devices.ts`)
- [x] `api.commands.getLatest` — most recent command with progress (`convex/commands.ts`)
- [x] `api.commands.submit` — mutation: insert command, set devices to "configuring" (`convex/commands.ts`)
- [x] `api.actionLogs.byCommand` — activity feed for a command (`convex/actionLogs.ts`)
- [x] `api.actionLogs.log` — insert a log entry (`convex/actionLogs.ts`)
- [ ] `api.environmentReadings.latest` — most recent env reading for a room (Phase 6)

## Phase 5: Room Status Aggregation Logic ✅

- [x] When a device status changes to "ready": count ready devices in room, if all ready → room "ready"
- [x] When a device status changes to "error": room → "needs_attention"
- [x] When a command is submitted: room → "preparing", devices → "configuring"
- [x] Handle `devicesReady` counter on the command record
- [x] When `devicesReady === deviceCount`: command → "completed", set `completedAt` and `elapsedMs`
- [x] All aggregation logic verified with 30 passing end-to-end tests (`test-convex.sh`)

## Phase 6: Environmental Readings (stretch goal) — NOT STARTED

Schema table exists (`environmentReadings`) but has no functions.

- [ ] Create `convex/environmentalReadings.ts` with:
  - `insert` mutation — receives readings, checks ranges, sets `allWithinRange` + `outOfRangeFields`
  - `latest` query — most recent reading for a room
- [ ] Add `POST /env-reading` HTTP endpoint to `convex/http.ts`
- [ ] Gate room "ready" status on environmental check:
  - All devices ready + `allWithinRange` → room "ready"
  - All devices ready + NOT `allWithinRange` → room "needs_attention"
- [ ] Define procedure-specific thresholds (e.g., orthopedic: humidity < 60%)

## Testing ✅

- [x] `test-convex.sh` — 30 tests, 39 assertions, all passing
- [x] Covers: HTTP endpoints, Convex functions, full aggregation flow, error handling, CORS, edge cases
- [x] Idempotent: discovers IDs dynamically, cleans up after itself

## Bugs & Fixes Needed

- [ ] **Fix TUG Fleet URL** — seed says `/tug-fleet`, actual WebUI route is `/tug-robot`
- [ ] **Refresh API_CONTRACT.md** — stale seed IDs, says 5 devices (now 2)
- [ ] **Consider re-adding 3 devices** — WebUI has all 5 dashboards built:
  - `/environmental` — Environmental Monitoring System
  - `/ehr` — Room Scheduling / EHR System
  - `/camera` — Variable Tracker / Surveillance
  If we want full demo, add these back to seed with correct fieldSchemas

## WebUI Pages (built by teammate, NOT my scope)

All 5 exist at `src/app/`:
| Route | Device |
|-------|--------|
| `/uv-robot` | UV Disinfection Robot Portal |
| `/tug-robot` | TUG Fleet Monitor |
| `/environmental` | Environmental Monitoring System |
| `/ehr` | Room Scheduling / EHR System |
| `/camera` | Variable Tracker / Surveillance |
| `/agent` | BrowserUse Agent Control Panel (learn/scrape/custom tabs) |

## Notes

- Phases 1-5 complete — teammates are unblocked
- Phase 6 is stretch — only if Phase 5 is solid and there's time
- Keep `/device-update` flexible — the BrowserUse agent may send data in unexpected shapes
- WebUI dashboards POST to Convex via `src/lib/convex-api.ts`
