#!/usr/bin/env bash
# ============================================================================
# DEMO SIMULATION SCRIPT (standalone backup)
# ============================================================================
# Timed Convex writes to drive Unity animations.
# The command center UI runs this same logic in-browser.
# This script is a backup if you need to run it from terminal instead.
#
# Usage:  ./scripts/demo-simulate.sh
# ============================================================================

set -euo pipefail

BASE_URL="https://impartial-whale-32.convex.site"
ROOM_ID="jn7ejjf7fv8pnq8vrp4qn79xwd8238x8"

# ── TIMING (edit to match your recorded videos) ─────────────────────────────
PHASE1_DURATION=24      # TUG deploy — 2s buffer + 20s video + 2s buffer
PHASE2_DURATION=24      # UV sterilize — 2s buffer + 20s video + 2s buffer
# ─────────────────────────────────────────────────────────────────────────────

echo "========================================="
echo " DEMO SIMULATION — Convex → Unity bridge"
echo "========================================="
echo ""

# Reset
echo "[0] Resetting previous scenario..."
curl -s -X POST "$BASE_URL/coordination-reset" > /dev/null
sleep 1

# Create prepare_room scenario (TUG → UV)
CMD_ID="cmd-demo-$(date +%s)"
echo "[1] Creating prepare_room scenario..."
RESULT=$(curl -s -X POST "$BASE_URL/coordination-start" \
  -H "Content-Type: application/json" \
  -d "{\"commandId\":\"$CMD_ID\",\"roomId\":\"$ROOM_ID\",\"scenario\":\"prepare_room\"}")

TUG_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['tasks']['tug'])")
UV_ID=$(echo "$RESULT"  | python3 -c "import sys,json; print(json.load(sys.stdin)['tasks']['uv'])")

echo "    TUG=$TUG_ID"
echo "    UV=$UV_ID"
echo ""

# ── PHASE 1: TUG ────────────────────────────────────────────────────────────
echo "[2] Phase 1 — TUG bot deploying to sterilization..."
curl -s -X POST "$BASE_URL/agent-task-update" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$TUG_ID\",\"status\":\"running\"}" > /dev/null

echo "    Unity sees: currentPhase=1, activeAgent=tug-agent"
echo "    Sleeping ${PHASE1_DURATION}s..."
sleep "$PHASE1_DURATION"

curl -s -X POST "$BASE_URL/agent-task-update" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$TUG_ID\",\"status\":\"completed\",\"output\":{\"deployed\":true,\"botName\":\"Alpha\",\"newStatus\":\"ARRIVED\"}}" > /dev/null

echo "    Phase 1 DONE. UV task promoted to ready."
echo ""

# ── PHASE 2: UV ─────────────────────────────────────────────────────────────
echo "[3] Phase 2 — UV sterilization cycle..."
curl -s -X POST "$BASE_URL/agent-task-update" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$UV_ID\",\"status\":\"running\"}" > /dev/null

echo "    Unity sees: currentPhase=2, activeAgent=uv-agent"
echo "    Sleeping ${PHASE2_DURATION}s..."
sleep "$PHASE2_DURATION"

curl -s -X POST "$BASE_URL/agent-task-update" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$UV_ID\",\"status\":\"completed\",\"output\":{\"sterilized\":true,\"mode\":\"standard\",\"targetRoom\":\"OR-3\"}}" > /dev/null

echo "    Phase 2 DONE."
echo ""

echo "========================================="
echo " ALL PHASES COMPLETE — allDone=true"
echo " OR-3 is ready for surgery."
echo "========================================="
