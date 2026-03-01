# Hackathon Demo: Scenario & Strategy

## The Scenario: AI-Orchestrated OR Turnover

**Not "controlling a surgical robot" — instead: "AI-Orchestrated OR Turnover" — the $2.5M/year problem nobody has solved.**

A typical OR turnover involves devices from 3-5 different vendors, each with its own web dashboard. A surgical tech spends 25-60 minutes manually checking each one. OR time costs $22-$133 per minute (avg $62/min). A single OR running one extra case per day from faster turnover = $2.5M+ per year in recovered revenue.

**The key insight:** Every device in a modern OR already has a web-based interface. But they don't talk to each other because every vendor uses proprietary protocols. Our project doesn't need them to talk to each other — it just needs their web UIs.

---

## The 5 Devices

All devices are simulated mock web UIs built to replicate real vendor dashboards, running on localhost.

| # | Device | Mock URL | What the Agent Does |
|---|--------|----------|---------------------|
| 1 | UV Disinfection Robot | localhost:3001 | Checks cycle status, verifies room disinfected |
| 2 | Environmental Sensors | localhost:3002 | Runs compliance check, reads pass/fail results |
| 3 | Sterilizer/Autoclave | localhost:3003 | Selects procedure, verifies tray sterilization |
| 4 | Room Scheduling (EHR-style) | localhost:3004 | Checks next case, confirms turnover status |
| 5 | Surveillance Cameras | localhost:3005 | Checks room occupancy, captures verification snapshot |

**For the demo, we start with 1 robot** to prove the full end-to-end loop, then scale to all 5 if time allows.

---

## Demo vs Pitch: What We Build vs What We Explain

### What We Actually Build and Demo Live

- Hardcoded schema for each device (we know the fields)
- BrowserUse agent logs into webUI, reads field values, writes to Convex
- React dashboard shows device status cards updating in real-time
- Unity 3D simulation of the OR — robots animate in real-time based on Convex DB state (polled every 0.5s)
- Room status aggregation: all devices ready → room "ready"
- One natural language command triggers all agents in parallel
- At least 1 robot working end-to-end, ideally all 5

### What We Explain in the Pitch (But Don't Build)

- **Auto-schema inference** — agent lands on unknown webUI, scans DOM, infers field types, writes schema to Convex automatically. Deploy to any clinic with just URLs and logins.
- **Three-phase monitoring** — agent reads DOM once with LLM (expensive), generates lightweight monitoring script (cheap), script runs continuously without LLM. Agent only wakes when DOM structure changes.
- **Agent-generated tool calls** — when an agent successfully clicks a button or fills a form, it records the interaction and saves it as a reusable deterministic action. Next time, it replays the saved action without LLM reasoning. If the UI changes and the saved action breaks, it falls back to LLM, re-discovers the interaction, and saves a new version.
- **Environmental decision layer** — after all robots finish, an AI agent monitors environmental values (temperature, humidity, bacterial concentration, CO2, O2) and reasons about whether they're within acceptable ranges for the specific procedure. If not, it dispatches corrective actions to specific devices.
- **Self-healing on UI updates** — if a vendor pushes a webUI update, the monitoring script detects structural DOM changes, wakes the LLM agent, which re-infers the schema and generates new extraction scripts automatically.

---

## The Demo Script (3 Minutes + 1 Minute Q&A)

### Act 1: The Pain (0:00 - 1:00)

> "In 10 minutes, a patient is going to be wheeled into OR-3 for a knee replacement. Before that can happen, a surgical tech needs to verify five separate systems — each from a different vendor, each with its own interface."

Manually click through 5 mock vendor dashboards. Make it feel tedious. Mis-click once. Open the wrong tab.

> "That took me about a minute, and I knew exactly what to do. A traveling nurse on her first shift? Double that. Every minute the OR sits idle costs the hospital $62."

### Act 2: The Magic (1:00 - 2:30)

> "Now watch this."

Type (or speak via voice-to-text): **"Prepare OR-3 for a knee replacement."**

The dashboard shows agents fanning out. Device cards turn yellow (configuring), then flip to green (ready) one by one. Progress bar fills. Live action text updates on each card. On the second monitor, the Unity 3D simulation shows robots activating and moving through the OR in real-time.

> "Five systems, five vendors, one command. Time: 30 seconds. And on this screen, you can see the physical robots responding in our OR simulation."

### Act 3: The Vision (2:30 - 3:00)

> "This works because every medical device already ships with a web dashboard. We didn't write a single integration. We pointed an AI at five URLs, and it learned to operate them."
>
> "But here's what makes this more than a browser macro. The AI doesn't just replay clicks — it understands the interface. When a vendor updates their dashboard, our system detects the change, re-reads the page, and adapts automatically. It even generates its own reusable 'API' from the web UI — recording interactions as deterministic tool calls that execute without LLM overhead."
>
> "A hospital has 20 ORs, each with 10+ devices from 6+ vendors. Traditional API integration: six figures, months of engineering, per hospital. We need a URL and a login."
>
> "If it has a web interface, we can orchestrate it."

---

## Anticipated Judge Questions

### "What about latency?"
We're automating the 25-60 minute setup/verification phase, not real-time surgical control. A 3-second action cycle is fine when replacing a 45-minute manual process.

### "Why not KARL STORZ OR1 or STERIS HexaVue?"
Those are $500K+ single-vendor installations. We work with whatever web UIs the hospital already has, across all vendors.

### "Isn't browser automation fragile?"
Two things. First, the agent uses vision and DOM analysis, not hardcoded selectors — if a button moves, it finds it by what it says. Second, we generate lightweight monitoring scripts from the LLM's understanding, and if the UI changes structurally, the LLM re-reads and re-generates. It's actually more resilient than a custom API integration that breaks when the vendor changes their undocumented API.

### "What about HIPAA?"
The browser agent runs locally on the hospital's network. No patient data leaves the premises. The LLM sees device control panels — settings and status data, not patient records.

### "Why not just use ROS?"
Most medical devices don't run ROS. The UV robot doesn't. The autoclave doesn't. The EHR doesn't. The web dashboard is the one interface every device already has.

### "How does it know what's 'normal' for each procedure?"
The environmental decision layer has procedure-specific thresholds. For orthopedic surgery, humidity must be below 60%. For cardiac, temperature tolerance is tighter. The AI reasons about which values are out of range and which devices to dispatch to fix them.

---

## Room Status Logic

Multiple rooms are shown on the dashboard. For the demo:

- **OR-3** is the active room — tracked with real device agents
- **Other rooms** (OR-1, OR-2, OR-4, etc.) are always displayed as "ready" — static data, no agents running

Room status transitions for the active room:

```
idle → preparing (command submitted)
  → ready (all devices report ready AND environmental check passes)
  → needs_attention (environmental values out of range after robots finish)
  → preparing (corrective devices dispatched)
  → ready (environmental values now within range)
```

---

## Team Structure

| Role | Builds | Dependencies |
|------|--------|-------------|
| **Convex Backend** | Schema, mutations, queries, 3 HTTP endpoints, seed data | None — builds first, unblocks everyone |
| **WebUI** | 5 mock device dashboards on localhost:3001-3005 | Needs Convex URL + endpoint specs |
| **BrowserUse** | Agents that monitor/control the webUIs, generated scripts | Needs working webUIs + Convex endpoints |
| **Unity** | 3D OR simulation with animated robots | Needs `GET /room-state` endpoint returning JSON |

### What Gets Shown on Demo Day

- **Screen 1:** React dashboard (room list, device cards, progress bar, command input)
- **Screen 2:** Unity 3D OR simulation (robots moving in real-time)
- **Background (visible):** BrowserUse browser windows navigating mock webUIs
- **Background (invisible):** Convex backend, Python agent server

---

## Why This Wins

| Criterion | How We Score |
|-----------|-------------|
| Novelty | No existing project uses browser-based LLM agents to orchestrate OR turnover. Novel approach + novel self-healing architecture. |
| Working Demo | Live AI agents navigating vendor dashboards in real-time with a real-time updating dashboard. |
| Problem Relevance | $2.5M/year/OR. $4.62B market. Real companies spending hundreds of millions on this. |
| Technical Depth | Multi-agent orchestration + 3-phase monitoring + agent-generated tool calls + environmental AI reasoning. |
| User Experience | One natural language command replaces 45 minutes of manual clicking across 5 vendor portals. |
| Market Potential | Healthcare, manufacturing, warehousing, military — anywhere with heterogeneous web-controlled devices. |

### The One Line Judges Will Remember

> "If it has a web interface, we can orchestrate it."
