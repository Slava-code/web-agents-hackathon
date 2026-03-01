# BrowserUse Agent Architecture

## Overview

We use the **open-source `browser-use` library** (not the cloud SDK). It launches a real Chromium browser locally via Playwright, which can reach all device webUIs on the local network or localhost.

Each device in the OR gets its own BrowserUse agent with its own browser instance. The agent is responsible for:

1. Logging into the device's webUI
2. Understanding the DOM structure
3. Extracting relevant data fields
4. Writing efficient monitoring scripts
5. Controlling the device when instructed

---

## Auto-Login & Session Persistence

Each agent is given a URL and credentials (username/password, possibly multiple accounts if different users see different data). The agent:

- Navigates to the login page, fills credentials, submits
- Handles session expiry — if the page redirects to login or shows a "session expired" message, the agent detects this and re-authenticates automatically
- In production, credentials would be stored securely and scoped per-domain (similar to how 1Password vault integration works)

For the demo, we hardcode the login flow since we control the mock webUIs. In a real deployment, the agent figures out the login form on its own — it's a standard BrowserUse capability.

---

## Auto-Schema Inference (Production Vision)

In a real deployment, the agent would land on a webUI it has never seen before and:

1. **Scan the DOM** — identify all visible data fields (labels, values, units, status indicators)
2. **Classify each field** — using the LLM's understanding: "this is a temperature reading in Celsius," "this is a cycle status enum," "this is a percentage gauge"
3. **Generate a schema** — produce a structured definition of what fields exist, their types, and their semantic meaning
4. **Write the schema to Convex** — create or update the device's field definitions in the database
5. **Handle schema drift** — if the vendor updates their UI and fields move, appear, or disappear, the agent detects the structural change, re-infers the schema, and runs a migration on the Convex DB

This means deploying to a new clinic requires only: a list of URLs and login credentials. No custom integration code per vendor.

**For the hackathon demo:** We skip auto-inference and hardcode the schema for each device, since we already know what fields each mock webUI has. But we explain the auto-inference capability in the pitch.

---

## Three-Phase Monitoring

This is the core architecture for how agents watch device webUIs efficiently.

### Phase 1: Initial Read (Expensive, Runs Once)

The LLM-powered agent opens the webUI, reads the full DOM, and understands the page structure. It identifies:

- Where each data field lives in the DOM (CSS selectors, element IDs, XPaths)
- What each field represents semantically
- Which fields are dynamic (change over time) vs static

This is the only phase that requires LLM reasoning. It runs once per device (or again if the UI structure changes).

### Phase 2: Lightweight Monitoring (Cheap, Runs Continuously)

Based on what it learned in Phase 1, the agent **generates a monitoring script** — a lightweight Playwright/JS script that:

- Polls specific DOM elements on an interval, or uses a `MutationObserver` to detect changes
- Compares current values to previous values
- Writes changed values directly to the Convex database via HTTP
- Runs without any LLM involvement — pure deterministic code

This is extremely cheap (no LLM tokens) and fast (millisecond-level detection).

### Phase 3: Structural Change Detection (Rare, Triggered Automatically)

The monitoring script also watches for structural DOM changes — not just value changes, but elements moving, disappearing, or new elements appearing. When this happens:

- The lightweight script signals that the page structure has changed
- The LLM agent wakes up (back to Phase 1)
- It re-reads the DOM, updates its understanding
- Generates a new monitoring script
- If needed, runs a schema migration on the Convex DB
- Goes back to sleep (Phase 2 resumes)

This makes the system **self-healing** when vendors update their web interfaces.

---

## Agent-Generated Tool Calls

Beyond just reading data, BrowserUse agents can **control** devices by interacting with their webUIs (clicking buttons, filling forms, selecting options).

The key insight: once an agent has successfully performed an action on a webUI (e.g., clicked "Start Cycle" on the UV disinfection portal), it can:

1. **Record the interaction** — capture the exact sequence of DOM operations (selectors, click targets, form values)
2. **Abstract it into a reusable tool call** — save it as a named action with parameters, e.g., `start_uv_cycle(room_id, cycle_type)`
3. **Store the tool call definition** — persist it so future invocations skip the LLM reasoning entirely and execute the deterministic Playwright steps directly
4. **Fall back to LLM if the tool call fails** — if the saved selectors break (UI updated), the agent re-discovers the interaction using the LLM and generates an updated tool call

This creates a **learning system**: the first time the agent interacts with a webUI, it uses full LLM reasoning. Every subsequent time, it uses the cached tool call — faster, cheaper, and more reliable. If the UI changes, it self-heals by re-learning.

For the demo, we hardcode these interactions since we control the mock UIs. But the vision is that the system builds its own "API" for any web interface it encounters.

---

## Multi-Agent Orchestration

Each device gets its own independent agent + browser instance. They run in parallel:

- Agent 1 → UV Disinfection Portal (localhost:3001)
- Agent 2 → Environmental Sensors (localhost:3002)
- Agent 3 → Sterilizer/Autoclave (localhost:3003)
- Agent 4 → Room Scheduling (localhost:3004)
- Agent 5 → Surveillance Cameras (localhost:3005)

Coordination happens through Convex, not between agents directly. Each agent writes its device's status to the database via `POST /device-update` and `POST /field-update`. The Convex backend aggregates status across all devices to determine room readiness. The Unity simulation reads the same data via `GET /room-state` every 0.5s to animate robots accordingly.

---

## Environmental Decision Layer (Stretch Goal)

After all robots finish their tasks, a separate BrowserUse agent monitors the Environmental Dashboard — a webUI showing room conditions:

- Temperature
- Humidity
- Bacterial concentration
- CO2 content
- Oxygen level
- Other procedure-specific metrics

This agent doesn't just read values — it **reasons** about them:

1. Checks which values are within acceptable ranges for the specific procedure (e.g., orthopedic surgery has different requirements than cardiac surgery)
2. If one or more values are out of range, determines which device(s) or room systems to activate to fix the issue
3. Dispatches corrective actions — e.g., "humidity is 68%, needs to be below 60% for orthopedic → activate dehumidifier" or "send cleaning robot back for another pass in zone B"
4. Monitors until all values are within range
5. Only then does the room status change to "ready"

This is the most compelling part of the demo because it shows **AI reasoning and autonomous decision-making**, not just data syncing.

---

## What We Use (Open Source) vs Cloud API

| | `browser-use` (What We Use) | `browser-use-sdk` (Cloud API) |
|---|---|---|
| Install | `pip install browser-use` | `pip install browser-use-sdk` |
| Browser runs | Locally on your machine | In BrowserUse's cloud |
| Can reach localhost? | Yes | No |
| LLM | Your choice (Claude, GPT-4, Ollama) | `bu-mini` or `bu-max` only |
| Cost | Free (MIT) + LLM API costs | Pay-per-task |

We use open-source because our device webUIs are on the local network. Cloud browsers can't reach localhost.

---

## Latency

| Component | Latency |
|-----------|---------|
| LLM inference per step | ~1-3 seconds |
| Full BrowserUse action cycle | ~3 seconds per step |
| Generated monitoring script (Phase 2) | <100ms |
| Mock UI response | <100ms |

Phase 1 (LLM reasoning) is slow but runs rarely. Phase 2 (generated scripts) is fast and runs continuously. This is acceptable for supervisory control and room preparation — we are not doing real-time surgical control.
