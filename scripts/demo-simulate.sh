#!/usr/bin/env bash
# ============================================================================
# DEMO SIMULATION SCRIPT
# ============================================================================
# This script fakes the BrowserUse agent orchestration by sleeping and
# updating Convex at timed intervals to drive Unity animations.
#
# Run this in the background when you "send" BrowserUse.
# It will advance phases in Convex so Unity sees the transitions.
#
# Usage:  ./scripts/demo-simulate.sh
# ============================================================================

set -euo pipefail

BASE_URL="https://impartial-whale-32.convex.site"
ROOM_ID="jn7bw19xt7a818kvh3w5dhxvvd823j8a"

# ── TIMING (edit these to match your recorded videos) ────────────────────────
PHASE1_DURATION=5       # ENV assess — no video, just a quick pass-through
PHASE2_DURATION=24      # TUG deploy — 2s buffer + 20s video + 2s buffer
PHASE3_DURATION=24      # UV sterilize — 2s buffer + 20s video + 2s buffer
PHASE4_DURATION=3       # EHR confirm — quick wrap-up
# ─────────────────────────────────────────────────────────────────────────────

echo "========================================="
echo " DEMO SIMULATION — Convex → Unity bridge"
echo "========================================="
echo ""

# Step 0: Reset any previous scenario
echo "[0] Resetting previous scenario..."
curl -s -X POST "$BASE_URL/coordination-reset" > /dev/null
sleep 1

# Step 1: Create the emergency scenario
CMD_ID="cmd-demo-$(date +%s)"
echo "[1] Creating emergency_air_quality_response scenario..."
RESULT=$(curl -s -X POST "$BASE_URL/coordination-start" \
  -H "Content-Type: application/json" \
  -d "{\"commandId\":\"$CMD_ID\",\"roomId\":\"$ROOM_ID\",\"scenario\":\"emergency_air_quality_response\"}")

ENV_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['tasks']['env'])")
TUG_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['tasks']['tug'])")
UV_ID=$(echo "$RESULT"  | python3 -c "import sys,json; print(json.load(sys.stdin)['tasks']['uv'])")
EHR_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['tasks']['ehr'])")

echo "    ENV=$ENV_ID"
echo "    TUG=$TUG_ID"
echo "    UV=$UV_ID"
echo "    EHR=$EHR_ID"
echo ""

# ── PHASE 1: ENV — Detect & Assess Anomaly ──────────────────────────────────
echo "[2] Phase 1 — ENV agent detecting anomaly..."
curl -s -X POST "$BASE_URL/agent-task-update" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$ENV_ID\",\"status\":\"running\"}" > /dev/null

echo "    Unity sees: currentPhase=1, activeAgent=env-agent"
echo "    Sleeping ${PHASE1_DURATION}s..."
sleep "$PHASE1_DURATION"

curl -s -X POST "$BASE_URL/agent-task-update" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$ENV_ID\",\"status\":\"completed\",\"output\":{\"alertsAcknowledged\":3,\"assessment\":\"Critical CO2 and particulate levels detected\",\"outOfRangeReadings\":[{\"field\":\"CO2\",\"value\":1200,\"allowedRange\":\"400-1000\"},{\"field\":\"particulate\",\"value\":85,\"allowedRange\":\"0-35\"}]}}" > /dev/null

echo "    Phase 1 DONE. TUG task promoted to ready."
echo ""

# ── PHASE 2: TUG — Emergency Supply Delivery ────────────────────────────────
echo "[3] Phase 2 — TUG agent delivering supplies..."
curl -s -X POST "$BASE_URL/agent-task-update" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$TUG_ID\",\"status\":\"running\"}" > /dev/null

echo "    Unity sees: currentPhase=2, activeAgent=tug-agent"
echo "    Sleeping ${PHASE2_DURATION}s (TUG video plays)..."
sleep "$PHASE2_DURATION"

curl -s -X POST "$BASE_URL/agent-task-update" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$TUG_ID\",\"status\":\"completed\",\"output\":{\"delivered\":true,\"botId\":\"TUG-01\",\"supplies\":[\"HEPA filters\",\"air quality sensors\",\"ventilation components\"]}}" > /dev/null

echo "    Phase 2 DONE. UV task promoted to ready."
echo ""

# ── PHASE 3: UV — Sterilization Cycle ───────────────────────────────────────
echo "[4] Phase 3 — UV agent running sterilization..."
curl -s -X POST "$BASE_URL/agent-task-update" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$UV_ID\",\"status\":\"running\"}" > /dev/null

echo "    Unity sees: currentPhase=3, activeAgent=uv-agent"
echo "    Sleeping ${PHASE3_DURATION}s (UV video plays)..."
sleep "$PHASE3_DURATION"

curl -s -X POST "$BASE_URL/agent-task-update" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$UV_ID\",\"status\":\"completed\",\"output\":{\"sterilized\":true,\"mode\":\"Terminal\",\"intensity\":100,\"cycleTime\":\"20s\"}}" > /dev/null

echo "    Phase 3 DONE. EHR task promoted to ready."
echo ""

# ── PHASE 4: EHR — Confirm Room Ready ───────────────────────────────────────
echo "[5] Phase 4 — EHR agent confirming room ready..."
curl -s -X POST "$BASE_URL/agent-task-update" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$EHR_ID\",\"status\":\"running\"}" > /dev/null

echo "    Unity sees: currentPhase=4, activeAgent=ehr-agent"
echo "    Sleeping ${PHASE4_DURATION}s..."
sleep "$PHASE4_DURATION"

curl -s -X POST "$BASE_URL/agent-task-update" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$EHR_ID\",\"status\":\"completed\",\"output\":{\"roomStatus\":\"Ready\",\"delayMinutes\":0,\"confirmed\":true}}" > /dev/null

echo "    Phase 4 DONE."
echo ""

echo "========================================="
echo " ALL PHASES COMPLETE — allDone=true"
echo " Unity should show scenario finished."
echo "========================================="
