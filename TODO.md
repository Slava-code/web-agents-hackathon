# TODO — Convex Backend

## Completed ✅

- Phases 1-5 fully done (scaffold, schema, seed, HTTP endpoints, queries, aggregation)
- 30 end-to-end tests passing (`bash test-convex.sh`)
- Real-time overlay: `ConvexStatusBadge` + `useConvexDeviceOverlay` on UV Robot & TUG dashboards
- `getRoomStatePublic` public query for frontend React hooks
- `ConvexClientProvider` wrapping app in `layout.tsx`
- API_CONTRACT.md updated with current IDs and `getRoomStatePublic` docs
- TUG Fleet URL fixed in seed (`/tug-robot`)
- Hydration warnings fixed on all dashboard pages

## Remaining Work

### Phase 6: Environmental Readings (stretch goal) — NOT STARTED

Schema table exists (`environmentReadings`) but has no functions.

- [ ] Create `convex/environmentalReadings.ts` with:
  - `insert` mutation — receives readings, checks ranges, sets `allWithinRange` + `outOfRangeFields`
  - `latest` query — most recent reading for a room
- [ ] Add `POST /env-reading` HTTP endpoint to `convex/http.ts`
- [ ] Gate room "ready" status on environmental check:
  - All devices ready + `allWithinRange` → room "ready"
  - All devices ready + NOT `allWithinRange` → room "needs_attention"
- [ ] Define procedure-specific thresholds (e.g., orthopedic: humidity < 60%)

### Auto action logs

- [ ] Make `/device-update` automatically write to `actionLogs` table (currently manual via separate mutation)

### Auto environmental readings from field-update

- [ ] If `/field-update` receives environmental fields (temperature, humidity, etc.), also insert into `environmentReadings` table

### Add remaining 3 devices to seed (optional)

WebUI has all 5 dashboards but seed only has 2 devices in OR-3. To enable full demo:

- [ ] Add Environmental Monitoring device → `/environmental`
- [ ] Add Scheduling/EHR device → `/ehr`
- [ ] Add Variable Tracker device → `/camera`
- [ ] Update `convex-api.ts` placeholder IDs with real ones after seeding

## Current Setup

- Deployment: `dev:impartial-whale-32`
- HTTP base: `https://impartial-whale-32.convex.site`
- Cloud URL: `https://impartial-whale-32.convex.cloud`
- OR-3 is the active demo room with 2 devices: UV Robot + TUG Fleet Monitor
- OR-1, OR-2, OR-4 are background rooms (ready, no devices)

## WebUI Pages (built by teammate, NOT my scope)

| Route | Device | Convex Badge |
|-------|--------|-------------|
| `/uv-robot` | UV Disinfection Robot | ✅ Live |
| `/tug-robot` | TUG Fleet Monitor | ✅ Live |
| `/environmental` | Environmental Monitoring | No badge (no device in seed) |
| `/ehr` | Room Scheduling / EHR | No badge (no device in seed) |
| `/camera` | Variable Tracker | No badge (no device in seed) |
| `/agent` | BrowserUse Agent Control | N/A |
