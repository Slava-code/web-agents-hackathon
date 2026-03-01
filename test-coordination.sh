#!/usr/bin/env bash
#
# End-to-end tests for the Agent Coordination Layer.
# Tests resource locks, agent messages, task graph, full scenario flow,
# coordination state, anomaly resolution, and validation.
#
# Requirements: curl, jq, npx (with convex installed)
#
# Usage:  ./test-coordination.sh
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

convex_run() {
  local fn="$1"
  shift
  if [ $# -gt 0 ]; then
    npx --yes convex run "$fn" "$@" 2>/dev/null
  else
    npx --yes convex run "$fn" 2>/dev/null
  fi
}

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

settle() {
  sleep 1.5
}

###############################################################################
# Phase 0 — Discover seed data & reset coordination
###############################################################################

_log_header "PHASE 0: Setup — Discover seed data & reset coordination"

echo "  Fetching rooms..."
ROOMS_JSON=$(convex_run "rooms:list")

ROOM_ID=$(echo "$ROOMS_JSON" | jq -r '.[] | select(.name == "OR-3") | ._id')
if [ -z "$ROOM_ID" ] || [ "$ROOM_ID" = "null" ]; then
  echo "FATAL: Could not find room OR-3. Is seed data loaded?"
  exit 1
fi
echo "  Room OR-3 ID = $ROOM_ID"

# Fetch room state to get device IDs
ROOM_STATE=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")

DEV_UV_ROBOT=$(echo "$ROOM_STATE" | jq -r '.devices[] | select(.name == "UV Robot") | ._id')
DEV_TUG_FLEET=$(echo "$ROOM_STATE" | jq -r '.devices[] | select(.name == "TUG Fleet Monitor") | ._id')
DEV_ENV_MON=$(echo "$ROOM_STATE" | jq -r '.devices[] | select(.name == "Environmental Monitoring") | ._id')
DEV_SCHEDULING=$(echo "$ROOM_STATE" | jq -r '.devices[] | select(.name == "Room Scheduling") | ._id')

echo "  UV Robot               = $DEV_UV_ROBOT"
echo "  TUG Fleet Monitor      = $DEV_TUG_FLEET"
echo "  Environmental Monitor  = $DEV_ENV_MON"
echo "  Room Scheduling        = $DEV_SCHEDULING"

ALL_DEVICE_IDS=("$DEV_UV_ROBOT" "$DEV_TUG_FLEET" "$DEV_ENV_MON" "$DEV_SCHEDULING")

# Reset coordination data
echo "  Resetting coordination tables..."
http_post "/coordination-reset" "{}" >/dev/null
settle

# Reset devices to idle
echo "  Resetting all devices to idle..."
for did in "${ALL_DEVICE_IDS[@]}"; do
  http_post "/device-update" "{\"deviceId\":\"$did\",\"status\":\"idle\"}" >/dev/null
done
settle

# Cleanup on exit
cleanup() {
  echo ""
  echo "--- CLEANUP: Resetting coordination + devices ---"
  http_post "/coordination-reset" "{}" >/dev/null 2>&1
  for did in "${ALL_DEVICE_IDS[@]}"; do
    http_post "/device-update" "{\"deviceId\":\"$did\",\"status\":\"idle\"}" >/dev/null 2>&1
  done
  # Also resolve any leftover anomaly
  http_post "/resolve-anomaly" "{\"roomId\":\"$ROOM_ID\"}" >/dev/null 2>&1
  settle
  echo "  Cleanup complete."
}
trap cleanup EXIT

###############################################################################
# SECTION 1 — Resource Locks (6 tests)
###############################################################################

_log_header "SECTION 1: Resource Locks"

# Test 1: Agent claims device → lock granted
_log_test "Agent claims device → lock granted"
RESP=$(http_post "/agent-claim" "{\"agentId\":\"env-agent\",\"resourceType\":\"device\",\"resourceId\":\"$DEV_ENV_MON\",\"action\":\"Assessing readings\"}")
OK=$(echo "$RESP" | jq -r '.ok')
LOCK_ID=$(echo "$RESP" | jq -r '.lockId')
if [ "$OK" = "true" ] && [ -n "$LOCK_ID" ] && [ "$LOCK_ID" != "null" ]; then
  _pass "Lock granted, lockId=$LOCK_ID"
else
  _fail "Lock not granted" "$RESP"
fi

# Test 2: Same agent re-claims → idempotent
_log_test "Same agent re-claims → idempotent"
RESP=$(http_post "/agent-claim" "{\"agentId\":\"env-agent\",\"resourceType\":\"device\",\"resourceId\":\"$DEV_ENV_MON\",\"action\":\"Assessing readings\"}")
OK=$(echo "$RESP" | jq -r '.ok')
IDEMP=$(echo "$RESP" | jq -r '.idempotent // false')
if [ "$OK" = "true" ] && [ "$IDEMP" = "true" ]; then
  _pass "Idempotent re-claim ok"
else
  _fail "Re-claim not idempotent" "$RESP"
fi

# Test 3: Different agent claims same device → blocked
_log_test "Different agent claims same device → blocked"
RESP=$(http_post "/agent-claim" "{\"agentId\":\"tug-agent\",\"resourceType\":\"device\",\"resourceId\":\"$DEV_ENV_MON\",\"action\":\"Trying to access\"}")
OK=$(echo "$RESP" | jq -r '.ok')
HELD_BY=$(echo "$RESP" | jq -r '.heldBy // empty')
if [ "$OK" = "false" ] && [ "$HELD_BY" = "env-agent" ]; then
  _pass "Blocked, heldBy=env-agent"
else
  _fail "Should be blocked" "$RESP"
fi

# Test 4: First agent releases → ok
_log_test "First agent releases lock → ok"
RESP=$(http_post "/agent-release" "{\"agentId\":\"env-agent\",\"resourceId\":\"$DEV_ENV_MON\"}")
OK=$(echo "$RESP" | jq -r '.ok')
if [ "$OK" = "true" ]; then
  _pass "Lock released"
else
  _fail "Release failed" "$RESP"
fi

# Test 5: Second agent can now claim → ok
_log_test "Second agent can now claim → ok"
RESP=$(http_post "/agent-claim" "{\"agentId\":\"tug-agent\",\"resourceType\":\"device\",\"resourceId\":\"$DEV_ENV_MON\",\"action\":\"Now my turn\"}")
OK=$(echo "$RESP" | jq -r '.ok')
if [ "$OK" = "true" ]; then
  _pass "Second agent claimed successfully"
else
  _fail "Second agent claim failed" "$RESP"
fi

# Test 6: Agent can't release another's lock → error
_log_test "Agent can't release another's lock → error"
RESP=$(http_post "/agent-release" "{\"agentId\":\"env-agent\",\"resourceId\":\"$DEV_ENV_MON\"}")
OK=$(echo "$RESP" | jq -r '.ok')
ERR=$(echo "$RESP" | jq -r '.error // empty')
if [ "$OK" = "false" ] && [ "$ERR" = "not_owner" ]; then
  _pass "Correctly rejected: not_owner"
else
  _fail "Should have rejected" "$RESP"
fi

# Clean up lock
http_post "/agent-release" "{\"agentId\":\"tug-agent\",\"resourceId\":\"$DEV_ENV_MON\"}" >/dev/null

###############################################################################
# SECTION 2 — Agent Messages (4 tests)
###############################################################################

_log_header "SECTION 2: Agent Messages"

# Test 7: Post broadcast message → ok, messageId
_log_test "Post broadcast message → ok, messageId"
RESP=$(http_post "/agent-message" "{\"fromAgent\":\"env-agent\",\"type\":\"alert\",\"payload\":{\"message\":\"5 readings out of range\"},\"roomId\":\"$ROOM_ID\"}")
OK=$(echo "$RESP" | jq -r '.ok')
MSG_ID=$(echo "$RESP" | jq -r '.messageId')
if [ "$OK" = "true" ] && [ -n "$MSG_ID" ] && [ "$MSG_ID" != "null" ]; then
  _pass "Broadcast message sent, id=$MSG_ID"
else
  _fail "Broadcast message failed" "$RESP"
fi
BROADCAST_TS=$(date +%s)000  # rough timestamp for "since" test

settle

# Test 8: Post directed message → ok
_log_test "Post directed message → ok"
RESP=$(http_post "/agent-message" "{\"fromAgent\":\"env-agent\",\"toAgent\":\"tug-agent\",\"type\":\"request\",\"payload\":{\"need\":\"HEPA filters\"},\"roomId\":\"$ROOM_ID\"}")
OK=$(echo "$RESP" | jq -r '.ok')
if [ "$OK" = "true" ]; then
  _pass "Directed message sent"
else
  _fail "Directed message failed" "$RESP"
fi

settle

# Test 9: Poll for target agent → sees directed + broadcast
_log_test "Poll for tug-agent → sees directed + broadcast"
RESP=$(http_get "${SITE_URL}/agent-messages?agentId=tug-agent&roomId=${ROOM_ID}")
MSG_COUNT=$(echo "$RESP" | jq '.messages | length')
if [ "$MSG_COUNT" -ge 2 ]; then
  _pass "tug-agent sees $MSG_COUNT messages (broadcast + directed)"
else
  _fail "Expected >= 2 messages" "got $MSG_COUNT: $RESP"
fi

# Test 10: Poll with since filter → only new messages
_log_test "Poll with since filter → only new messages"
# Post a new message
http_post "/agent-message" "{\"fromAgent\":\"tug-agent\",\"type\":\"response\",\"payload\":{\"status\":\"dispatching\"},\"roomId\":\"$ROOM_ID\"}" >/dev/null
settle

# Get messages since now - use a recent timestamp
SINCE_TS=$(($(date +%s) * 1000 - 5000))
RESP=$(http_get "${SITE_URL}/agent-messages?agentId=tug-agent&roomId=${ROOM_ID}&since=${SINCE_TS}")
MSG_COUNT=$(echo "$RESP" | jq '.messages | length')
if [ "$MSG_COUNT" -ge 1 ]; then
  _pass "since filter returned $MSG_COUNT recent message(s)"
else
  _fail "since filter returned no messages" "$RESP"
fi

###############################################################################
# SECTION 3 — Task Graph (6 tests)
###############################################################################

_log_header "SECTION 3: Task Graph"

# Reset coordination first
http_post "/coordination-reset" "{}" >/dev/null
settle

# Use a unique command ID
CMD_ID="test-cmd-$(date +%s)"

# Test 11: POST /coordination-start → 4 tasks created
_log_test "POST /coordination-start → 4 tasks created"
RESP=$(http_post "/coordination-start" "{\"commandId\":\"$CMD_ID\",\"roomId\":\"$ROOM_ID\"}")
OK=$(echo "$RESP" | jq -r '.ok')
TASK_COUNT=$(echo "$RESP" | jq -r '.taskCount')
ENV_TASK_ID=$(echo "$RESP" | jq -r '.tasks.env')
TUG_TASK_ID=$(echo "$RESP" | jq -r '.tasks.tug')
UV_TASK_ID=$(echo "$RESP" | jq -r '.tasks.uv')
EHR_TASK_ID=$(echo "$RESP" | jq -r '.tasks.ehr')

if [ "$OK" = "true" ] && [ "$TASK_COUNT" = "4" ]; then
  _pass "4 tasks created (env=$ENV_TASK_ID)"
else
  _fail "Scenario creation failed" "$RESP"
fi

settle

# Test 12: ENV task (phase 1) is "ready", TUG/UV/EHR are "pending"
_log_test "ENV task is ready, TUG/UV/EHR are pending"
GRAPH=$(convex_run "taskGraph:getTaskGraph" "{\"commandId\":\"$CMD_ID\"}")
ENV_STATUS=$(echo "$GRAPH" | jq -r '.tasks[] | select(.phase == 1) | .status')
TUG_STATUS=$(echo "$GRAPH" | jq -r '.tasks[] | select(.phase == 2) | .status')
UV_STATUS=$(echo "$GRAPH" | jq -r '.tasks[] | select(.phase == 3) | .status')
EHR_STATUS=$(echo "$GRAPH" | jq -r '.tasks[] | select(.phase == 4) | .status')

if [ "$ENV_STATUS" = "ready" ] && [ "$TUG_STATUS" = "pending" ] && [ "$UV_STATUS" = "pending" ] && [ "$EHR_STATUS" = "pending" ]; then
  _pass "ENV=ready, TUG=pending, UV=pending, EHR=pending"
else
  _fail "Wrong statuses" "ENV=$ENV_STATUS TUG=$TUG_STATUS UV=$UV_STATUS EHR=$EHR_STATUS"
fi

# Test 13: GET /agent-next-task for env-agent → ENV task
_log_test "GET /agent-next-task for env-agent → ENV task"
RESP=$(http_get "${SITE_URL}/agent-next-task?agentId=env-agent&commandId=${CMD_ID}")
TASK_NAME=$(echo "$RESP" | jq -r '.task.taskName // empty')
WAITING=$(echo "$RESP" | jq -r '.waiting')
if [ "$TASK_NAME" = "ENV Detect & Assess Anomaly" ] && [ "$WAITING" = "false" ]; then
  _pass "env-agent gets ENV task"
else
  _fail "env-agent didn't get ENV task" "$RESP"
fi

# Test 14: GET /agent-next-task for tug-agent → waiting, blocked by ENV
_log_test "GET /agent-next-task for tug-agent → waiting, blocked by ENV"
RESP=$(http_get "${SITE_URL}/agent-next-task?agentId=tug-agent&commandId=${CMD_ID}")
WAITING=$(echo "$RESP" | jq -r '.waiting')
BLOCKER=$(echo "$RESP" | jq -r '.blockedBy[0].agentId // empty')
if [ "$WAITING" = "true" ] && [ "$BLOCKER" = "env-agent" ]; then
  _pass "tug-agent is waiting, blocked by env-agent"
else
  _fail "tug-agent should be waiting" "$RESP"
fi

# Test 15: Complete ENV task → TUG unblocked
_log_test "Complete ENV task → TUG unblocked"
# First set ENV to running
http_post "/agent-task-update" "{\"taskId\":\"$ENV_TASK_ID\",\"status\":\"running\"}" >/dev/null
settle
# Then complete it
RESP=$(http_post "/agent-task-update" "{\"taskId\":\"$ENV_TASK_ID\",\"status\":\"completed\",\"output\":{\"alertsAcknowledged\":5,\"assessment\":\"critical\"}}")
OK=$(echo "$RESP" | jq -r '.ok')
UNBLOCKED=$(echo "$RESP" | jq -r '.unblockedTasks | length')
if [ "$OK" = "true" ] && [ "$UNBLOCKED" -ge 1 ]; then
  _pass "ENV completed, $UNBLOCKED task(s) unblocked"
else
  _fail "ENV completion failed or no unblocking" "$RESP"
fi

settle

# Verify TUG is now ready
RESP=$(http_get "${SITE_URL}/agent-next-task?agentId=tug-agent&commandId=${CMD_ID}")
TASK_NAME=$(echo "$RESP" | jq -r '.task.taskName // empty')
if [ "$TASK_NAME" = "TUG Emergency Supply Delivery" ]; then
  _pass "TUG task is now ready"
else
  _fail "TUG task not ready after ENV completion" "$RESP"
fi

# Test 16: Cannot complete a "pending" task → error
_log_test "Cannot complete a pending task → error"
RESP=$(http_post "/agent-task-update" "{\"taskId\":\"$UV_TASK_ID\",\"status\":\"completed\"}")
ERR=$(echo "$RESP" | jq -r '.error // empty')
if [ -n "$ERR" ]; then
  _pass "Correctly rejected: $ERR"
else
  _fail "Should have rejected completing a pending task" "$RESP"
fi

###############################################################################
# SECTION 4 — Full Scenario w/ Anomaly + Unity + Resolution (11 tests)
###############################################################################

_log_header "SECTION 4: Full Scenario — Anomaly → 4 Agents → Resolution"

# Reset everything
http_post "/coordination-reset" "{}" >/dev/null
for did in "${ALL_DEVICE_IDS[@]}"; do
  http_post "/device-update" "{\"deviceId\":\"$did\",\"status\":\"idle\"}" >/dev/null
done
settle

CMD_ID2="scenario-$(date +%s)"

# Test 17: Trigger anomaly (ventilation_failure) → room "needs_attention"
_log_test "Trigger anomaly → room needs_attention"
RESP=$(http_post "/trigger-anomaly" "{\"roomId\":\"$ROOM_ID\",\"scenario\":\"ventilation_failure\"}")
OK=$(echo "$RESP" | jq -r '.ok')
settle
ROOM_STATE=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
RSTATUS=$(echo "$ROOM_STATE" | jq -r '.room.status')
if [ "$OK" = "true" ] && [ "$RSTATUS" = "needs_attention" ]; then
  _pass "Anomaly triggered, room=needs_attention"
else
  _fail "Anomaly trigger failed" "ok=$OK, status=$RSTATUS"
fi

# Test 18: Start coordination → ENV agent gets first task
_log_test "Start coordination → ENV agent gets first task"
RESP=$(http_post "/coordination-start" "{\"commandId\":\"$CMD_ID2\",\"roomId\":\"$ROOM_ID\"}")
OK=$(echo "$RESP" | jq -r '.ok')
ENV_TASK2=$(echo "$RESP" | jq -r '.tasks.env')
TUG_TASK2=$(echo "$RESP" | jq -r '.tasks.tug')
UV_TASK2=$(echo "$RESP" | jq -r '.tasks.uv')
EHR_TASK2=$(echo "$RESP" | jq -r '.tasks.ehr')
settle

RESP=$(http_get "${SITE_URL}/agent-next-task?agentId=env-agent&commandId=${CMD_ID2}")
TASK_STATUS=$(echo "$RESP" | jq -r '.task.status // empty')
if [ "$OK" = "true" ] && [ "$TASK_STATUS" = "ready" ]; then
  _pass "ENV agent has ready task"
else
  _fail "ENV agent should have ready task" "ok=$OK, status=$TASK_STATUS"
fi

# Test 19: ENV claims device + completes → TUG unblocks
_log_test "ENV claims + completes → TUG unblocks"
http_post "/agent-claim" "{\"agentId\":\"env-agent\",\"resourceType\":\"device\",\"resourceId\":\"$DEV_ENV_MON\",\"action\":\"Assessing anomaly readings\"}" >/dev/null
http_post "/agent-task-update" "{\"taskId\":\"$ENV_TASK2\",\"status\":\"running\"}" >/dev/null
http_post "/agent-message" "{\"fromAgent\":\"env-agent\",\"type\":\"alert\",\"payload\":{\"assessment\":\"5 readings critical\"},\"roomId\":\"$ROOM_ID\"}" >/dev/null
settle
RESP=$(http_post "/agent-task-update" "{\"taskId\":\"$ENV_TASK2\",\"status\":\"completed\",\"output\":{\"alertsAcknowledged\":5}}")
http_post "/agent-release" "{\"agentId\":\"env-agent\",\"resourceId\":\"$DEV_ENV_MON\"}" >/dev/null
settle

RESP=$(http_get "${SITE_URL}/agent-next-task?agentId=tug-agent&commandId=${CMD_ID2}")
TUG_READY=$(echo "$RESP" | jq -r '.task.status // empty')
if [ "$TUG_READY" = "ready" ]; then
  _pass "TUG unblocked after ENV completed"
else
  _fail "TUG should be ready" "$RESP"
fi

# Test 20: TUG claims device + completes → UV unblocks
_log_test "TUG claims + completes → UV unblocks"
http_post "/agent-claim" "{\"agentId\":\"tug-agent\",\"resourceType\":\"device\",\"resourceId\":\"$DEV_TUG_FLEET\",\"action\":\"Delivering HEPA filters\"}" >/dev/null
http_post "/agent-task-update" "{\"taskId\":\"$TUG_TASK2\",\"status\":\"running\"}" >/dev/null
settle
RESP=$(http_post "/agent-task-update" "{\"taskId\":\"$TUG_TASK2\",\"status\":\"completed\",\"output\":{\"delivered\":true,\"supplies\":[\"HEPA filters\",\"air sensors\"]}}")
http_post "/agent-release" "{\"agentId\":\"tug-agent\",\"resourceId\":\"$DEV_TUG_FLEET\"}" >/dev/null
http_post "/agent-message" "{\"fromAgent\":\"tug-agent\",\"type\":\"release\",\"payload\":{\"delivered\":true},\"roomId\":\"$ROOM_ID\"}" >/dev/null
settle

RESP=$(http_get "${SITE_URL}/agent-next-task?agentId=uv-agent&commandId=${CMD_ID2}")
UV_READY=$(echo "$RESP" | jq -r '.task.status // empty')
if [ "$UV_READY" = "ready" ]; then
  _pass "UV unblocked after TUG completed"
else
  _fail "UV should be ready" "$RESP"
fi

# Test 21: UV claims room lock (exclusive) + completes → EHR unblocks
_log_test "UV claims room + device + completes → EHR unblocks"
http_post "/agent-claim" "{\"agentId\":\"uv-agent\",\"resourceType\":\"room\",\"resourceId\":\"$ROOM_ID\",\"action\":\"UV sterilization in progress\"}" >/dev/null
http_post "/agent-claim" "{\"agentId\":\"uv-agent\",\"resourceType\":\"device\",\"resourceId\":\"$DEV_UV_ROBOT\",\"action\":\"Terminal sterilization cycle\"}" >/dev/null
http_post "/agent-task-update" "{\"taskId\":\"$UV_TASK2\",\"status\":\"running\"}" >/dev/null
settle
RESP=$(http_post "/agent-task-update" "{\"taskId\":\"$UV_TASK2\",\"status\":\"completed\",\"output\":{\"sterilized\":true,\"mode\":\"terminal\"}}")
http_post "/agent-release" "{\"agentId\":\"uv-agent\",\"resourceId\":\"$ROOM_ID\"}" >/dev/null
http_post "/agent-release" "{\"agentId\":\"uv-agent\",\"resourceId\":\"$DEV_UV_ROBOT\"}" >/dev/null
http_post "/agent-message" "{\"fromAgent\":\"uv-agent\",\"type\":\"release\",\"payload\":{\"sterilized\":true},\"roomId\":\"$ROOM_ID\"}" >/dev/null
settle

RESP=$(http_get "${SITE_URL}/agent-next-task?agentId=ehr-agent&commandId=${CMD_ID2}")
EHR_READY=$(echo "$RESP" | jq -r '.task.status // empty')
if [ "$EHR_READY" = "ready" ]; then
  _pass "EHR unblocked after UV completed"
else
  _fail "EHR should be ready" "$RESP"
fi

# Test 22: EHR completes → getTaskGraph shows allDone=true
_log_test "EHR completes → allDone=true"
http_post "/agent-task-update" "{\"taskId\":\"$EHR_TASK2\",\"status\":\"running\"}" >/dev/null
settle
RESP=$(http_post "/agent-task-update" "{\"taskId\":\"$EHR_TASK2\",\"status\":\"completed\",\"output\":{\"roomStatus\":\"Ready\",\"delayMinutes\":0}}")
ALL_DONE=$(echo "$RESP" | jq -r '.allDone // false')
settle

GRAPH=$(convex_run "taskGraph:getTaskGraph" "{\"commandId\":\"$CMD_ID2\"}")
GRAPH_ALL_DONE=$(echo "$GRAPH" | jq -r '.allDone')
COMPLETED_COUNT=$(echo "$GRAPH" | jq -r '.progress.completed')

if [ "$ALL_DONE" = "true" ] && [ "$GRAPH_ALL_DONE" = "true" ] && [ "$COMPLETED_COUNT" = "4" ]; then
  _pass "All 4 tasks completed, allDone=true"
else
  _fail "allDone should be true" "allDone=$ALL_DONE, graphAllDone=$GRAPH_ALL_DONE, completed=$COMPLETED_COUNT"
fi

# Test 23: All locks released
_log_test "All locks released"
# We released all locks manually above, verify no held locks
RESP=$(http_get "${SITE_URL}/coordination-state?roomId=${ROOM_ID}")
LOCK_COUNT=$(echo "$RESP" | jq '.locks | length')
if [ "$LOCK_COUNT" -eq 0 ]; then
  _pass "No held locks remaining"
else
  _fail "Expected 0 locks" "got $LOCK_COUNT"
fi

# Test 24: Messages posted at each phase visible via /agent-messages
_log_test "Messages visible via /agent-messages"
RESP=$(http_get "${SITE_URL}/agent-messages?agentId=broadcast&roomId=${ROOM_ID}")
MSG_COUNT=$(echo "$RESP" | jq '.messages | length')
if [ "$MSG_COUNT" -ge 3 ]; then
  _pass "$MSG_COUNT messages visible (env alert + tug release + uv release + others)"
else
  _fail "Expected >= 3 messages" "got $MSG_COUNT"
fi

# Test 25: GET /coordination-state mid-scenario check
# We already completed, but let's verify the state reflects completed scenario
_log_test "GET /coordination-state shows correct structure"
RESP=$(http_get "${SITE_URL}/coordination-state?roomId=${ROOM_ID}")
SCENARIO=$(echo "$RESP" | jq -r '.activeScenario')
PROGRESS_TOTAL=$(echo "$RESP" | jq -r '.progress.total')
if [ "$SCENARIO" = "emergency_air_quality_response" ] && [ "$PROGRESS_TOTAL" = "4" ]; then
  _pass "Coordination state has correct scenario and 4 tasks"
else
  _fail "Coordination state wrong" "scenario=$SCENARIO, total=$PROGRESS_TOTAL"
fi

# Test 26: GET /coordination-state after all done → allDone=true
_log_test "GET /coordination-state after all done → allDone=true"
RESP=$(http_get "${SITE_URL}/coordination-state?roomId=${ROOM_ID}")
STATE_ALL_DONE=$(echo "$RESP" | jq -r '.allDone')
COMPLETED=$(echo "$RESP" | jq -r '.progress.completed')
if [ "$STATE_ALL_DONE" = "true" ] && [ "$COMPLETED" = "4" ]; then
  _pass "allDone=true, completed=4"
else
  _fail "Should show allDone=true" "allDone=$STATE_ALL_DONE, completed=$COMPLETED"
fi

# Test 27: After allDone, anomaly auto-resolved → env readings safe, room ready
_log_test "Anomaly auto-resolved → safe readings, room=ready"
settle
ROOM_STATE=$(http_get "${SITE_URL}/room-state?roomId=${ROOM_ID}")
RSTATUS=$(echo "$ROOM_STATE" | jq -r '.room.status')
ENV_CO2=$(echo "$ROOM_STATE" | jq -r '.devices[] | select(.name == "Environmental Monitoring") | .fields.co2')
ENV_RISK=$(echo "$ROOM_STATE" | jq -r '.devices[] | select(.name == "Environmental Monitoring") | .fields.riskLevel')
ENV_ALL_OK=$(echo "$ROOM_STATE" | jq -r '.devices[] | select(.name == "Environmental Monitoring") | .fields.allWithinRange')

if [ "$RSTATUS" = "ready" ] && [ "$ENV_CO2" = "450" ] && [ "$ENV_RISK" = "normal" ] && [ "$ENV_ALL_OK" = "true" ]; then
  _pass "Room=ready, CO2=450, riskLevel=normal, allWithinRange=true"
else
  _fail "Anomaly not resolved" "status=$RSTATUS, co2=$ENV_CO2, risk=$ENV_RISK, allOk=$ENV_ALL_OK"
fi

###############################################################################
# SECTION 5 — Validation (4 tests)
###############################################################################

_log_header "SECTION 5: Validation"

# Test 28: /agent-claim missing fields → 400
_log_test "/agent-claim missing fields → 400"
RESP=$(http_post "/agent-claim" "{\"agentId\":\"test\"}")
ERR=$(echo "$RESP" | jq -r '.error // empty')
if [ -n "$ERR" ]; then
  _pass "Validation error: $ERR"
else
  _fail "Expected validation error" "$RESP"
fi

# Test 29: /agent-message invalid type → 400
_log_test "/agent-message invalid type → 400"
RESP=$(http_post "/agent-message" "{\"fromAgent\":\"test\",\"type\":\"invalid_type\",\"payload\":{},\"roomId\":\"$ROOM_ID\"}")
ERR=$(echo "$RESP" | jq -r '.error // empty')
if [ -n "$ERR" ]; then
  _pass "Validation error: $ERR"
else
  _fail "Expected validation error for invalid type" "$RESP"
fi

# Test 30: /agent-task-update invalid status → 400
_log_test "/agent-task-update invalid status → 400"
RESP=$(http_post "/agent-task-update" "{\"taskId\":\"fake-id\",\"status\":\"invalid_status\"}")
ERR=$(echo "$RESP" | jq -r '.error // empty')
if [ -n "$ERR" ]; then
  _pass "Validation error: $ERR"
else
  _fail "Expected validation error for invalid status" "$RESP"
fi

# Test 31: /coordination-start invalid scenario → 400
_log_test "/coordination-start invalid scenario → 400"
RESP=$(http_post "/coordination-start" "{\"commandId\":\"test\",\"roomId\":\"$ROOM_ID\",\"scenario\":\"fake_scenario\"}")
ERR=$(echo "$RESP" | jq -r '.error // empty')
if [ -n "$ERR" ]; then
  _pass "Validation error: $ERR"
else
  _fail "Expected validation error for invalid scenario" "$RESP"
fi

###############################################################################
# SECTION 6 — BrowserUse Smoke Test (1 test)
###############################################################################

_log_header "SECTION 6: BrowserUse Smoke Test"

# Load API key from .env.local
BU_API_KEY=""
if [ -f "${PROJECT_DIR}/.env.local" ]; then
  BU_API_KEY=$(grep -E '^BROWSER_USE_API_KEY=' "${PROJECT_DIR}/.env.local" | cut -d'=' -f2- | tr -d '[:space:]')
fi

if [ -z "$BU_API_KEY" ]; then
  echo "  [WARN] BROWSER_USE_API_KEY not found in .env.local — SKIPPING BrowserUse test"
  TOTAL=$((TOTAL + 1))
  _pass "SKIPPED (no API key)"
else

  BU_API="https://api.browser-use.com/api/v3"

  # Test 32: BrowserUse Smoke Test — create session, poll, verify, cleanup
  _log_test "BrowserUse Smoke Test"

  # Step 1: Claim a device lock for env-agent on the Environmental Monitoring device
  BU_CLAIM_RESP=$(http_post "/agent-claim" "{\"agentId\":\"env-agent\",\"resourceType\":\"device\",\"resourceId\":\"$DEV_ENV_MON\",\"action\":\"BrowserUse smoke test\"}")
  BU_CLAIM_OK=$(echo "$BU_CLAIM_RESP" | jq -r '.ok')
  if [ "$BU_CLAIM_OK" != "true" ]; then
    _fail "BrowserUse smoke test — could not claim device lock" "$BU_CLAIM_RESP"
  else

    # Step 2: Create a BrowserUse session
    BU_TASK="Go to ${SITE_URL}/room-state?roomId=${ROOM_ID} and extract the room name from the JSON response"
    BU_CREATE_RESP=$(curl -s -X POST "${BU_API}/sessions" \
      -H "Content-Type: application/json" \
      -H "X-Browser-Use-API-Key: ${BU_API_KEY}" \
      -d "{\"task\":$(echo "$BU_TASK" | jq -Rs .),\"model\":\"bu-mini\"}")

    BU_SESSION_ID=$(echo "$BU_CREATE_RESP" | jq -r '.id // empty')

    if [ -z "$BU_SESSION_ID" ] || [ "$BU_SESSION_ID" = "null" ]; then
      _fail "BrowserUse smoke test — session creation failed" "$BU_CREATE_RESP"
    else
      echo "  Session created: $BU_SESSION_ID"

      # Step 3: Poll until terminal status (max 60s, every 3s)
      BU_ELAPSED=0
      BU_MAX_WAIT=60
      BU_STATUS=""
      BU_OUTPUT=""
      while [ "$BU_ELAPSED" -lt "$BU_MAX_WAIT" ]; do
        sleep 3
        BU_ELAPSED=$((BU_ELAPSED + 3))

        BU_POLL_RESP=$(curl -s -X GET "${BU_API}/sessions/${BU_SESSION_ID}" \
          -H "X-Browser-Use-API-Key: ${BU_API_KEY}")

        BU_STATUS=$(echo "$BU_POLL_RESP" | jq -r '.status // empty')
        echo "  Poll ${BU_ELAPSED}s — status: $BU_STATUS"

        # Check for terminal statuses: idle, stopped, timed_out, error
        case "$BU_STATUS" in
          idle|stopped|timed_out|error) break ;;
        esac
      done

      BU_OUTPUT=$(echo "$BU_POLL_RESP" | jq -r '.output // empty')

      # Step 4: Verify the session completed successfully
      if [ "$BU_STATUS" = "idle" ] || [ "$BU_STATUS" = "stopped" ]; then
        if [ -n "$BU_OUTPUT" ] && [ "$BU_OUTPUT" != "null" ]; then
          _pass "BrowserUse session completed (status=$BU_STATUS) with output"
          echo "  Output (truncated): $(echo "$BU_OUTPUT" | head -c 200)"
        else
          _pass "BrowserUse session completed (status=$BU_STATUS) — no output but session succeeded"
        fi
      elif [ "$BU_STATUS" = "timed_out" ] || [ "$BU_STATUS" = "error" ]; then
        _fail "BrowserUse session ended with status=$BU_STATUS" "$BU_POLL_RESP"
      else
        _fail "BrowserUse session did not reach terminal status within ${BU_MAX_WAIT}s" "last status=$BU_STATUS"
      fi

      # Step 5: Stop the session to free resources
      curl -s -X POST "${BU_API}/sessions/${BU_SESSION_ID}/stop" \
        -H "X-Browser-Use-API-Key: ${BU_API_KEY}" >/dev/null 2>&1
      echo "  Session stopped."
    fi

    # Step 6: Release the device lock
    BU_RELEASE_RESP=$(http_post "/agent-release" "{\"agentId\":\"env-agent\",\"resourceId\":\"$DEV_ENV_MON\"}")
    BU_RELEASE_OK=$(echo "$BU_RELEASE_RESP" | jq -r '.ok')
    if [ "$BU_RELEASE_OK" = "true" ]; then
      echo "  Device lock released."
    else
      echo "  [WARN] Failed to release device lock: $BU_RELEASE_RESP"
    fi
  fi
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
