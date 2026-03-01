#!/usr/bin/env bash
#
# End-to-end tests for the Convex backend.
# Tests are IDEMPOTENT: they discover IDs dynamically and clean up after themselves.
#
# Requirements: curl, jq, npx (with convex installed)
#
# Usage:  ./test-convex.sh
#

set -euo pipefail

###############################################################################
# Configuration
###############################################################################

SITE_URL="https://impartial-whale-32.convex.site"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

PASS=0
FAIL=0
TOTAL=0
ASSERTIONS=0

###############################################################################
# Helpers
###############################################################################

_log_header() {
  echo ""
  echo "========================================================================"
  echo "  $1"
  echo "========================================================================"
}

_log_test() {
  TOTAL=$((TOTAL + 1))
  echo ""
  echo "--- TEST $TOTAL: $1 ---"
}

_pass() {
  PASS=$((PASS + 1))
  ASSERTIONS=$((ASSERTIONS + 1))
  echo "  [PASS] $1"
}

_fail() {
  FAIL=$((FAIL + 1))
  ASSERTIONS=$((ASSERTIONS + 1))
  echo "  [FAIL] $1"
  echo "         Detail: $2"
}

# Run a Convex function via npx and return stdout (JSON).
# Usage: convex_run <function> [json_args]
convex_run() {
  local fn="$1"
  shift
  if [ $# -gt 0 ]; then
    npx --yes convex run "$fn" "$@" 2>/dev/null
  else
    npx --yes convex run "$fn" 2>/dev/null
  fi
}

# HTTP helpers
http_post() {
  local path="$1"
  local body="$2"
  curl -s -X POST "${SITE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "$body"
}

http_get() {
  local url="$1"
  curl -s "$url"
}

# Small sleep to allow Convex mutations to propagate to queries (eventual
# consistency window).  Convex is fast; 1.5s is usually plenty.
settle() {
  sleep 1.5
}

###############################################################################
# Phase 0 — Discover seed data IDs dynamically
###############################################################################

_log_header "PHASE 0: Discover seed data"

echo "  Fetching rooms via 'npx convex run rooms:list' ..."
ROOMS_JSON=$(convex_run "rooms:list")

# Find OR-3 room ID (the room with 2 devices)
ROOM_ID=$(echo "$ROOMS_JSON" | jq -r '.[] | select(.name == "OR-3") | ._id')
if [ -z "$ROOM_ID" ] || [ "$ROOM_ID" = "null" ]; then
  echo "FATAL: Could not find room OR-3. Is seed data loaded?"
  exit 1
fi
echo "  Room OR-3 ID = $ROOM_ID"

# Fetch room state via HTTP to get device IDs
ROOM_STATE=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
DEVICE_IDS_JSON=$(echo "$ROOM_STATE" | jq -r '[.devices[]._id]')
DEVICE_COUNT=$(echo "$DEVICE_IDS_JSON" | jq 'length')

echo "  Found $DEVICE_COUNT devices in OR-3"

if [ "$DEVICE_COUNT" -lt 4 ]; then
  echo "FATAL: Expected at least 4 devices in OR-3, got $DEVICE_COUNT"
  exit 1
fi

# Extract individual device IDs by name for targeted tests
DEV_UV_ROBOT=$(echo "$ROOM_STATE" | jq -r '.devices[] | select(.name == "UV Robot") | ._id')
DEV_TUG_FLEET=$(echo "$ROOM_STATE" | jq -r '.devices[] | select(.name == "TUG Fleet Monitor") | ._id')
DEV_ENV_MON=$(echo "$ROOM_STATE" | jq -r '.devices[] | select(.name == "Environmental Monitoring") | ._id')
DEV_SCHEDULING=$(echo "$ROOM_STATE" | jq -r '.devices[] | select(.name == "Room Scheduling") | ._id')

echo "  UV Robot               = $DEV_UV_ROBOT"
echo "  TUG Fleet Monitor      = $DEV_TUG_FLEET"
echo "  Environmental Monitor  = $DEV_ENV_MON"
echo "  Room Scheduling        = $DEV_SCHEDULING"

# Build an array for iteration
ALL_DEVICE_IDS=("$DEV_UV_ROBOT" "$DEV_TUG_FLEET" "$DEV_ENV_MON" "$DEV_SCHEDULING")

###############################################################################
# CLEANUP helper — reset all devices to idle and room to idle
###############################################################################

cleanup() {
  echo ""
  echo "--- CLEANUP: Resetting all devices to idle ---"
  for did in "${ALL_DEVICE_IDS[@]}"; do
    http_post "/device-update" "{\"deviceId\":\"$did\",\"status\":\"idle\"}" >/dev/null 2>&1
  done
  settle
  echo "  Cleanup complete."
}

# Always run cleanup on exit
trap cleanup EXIT

###############################################################################
# SECTION 1 — HTTP Endpoint: GET /room-state
###############################################################################

_log_header "SECTION 1: GET /room-state"

# Test 1.1: Basic room-state fetch
_log_test "GET /room-state returns valid room data"
RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
ROOM_NAME=$(echo "$RESP" | jq -r '.room.name')
if [ "$ROOM_NAME" = "OR-3" ]; then
  _pass "Room name is OR-3"
else
  _fail "Room name mismatch" "expected 'OR-3', got '$ROOM_NAME'"
fi

# Test 1.2: room-state includes devices array
_log_test "GET /room-state includes devices array with correct count"
DEV_LEN=$(echo "$RESP" | jq '.devices | length')
if [ "$DEV_LEN" -eq 4 ]; then
  _pass "devices array has 4 entries"
else
  _fail "devices array length wrong" "expected 4, got $DEV_LEN"
fi

# Test 1.3: room-state includes environmentReadings (even if empty)
_log_test "GET /room-state includes environmentReadings key"
HAS_ENV=$(echo "$RESP" | jq 'has("environmentReadings")')
if [ "$HAS_ENV" = "true" ]; then
  _pass "environmentReadings key present"
else
  _fail "environmentReadings key missing" "response: $RESP"
fi

# Test 1.4: missing roomId -> 400
_log_test "GET /room-state without roomId returns 400 error"
RESP_ERR=$(http_get "${SITE_URL}/room-state")
ERR_MSG=$(echo "$RESP_ERR" | jq -r '.error // empty')
if [ -n "$ERR_MSG" ]; then
  _pass "Error response received: $ERR_MSG"
else
  _fail "Expected error response" "got: $RESP_ERR"
fi

###############################################################################
# SECTION 2 — HTTP Endpoint: POST /device-update (basic)
###############################################################################

_log_header "SECTION 2: POST /device-update (basic)"

# Test 2.1: Update a single device to configuring
_log_test "POST /device-update sets device to configuring"
RESP=$(http_post "/device-update" "{\"deviceId\":\"$DEV_UV_ROBOT\",\"status\":\"configuring\",\"currentAction\":\"test action\"}")
OK=$(echo "$RESP" | jq -r '.ok')
if [ "$OK" = "true" ]; then
  _pass "Response ok=true"
else
  _fail "Response not ok" "$RESP"
fi

settle

# Verify via room-state
RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
UV_STATUS=$(echo "$RESP" | jq -r '.devices[] | select(.name == "UV Robot") | .status')
if [ "$UV_STATUS" = "configuring" ]; then
  _pass "UV Robot status is now 'configuring'"
else
  _fail "UV Robot status not updated" "expected 'configuring', got '$UV_STATUS'"
fi

# Test 2.2: Reset device back to idle
_log_test "POST /device-update resets device to idle"
RESP=$(http_post "/device-update" "{\"deviceId\":\"$DEV_UV_ROBOT\",\"status\":\"idle\"}")
OK=$(echo "$RESP" | jq -r '.ok')
if [ "$OK" = "true" ]; then
  _pass "Reset to idle ok=true"
else
  _fail "Reset to idle failed" "$RESP"
fi
settle

# Test 2.3: missing fields -> 400
_log_test "POST /device-update with missing status returns error"
RESP=$(http_post "/device-update" "{\"deviceId\":\"$DEV_UV_ROBOT\"}")
ERR=$(echo "$RESP" | jq -r '.error // empty')
if [ -n "$ERR" ]; then
  _pass "Error returned for missing status: $ERR"
else
  _fail "Expected error for missing status" "$RESP"
fi

###############################################################################
# SECTION 3 — HTTP Endpoint: POST /field-update
###############################################################################

_log_header "SECTION 3: POST /field-update"

# Test 3.1: Set new fields on a device
_log_test "POST /field-update sets new fields"
RESP=$(http_post "/field-update" "{\"deviceId\":\"$DEV_TUG_FLEET\",\"fields\":{\"temperature\":22.5,\"humidity\":45}}")
OK=$(echo "$RESP" | jq -r '.ok')
if [ "$OK" = "true" ]; then
  _pass "field-update ok=true"
else
  _fail "field-update failed" "$RESP"
fi

settle

# Verify fields via room-state
RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
TEMP=$(echo "$RESP" | jq -r '.devices[] | select(.name == "TUG Fleet Monitor") | .fields.temperature')
HUMID=$(echo "$RESP" | jq -r '.devices[] | select(.name == "TUG Fleet Monitor") | .fields.humidity')
if [ "$TEMP" = "22.5" ] && [ "$HUMID" = "45" ]; then
  _pass "Fields set correctly (temp=$TEMP, humidity=$HUMID)"
else
  _fail "Fields not set correctly" "temp=$TEMP, humidity=$HUMID"
fi

# Test 3.2: Shallow merge — add a field without overwriting existing
_log_test "POST /field-update merges fields (does not overwrite existing)"
RESP=$(http_post "/field-update" "{\"deviceId\":\"$DEV_TUG_FLEET\",\"fields\":{\"co2\":400}}")
OK=$(echo "$RESP" | jq -r '.ok')
if [ "$OK" = "true" ]; then
  _pass "Merge field-update ok=true"
else
  _fail "Merge field-update failed" "$RESP"
fi

settle

# Check all three fields present
RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
TEMP2=$(echo "$RESP" | jq -r '.devices[] | select(.name == "TUG Fleet Monitor") | .fields.temperature')
CO2=$(echo "$RESP" | jq -r '.devices[] | select(.name == "TUG Fleet Monitor") | .fields.co2')
if [ "$TEMP2" = "22.5" ] && [ "$CO2" = "400" ]; then
  _pass "Merge preserved temperature ($TEMP2) and added co2 ($CO2)"
else
  _fail "Merge did not work" "temp=$TEMP2, co2=$CO2"
fi

# Test 3.3: Overwrite an existing field
_log_test "POST /field-update can overwrite an existing field"
RESP=$(http_post "/field-update" "{\"deviceId\":\"$DEV_TUG_FLEET\",\"fields\":{\"temperature\":25.0}}")
OK=$(echo "$RESP" | jq -r '.ok')
settle
RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
TEMP3=$(echo "$RESP" | jq -r '.devices[] | select(.name == "TUG Fleet Monitor") | .fields.temperature')
if [ "$TEMP3" = "25" ]; then
  _pass "Temperature overwritten to 25"
else
  _fail "Temperature overwrite failed" "expected 25, got $TEMP3"
fi

# Test 3.4: missing fields -> error
_log_test "POST /field-update with missing fields returns error"
RESP=$(http_post "/field-update" "{\"deviceId\":\"$DEV_TUG_FLEET\"}")
ERR=$(echo "$RESP" | jq -r '.error // empty')
if [ -n "$ERR" ]; then
  _pass "Error returned for missing fields"
else
  _fail "Expected error for missing fields" "$RESP"
fi

###############################################################################
# SECTION 4 — Convex Functions via npx convex run
###############################################################################

_log_header "SECTION 4: Convex functions (npx convex run)"

# Test 4.1: rooms:list returns all rooms
_log_test "rooms:list returns all 4 rooms"
ROOMS=$(convex_run "rooms:list")
ROOM_COUNT=$(echo "$ROOMS" | jq 'length')
if [ "$ROOM_COUNT" -eq 4 ]; then
  _pass "rooms:list returned $ROOM_COUNT rooms"
else
  _fail "rooms:list count wrong" "expected 4, got $ROOM_COUNT"
fi

# Test 4.2: rooms:get for OR-3
_log_test "rooms:get returns OR-3 by ID"
ROOM=$(convex_run "rooms:get" "{\"roomId\":\"$ROOM_ID\"}")
RNAME=$(echo "$ROOM" | jq -r '.name')
if [ "$RNAME" = "OR-3" ]; then
  _pass "rooms:get returned name=OR-3"
else
  _fail "rooms:get name wrong" "expected OR-3, got $RNAME"
fi

# Test 4.3: devices:listByRoom returns 4 devices
_log_test "devices:listByRoom returns 4 devices for OR-3"
DEVS=$(convex_run "devices:listByRoom" "{\"roomId\":\"$ROOM_ID\"}")
DCOUNT=$(echo "$DEVS" | jq 'length')
if [ "$DCOUNT" -eq 4 ]; then
  _pass "devices:listByRoom returned $DCOUNT devices"
else
  _fail "devices:listByRoom count wrong" "expected 4, got $DCOUNT"
fi

###############################################################################
# SECTION 5 — Full aggregation flow: submit command -> all devices ready ->
#              room ready, command completed with elapsedMs
###############################################################################

_log_header "SECTION 5: Full aggregation flow"

# First, make sure all devices start at idle
echo "  Resetting all devices to idle before flow test..."
for did in "${ALL_DEVICE_IDS[@]}"; do
  http_post "/device-update" "{\"deviceId\":\"$did\",\"status\":\"idle\"}" >/dev/null
done
settle

# 5.1: Submit a command
_log_test "commands:submit creates a running command and sets devices to configuring"
CMD_ID=$(convex_run "commands:submit" "{\"text\":\"Prepare OR-3 for surgery\",\"roomId\":\"$ROOM_ID\"}")
# CMD_ID comes back as a quoted string from convex run, strip quotes
CMD_ID=$(echo "$CMD_ID" | jq -r '.')

if [ -z "$CMD_ID" ] || [ "$CMD_ID" = "null" ]; then
  _fail "commands:submit returned no ID" "$CMD_ID"
else
  _pass "Command created with ID: $CMD_ID"
fi

settle

# 5.2: Verify room is now "preparing" and devices are "configuring"
_log_test "After submit: room status = preparing, all devices = configuring"
RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
RSTATUS=$(echo "$RESP" | jq -r '.room.status')
CONFIGURING_COUNT=$(echo "$RESP" | jq '[.devices[] | select(.status == "configuring")] | length')

if [ "$RSTATUS" = "preparing" ]; then
  _pass "Room status is 'preparing'"
else
  _fail "Room status not preparing" "got '$RSTATUS'"
fi

if [ "$CONFIGURING_COUNT" -eq 4 ]; then
  _pass "All 4 devices are 'configuring'"
else
  _fail "Not all devices configuring" "configuring count = $CONFIGURING_COUNT"
fi

# 5.3: Verify the command is "running"
_log_test "commands:getLatest shows command as running"
CMD=$(convex_run "commands:getLatest" "{\"roomId\":\"$ROOM_ID\"}")
CMD_STATUS=$(echo "$CMD" | jq -r '.status')
if [ "$CMD_STATUS" = "running" ]; then
  _pass "Command status is 'running'"
else
  _fail "Command status not running" "got '$CMD_STATUS'"
fi

# 5.4: Send device-update "ready" for first device — room should NOT be ready yet
_log_test "Sending ready for 1/4 devices — room should NOT be ready yet"
http_post "/device-update" "{\"deviceId\":\"${ALL_DEVICE_IDS[0]}\",\"status\":\"ready\"}" >/dev/null
settle

RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
RSTATUS=$(echo "$RESP" | jq -r '.room.status')
READY_COUNT=$(echo "$RESP" | jq '.room.devicesReady')

if [ "$READY_COUNT" -eq 1 ]; then
  _pass "devicesReady = 1"
else
  _fail "devicesReady wrong" "expected 1, got $READY_COUNT"
fi

# Room should still be preparing (not all ready yet)
if [ "$RSTATUS" = "preparing" ]; then
  _pass "Room still 'preparing' with 1/4 devices ready"
else
  _fail "Room status unexpected with 1/4 ready" "got '$RSTATUS'"
fi

# 5.5: Send remaining devices ready -> room should become "ready" and command "completed"
_log_test "Sending last 3 devices ready — room should go 'ready', command 'completed' with elapsedMs"
http_post "/device-update" "{\"deviceId\":\"${ALL_DEVICE_IDS[1]}\",\"status\":\"ready\"}" >/dev/null
http_post "/device-update" "{\"deviceId\":\"${ALL_DEVICE_IDS[2]}\",\"status\":\"ready\"}" >/dev/null
http_post "/device-update" "{\"deviceId\":\"${ALL_DEVICE_IDS[3]}\",\"status\":\"ready\"}" >/dev/null
settle

RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
RSTATUS=$(echo "$RESP" | jq -r '.room.status')
READY_COUNT=$(echo "$RESP" | jq '.room.devicesReady')

if [ "$RSTATUS" = "ready" ]; then
  _pass "Room status is 'ready'"
else
  _fail "Room status not ready" "got '$RSTATUS'"
fi

if [ "$READY_COUNT" -eq 4 ]; then
  _pass "devicesReady = 4"
else
  _fail "devicesReady wrong" "expected 4, got $READY_COUNT"
fi

# 5.6: Command should now be completed with elapsedMs
_log_test "Command is completed with elapsedMs > 0"
CMD=$(convex_run "commands:getLatest" "{\"roomId\":\"$ROOM_ID\"}")
CMD_STATUS=$(echo "$CMD" | jq -r '.status')
ELAPSED=$(echo "$CMD" | jq -r '.elapsedMs // 0')

if [ "$CMD_STATUS" = "completed" ]; then
  _pass "Command status is 'completed'"
else
  _fail "Command not completed" "got '$CMD_STATUS'"
fi

if [ "$ELAPSED" -gt 0 ] 2>/dev/null; then
  _pass "elapsedMs = ${ELAPSED}ms (> 0)"
else
  _fail "elapsedMs not positive" "got '$ELAPSED'"
fi

###############################################################################
# SECTION 6 — Error handling: device error -> room needs_attention
###############################################################################

_log_header "SECTION 6: Error handling (device error -> needs_attention)"

# Reset all devices to idle first
echo "  Resetting all devices to idle..."
for did in "${ALL_DEVICE_IDS[@]}"; do
  http_post "/device-update" "{\"deviceId\":\"$did\",\"status\":\"idle\"}" >/dev/null
done
settle

# 6.1: Submit a new command
_log_test "Submit a new command, then send an error device-update"
CMD_ID2=$(convex_run "commands:submit" "{\"text\":\"Error test command\",\"roomId\":\"$ROOM_ID\"}")
CMD_ID2=$(echo "$CMD_ID2" | jq -r '.')
settle

# 6.2: Send error for one device (TUG Fleet Monitor)
RESP=$(http_post "/device-update" "{\"deviceId\":\"$DEV_TUG_FLEET\",\"status\":\"error\",\"lastError\":\"Test error: sensor offline\"}")
OK=$(echo "$RESP" | jq -r '.ok')
if [ "$OK" = "true" ]; then
  _pass "Error device-update accepted"
else
  _fail "Error device-update not accepted" "$RESP"
fi

settle

# 6.3: Verify room is needs_attention
_log_test "Room status = needs_attention after device error"
RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
RSTATUS=$(echo "$RESP" | jq -r '.room.status')
if [ "$RSTATUS" = "needs_attention" ]; then
  _pass "Room status is 'needs_attention'"
else
  _fail "Room status wrong" "expected 'needs_attention', got '$RSTATUS'"
fi

# 6.4: Verify the errored device has lastError set
_log_test "Errored device has status=error and lastError set"
TUG_STATUS=$(echo "$RESP" | jq -r '.devices[] | select(.name == "TUG Fleet Monitor") | .status')
TUG_ERROR=$(echo "$RESP" | jq -r '.devices[] | select(.name == "TUG Fleet Monitor") | .lastError')

if [ "$TUG_STATUS" = "error" ]; then
  _pass "TUG Fleet Monitor status is 'error'"
else
  _fail "TUG Fleet Monitor status wrong" "expected 'error', got '$TUG_STATUS'"
fi

if [ "$TUG_ERROR" = "Test error: sensor offline" ]; then
  _pass "TUG Fleet Monitor lastError = 'Test error: sensor offline'"
else
  _fail "TUG Fleet Monitor lastError wrong" "got '$TUG_ERROR'"
fi

###############################################################################
# SECTION 7 — Action logs
###############################################################################

_log_header "SECTION 7: Action logs"

# 7.1: Log an action for a device/command pair
_log_test "actionLogs:log creates a log entry"
# Use the second command (CMD_ID2) and the UV Robot
LOG_ID=$(convex_run "actionLogs:log" "{\"deviceId\":\"$DEV_UV_ROBOT\",\"commandId\":\"$CMD_ID2\",\"action\":\"Start UV cycle\",\"result\":\"success\"}")
LOG_ID=$(echo "$LOG_ID" | jq -r '.')

if [ -z "$LOG_ID" ] || [ "$LOG_ID" = "null" ]; then
  _fail "actionLogs:log returned no ID" "$LOG_ID"
else
  _pass "Action log created with ID: $LOG_ID"
fi

# 7.2: Retrieve action logs by command
_log_test "actionLogs:byCommand returns the log we just created"
LOGS=$(convex_run "actionLogs:byCommand" "{\"commandId\":\"$CMD_ID2\"}")
LOG_COUNT=$(echo "$LOGS" | jq 'length')

if [ "$LOG_COUNT" -ge 1 ]; then
  _pass "Found $LOG_COUNT action log(s) for command"
else
  _fail "No action logs found" "$LOGS"
fi

LOG_ACTION=$(echo "$LOGS" | jq -r '.[0].action')
if [ "$LOG_ACTION" = "Start UV cycle" ]; then
  _pass "Log action matches: '$LOG_ACTION'"
else
  _fail "Log action mismatch" "expected 'Start UV cycle', got '$LOG_ACTION'"
fi

###############################################################################
# SECTION 8 — CORS / OPTIONS preflight
###############################################################################

_log_header "SECTION 8: CORS / OPTIONS preflight"

# Test 8.1: OPTIONS /device-update returns 204 with CORS headers
_log_test "OPTIONS /device-update returns CORS headers"
CORS_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "${SITE_URL}/device-update" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST")

if [ "$CORS_RESP" = "204" ]; then
  _pass "OPTIONS returned 204"
else
  _fail "OPTIONS status code wrong" "expected 204, got $CORS_RESP"
fi

# Test 8.2: Actual response includes Access-Control-Allow-Origin
_log_test "POST /device-update response includes Access-Control-Allow-Origin: *"
HEADERS=$(curl -s -D - -o /dev/null -X POST "${SITE_URL}/device-update" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEV_UV_ROBOT\",\"status\":\"idle\"}")
if echo "$HEADERS" | grep -qi "access-control-allow-origin: \*"; then
  _pass "CORS header present"
else
  _fail "CORS header missing" "headers: $HEADERS"
fi

###############################################################################
# SECTION 9 — Edge cases & idempotency checks
###############################################################################

_log_header "SECTION 9: Edge cases"

# 9.1: Setting a device to idle when already idle is a no-op
_log_test "Setting an idle device to idle again is idempotent"
# First ensure idle
http_post "/device-update" "{\"deviceId\":\"$DEV_UV_ROBOT\",\"status\":\"idle\"}" >/dev/null
settle

RESP=$(http_post "/device-update" "{\"deviceId\":\"$DEV_UV_ROBOT\",\"status\":\"idle\"}")
OK=$(echo "$RESP" | jq -r '.ok')
if [ "$OK" = "true" ]; then
  _pass "Double idle is fine, ok=true"
else
  _fail "Double idle failed" "$RESP"
fi

# 9.2: field-update with empty fields object
_log_test "POST /field-update with empty fields object succeeds (no-op merge)"
RESP=$(http_post "/field-update" "{\"deviceId\":\"$DEV_TUG_FLEET\",\"fields\":{}}")
OK=$(echo "$RESP" | jq -r '.ok')
if [ "$OK" = "true" ]; then
  _pass "Empty fields merge ok=true"
else
  _fail "Empty fields merge failed" "$RESP"
fi

# 9.3: device-update with currentAction field
_log_test "POST /device-update can set currentAction"
RESP=$(http_post "/device-update" "{\"deviceId\":\"$DEV_TUG_FLEET\",\"status\":\"configuring\",\"currentAction\":\"Scanning perimeter\"}")
OK=$(echo "$RESP" | jq -r '.ok')
settle
RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
CA=$(echo "$RESP" | jq -r '.devices[] | select(.name == "TUG Fleet Monitor") | .currentAction')
if [ "$CA" = "Scanning perimeter" ]; then
  _pass "currentAction set to 'Scanning perimeter'"
else
  _fail "currentAction wrong" "got '$CA'"
fi

# Reset TUG Fleet Monitor back to idle
http_post "/device-update" "{\"deviceId\":\"$DEV_TUG_FLEET\",\"status\":\"idle\"}" >/dev/null

###############################################################################
# SECTION 10 — Verify new devices exist with correct category/fieldSchema
###############################################################################

_log_header "SECTION 10: New devices — Environmental Monitoring & Room Scheduling"

# 10.1: Environmental Monitoring exists with correct category
_log_test "Environmental Monitoring device has category 'monitoring'"
RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
ENV_CAT=$(echo "$RESP" | jq -r '.devices[] | select(.name == "Environmental Monitoring") | .category')
if [ "$ENV_CAT" = "monitoring" ]; then
  _pass "Environmental Monitoring category = monitoring"
else
  _fail "Environmental Monitoring category wrong" "expected 'monitoring', got '$ENV_CAT'"
fi

# 10.2: Environmental Monitoring has fieldSchema with co2/particulate/temperature
_log_test "Environmental Monitoring has fieldSchema with expected keys"
ENV_FS=$(echo "$RESP" | jq '.devices[] | select(.name == "Environmental Monitoring") | .fieldSchema | keys')
HAS_CO2=$(echo "$ENV_FS" | jq 'index("co2") != null')
HAS_PART=$(echo "$ENV_FS" | jq 'index("particulate") != null')
HAS_TEMP=$(echo "$ENV_FS" | jq 'index("temperature") != null')
if [ "$HAS_CO2" = "true" ] && [ "$HAS_PART" = "true" ] && [ "$HAS_TEMP" = "true" ]; then
  _pass "fieldSchema has co2, particulate, temperature"
else
  _fail "fieldSchema missing keys" "co2=$HAS_CO2 particulate=$HAS_PART temperature=$HAS_TEMP"
fi

# 10.3: Room Scheduling exists with correct category
_log_test "Room Scheduling device has category 'scheduling'"
SCHED_CAT=$(echo "$RESP" | jq -r '.devices[] | select(.name == "Room Scheduling") | .category')
if [ "$SCHED_CAT" = "scheduling" ]; then
  _pass "Room Scheduling category = scheduling"
else
  _fail "Room Scheduling category wrong" "expected 'scheduling', got '$SCHED_CAT'"
fi

# 10.4: Room Scheduling has fieldSchema with selectedRoom/surgeon/delayMinutes
_log_test "Room Scheduling has fieldSchema with expected keys"
SCHED_FS=$(echo "$RESP" | jq '.devices[] | select(.name == "Room Scheduling") | .fieldSchema | keys')
HAS_ROOM=$(echo "$SCHED_FS" | jq 'index("selectedRoom") != null')
HAS_SURG=$(echo "$SCHED_FS" | jq 'index("surgeon") != null')
HAS_DELAY=$(echo "$SCHED_FS" | jq 'index("delayMinutes") != null')
if [ "$HAS_ROOM" = "true" ] && [ "$HAS_SURG" = "true" ] && [ "$HAS_DELAY" = "true" ]; then
  _pass "fieldSchema has selectedRoom, surgeon, delayMinutes"
else
  _fail "fieldSchema missing keys" "selectedRoom=$HAS_ROOM surgeon=$HAS_SURG delayMinutes=$HAS_DELAY"
fi

# 10.5: Environmental Monitoring has co2 field value (numeric)
_log_test "Environmental Monitoring has a numeric co2 field value"
ENV_CO2=$(echo "$RESP" | jq -r '.devices[] | select(.name == "Environmental Monitoring") | .fields.co2')
if [ -n "$ENV_CO2" ] && [ "$ENV_CO2" != "null" ] && [ "$ENV_CO2" -gt 0 ] 2>/dev/null; then
  _pass "Environmental Monitoring co2 = $ENV_CO2 (numeric > 0)"
else
  _fail "Environmental Monitoring co2 not valid" "got '$ENV_CO2'"
fi

###############################################################################
# SECTION 11 — POST /trigger-anomaly
###############################################################################

_log_header "SECTION 11: POST /trigger-anomaly"

# Reset all devices to idle before anomaly tests
echo "  Resetting all devices to idle..."
for did in "${ALL_DEVICE_IDS[@]}"; do
  http_post "/device-update" "{\"deviceId\":\"$did\",\"status\":\"idle\"}" >/dev/null
done
settle

# 11.1: ventilation_failure scenario
_log_test "trigger-anomaly ventilation_failure — CO2=1200, device=error, room=needs_attention"
RESP=$(http_post "/trigger-anomaly" "{\"roomId\":\"$ROOM_ID\",\"scenario\":\"ventilation_failure\"}")
OK=$(echo "$RESP" | jq -r '.ok')
SCENARIO=$(echo "$RESP" | jq -r '.scenario')
if [ "$OK" = "true" ] && [ "$SCENARIO" = "ventilation_failure" ]; then
  _pass "trigger-anomaly response ok=true, scenario=ventilation_failure"
else
  _fail "trigger-anomaly response wrong" "$RESP"
fi

settle

RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
ENV_CO2=$(echo "$RESP" | jq -r '.devices[] | select(.name == "Environmental Monitoring") | .fields.co2')
ENV_STATUS=$(echo "$RESP" | jq -r '.devices[] | select(.name == "Environmental Monitoring") | .status')
ROOM_STATUS=$(echo "$RESP" | jq -r '.room.status')

if [ "$ENV_CO2" = "1200" ]; then
  _pass "Environmental Monitoring co2 = 1200"
else
  _fail "Environmental Monitoring co2 wrong" "expected 1200, got '$ENV_CO2'"
fi

if [ "$ENV_STATUS" = "error" ]; then
  _pass "Environmental Monitoring status = error"
else
  _fail "Environmental Monitoring status wrong" "expected 'error', got '$ENV_STATUS'"
fi

if [ "$ROOM_STATUS" = "needs_attention" ]; then
  _pass "Room status = needs_attention"
else
  _fail "Room status wrong" "expected 'needs_attention', got '$ROOM_STATUS'"
fi

# Check environmentReadings record was inserted
ENV_READINGS_COUNT=$(echo "$RESP" | jq '.environmentReadings | length')
if [ "$ENV_READINGS_COUNT" -ge 1 ]; then
  _pass "environmentReadings has $ENV_READINGS_COUNT record(s)"
else
  _fail "No environmentReadings record inserted" "count=$ENV_READINGS_COUNT"
fi

# Reset before next anomaly
for did in "${ALL_DEVICE_IDS[@]}"; do
  http_post "/device-update" "{\"deviceId\":\"$did\",\"status\":\"idle\"}" >/dev/null
done
settle

# 11.2: battery_failure scenario
_log_test "trigger-anomaly battery_failure — UV battery=15, status=error"
RESP=$(http_post "/trigger-anomaly" "{\"roomId\":\"$ROOM_ID\",\"scenario\":\"battery_failure\"}")
OK=$(echo "$RESP" | jq -r '.ok')
settle

RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
UV_BATTERY=$(echo "$RESP" | jq -r '.devices[] | select(.name == "UV Robot") | .fields.battery')
UV_STATUS=$(echo "$RESP" | jq -r '.devices[] | select(.name == "UV Robot") | .status')

if [ "$UV_BATTERY" = "15" ]; then
  _pass "UV Robot battery = 15"
else
  _fail "UV Robot battery wrong" "expected 15, got '$UV_BATTERY'"
fi

if [ "$UV_STATUS" = "error" ]; then
  _pass "UV Robot status = error"
else
  _fail "UV Robot status wrong" "expected 'error', got '$UV_STATUS'"
fi

# Reset before next anomaly
for did in "${ALL_DEVICE_IDS[@]}"; do
  http_post "/device-update" "{\"deviceId\":\"$did\",\"status\":\"idle\"}" >/dev/null
done
settle

# 11.3: co2_spike scenario
_log_test "trigger-anomaly co2_spike — CO2=1050"
RESP=$(http_post "/trigger-anomaly" "{\"roomId\":\"$ROOM_ID\",\"scenario\":\"co2_spike\"}")
OK=$(echo "$RESP" | jq -r '.ok')
settle

RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
ENV_CO2=$(echo "$RESP" | jq -r '.devices[] | select(.name == "Environmental Monitoring") | .fields.co2')

if [ "$ENV_CO2" = "1050" ]; then
  _pass "Environmental Monitoring co2 = 1050"
else
  _fail "Environmental Monitoring co2 wrong" "expected 1050, got '$ENV_CO2'"
fi

# Reset before validation tests
for did in "${ALL_DEVICE_IDS[@]}"; do
  http_post "/device-update" "{\"deviceId\":\"$did\",\"status\":\"idle\"}" >/dev/null
done
settle

# 11.4: invalid scenario -> error
_log_test "trigger-anomaly with invalid scenario returns error"
RESP=$(http_post "/trigger-anomaly" "{\"roomId\":\"$ROOM_ID\",\"scenario\":\"invalid_thing\"}")
ERR=$(echo "$RESP" | jq -r '.error // empty')
if [ -n "$ERR" ]; then
  _pass "Error returned for invalid scenario: $ERR"
else
  _fail "Expected error for invalid scenario" "$RESP"
fi

# 11.5: missing fields -> error
_log_test "trigger-anomaly with missing fields returns error"
RESP=$(http_post "/trigger-anomaly" "{\"roomId\":\"$ROOM_ID\"}")
ERR=$(echo "$RESP" | jq -r '.error // empty')
if [ -n "$ERR" ]; then
  _pass "Error returned for missing scenario: $ERR"
else
  _fail "Expected error for missing scenario" "$RESP"
fi

###############################################################################
# SECTION 12 — Verify reset after anomaly (all 4 devices back to idle)
###############################################################################

_log_header "SECTION 12: Reset after anomaly"

# First trigger an anomaly
http_post "/trigger-anomaly" "{\"roomId\":\"$ROOM_ID\",\"scenario\":\"ventilation_failure\"}" >/dev/null
settle

# Now reset all devices to idle
_log_test "Reset all 4 devices to idle after anomaly"
for did in "${ALL_DEVICE_IDS[@]}"; do
  http_post "/device-update" "{\"deviceId\":\"$did\",\"status\":\"idle\"}" >/dev/null
done
settle

RESP=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
IDLE_COUNT=$(echo "$RESP" | jq '[.devices[] | select(.status == "idle")] | length')
if [ "$IDLE_COUNT" -eq 4 ]; then
  _pass "All 4 devices are idle after reset"
else
  _fail "Not all devices idle" "idle count = $IDLE_COUNT"
fi

# Verify room is no longer needs_attention (should go back to idle or ready)
RSTATUS=$(echo "$RESP" | jq -r '.room.status')
if [ "$RSTATUS" != "needs_attention" ]; then
  _pass "Room status is no longer 'needs_attention' (is '$RSTATUS')"
else
  _fail "Room still needs_attention after full reset" "got '$RSTATUS'"
fi

###############################################################################
# SECTION 13 — POST /action-log HTTP endpoint
###############################################################################

_log_header "SECTION 13: POST /action-log"

# Reset all devices to idle, submit a fresh command for action-log tests
echo "  Resetting all devices to idle..."
for did in "${ALL_DEVICE_IDS[@]}"; do
  http_post "/device-update" "{\"deviceId\":\"$did\",\"status\":\"idle\"}" >/dev/null
done
settle

CMD_ID_LOG=$(convex_run "commands:submit" "{\"text\":\"Action log test command\",\"roomId\":\"$ROOM_ID\"}")
CMD_ID_LOG=$(echo "$CMD_ID_LOG" | jq -r '.')
settle

# 13.1: POST /action-log with reasoning -> ok + logId
_log_test "POST /action-log with reasoning returns ok and logId"
RESP=$(http_post "/action-log" "{\"deviceId\":\"$DEV_UV_ROBOT\",\"commandId\":\"$CMD_ID_LOG\",\"action\":\"Initiating UV cycle\",\"result\":\"in_progress\",\"reasoning\":\"Room has 4 devices. Starting with UV sterilization first because it takes longest.\"}")
OK=$(echo "$RESP" | jq -r '.ok')
LOG_ID_13=$(echo "$RESP" | jq -r '.logId')

if [ "$OK" = "true" ]; then
  _pass "Response ok=true"
else
  _fail "Response not ok" "$RESP"
fi

if [ -n "$LOG_ID_13" ] && [ "$LOG_ID_13" != "null" ]; then
  _pass "logId returned: $LOG_ID_13"
else
  _fail "logId missing from response" "$RESP"
fi

# 13.2: byCommand returns entry with reasoning field populated
_log_test "actionLogs:byCommand returns entry with reasoning field"
LOGS=$(convex_run "actionLogs:byCommand" "{\"commandId\":\"$CMD_ID_LOG\"}")
REASONING=$(echo "$LOGS" | jq -r '.[0].reasoning // empty')

if [ -n "$REASONING" ]; then
  _pass "reasoning field populated: '${REASONING:0:60}...'"
else
  _fail "reasoning field empty or missing" "$(echo "$LOGS" | jq '.[0]')"
fi

# 13.3: POST /action-log without reasoning -> ok (backward compat)
_log_test "POST /action-log without reasoning returns ok (backward compat)"
RESP=$(http_post "/action-log" "{\"deviceId\":\"$DEV_TUG_FLEET\",\"commandId\":\"$CMD_ID_LOG\",\"action\":\"Dispatching TUG\",\"result\":\"success\"}")
OK=$(echo "$RESP" | jq -r '.ok')

if [ "$OK" = "true" ]; then
  _pass "Response ok=true without reasoning"
else
  _fail "Response not ok without reasoning" "$RESP"
fi

# 13.4: POST /action-log with missing required fields -> error
_log_test "POST /action-log with missing required fields returns error"
RESP=$(http_post "/action-log" "{\"deviceId\":\"$DEV_UV_ROBOT\"}")
ERR=$(echo "$RESP" | jq -r '.error // empty')

if [ -n "$ERR" ]; then
  _pass "Error returned for missing fields: $ERR"
else
  _fail "Expected error for missing fields" "$RESP"
fi

# 13.5: POST /action-log with invalid result value -> error
_log_test "POST /action-log with invalid result value returns error"
RESP=$(http_post "/action-log" "{\"deviceId\":\"$DEV_UV_ROBOT\",\"commandId\":\"$CMD_ID_LOG\",\"action\":\"test\",\"result\":\"invalid_value\"}")
ERR=$(echo "$RESP" | jq -r '.error // empty')

if [ -n "$ERR" ]; then
  _pass "Error returned for invalid result: $ERR"
else
  _fail "Expected error for invalid result" "$RESP"
fi

# 13.6: OPTIONS /action-log returns 204
_log_test "OPTIONS /action-log returns CORS 204"
CORS_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "${SITE_URL}/action-log" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST")

if [ "$CORS_RESP" = "204" ]; then
  _pass "OPTIONS /action-log returned 204"
else
  _fail "OPTIONS status code wrong" "expected 204, got $CORS_RESP"
fi

###############################################################################
# Summary
###############################################################################

echo ""
echo "========================================================================"
echo "  TEST RESULTS"
echo "========================================================================"
echo ""
echo "  Tests     : $TOTAL"
echo "  Assertions: $ASSERTIONS  (passed: $PASS, failed: $FAIL)"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "  ALL TESTS PASSED"
  echo ""
  exit 0
else
  echo "  SOME TESTS FAILED"
  echo ""
  exit 1
fi
