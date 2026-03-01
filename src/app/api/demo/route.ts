import { NextRequest } from "next/server";
import { ROUTE_TO_DEVICE, CONVEX_URL } from "@/lib/device-mapping";

/**
 * Demo mode: bypasses browser-use entirely.
 * Pushes realistic, changing data to Convex every few seconds
 * to simulate the watch pipeline for a live demo.
 */

const TICK_MS = 8000; // push new data every 8 seconds
const MAX_TICKS = 100;

// ─── Baseline data for each device ─────────────────────────────────

const UV_ROBOT_BASE = {
  selectedRoom: "OR-3",
  cycleMode: "standard",
  intensity: "85",
  batteryLevel: "87%",
  lampHours: "1247",
  connectionStatus: "System Online",
  progress: "0",
  cycleStatus: "standby",
  displayRoom: "OR-3",
  displayMode: "standard",
  displayIntensity: "85%",
};

const ENV_BASE = {
  totalSensors: "8",
  onlineSensors: "6",
  warningSensors: "1",
  offlineSensors: "1",
  highRiskSensors: "1",
  activeAlerts: "2",
  sensor_ENV001_pm25: "42",
  sensor_ENV001_temp: "68.5°F",
  sensor_ENV001_co2: "620",
  sensor_ENV003_pm25: "95",
  sensor_ENV003_temp: "71.2°F",
  sensor_ENV003_co2: "750",
  threshold_particulate: "100",
  threshold_co2: "700",
};

const TUG_BASE = {
  activeCount: "2 / 4",
  tripCount: "47",
  bot1_id: "TUG-01",
  bot1_status: "IDLE",
  bot1_source: "OR-1",
  bot1_battery: "94%",
  bot2_id: "TUG-02",
  bot2_status: "EN ROUTE",
  bot2_source: "OR-3",
  bot2_battery: "78%",
  bot3_id: "TUG-03",
  bot3_status: "IDLE",
  bot3_source: "OR-2",
  bot3_battery: "62%",
  bot4_id: "TUG-04",
  bot4_status: "RETURNING",
  bot4_source: "OR-4",
  bot4_battery: "55%",
};

const EHR_BASE = {
  hospitalName: "Memorial General Hospital",
  unitName: "Main OR",
  activeRoomTitle: "Operating Room 3",
  activeRoomStatus: "Turnover",
  turnoverTime: "14:02",
  checklist_RoomCleaned: "true",
  checklist_EquipmentStaged: "true",
  checklist_InstrumentsVerified: "false",
  checklist_AnesthesiaSetup: "false",
  checklist_PatientReady: "false",
  patientName: "Johnson, Robert M.",
  mrn: "MRN-2024-00847",
  procedure: "Total Knee Arthroplasty, Left",
  surgeon: "Dr. Sarah Mitchell",
  duration: "2h 30m",
  anesthesia: "Spinal w/ Sedation",
  allergies: "Penicillin, Latex",
  roomStatus_OR1: "Occupied",
  roomStatus_OR2: "Occupied",
  roomStatus_OR3: "Turnover",
  roomStatus_OR4: "Cleaning",
};

// ─── Scenario scripts: each tick can mutate device state ────────────

interface DeviceState {
  uvRobot: Record<string, string>;
  env: Record<string, string>;
  tug: Record<string, string>;
  ehr: Record<string, string>;
}

function applyTick(state: DeviceState, tick: number): Record<string, { deviceId: string; fields: Record<string, string>; changes: string[] }> {
  const updates: Record<string, { deviceId: string; fields: Record<string, string>; changes: string[] }> = {};

  // ── UV Robot: simulate a disinfection cycle ──
  const uv = state.uvRobot;
  const uvChanges: string[] = [];

  if (tick === 1) {
    uv.cycleStatus = "disinfecting";
    uv.progress = "0";
    uv.cycleMode = "high";
    uv.displayMode = "high";
    uvChanges.push("cycleStatus: standby → disinfecting", "cycleMode: standard → high");
  } else if (tick >= 2 && tick <= 6) {
    const prog = Math.min(100, (tick - 1) * 20);
    uv.progress = String(prog);
    uv.displayIntensity = `${85 + tick}%`;
    uv.intensity = String(85 + tick);
    uvChanges.push(`progress: → ${prog}%`);
  } else if (tick === 7) {
    uv.cycleStatus = "complete";
    uv.progress = "100";
    uv.batteryLevel = "72%";
    uv.lampHours = "1248";
    uvChanges.push("cycleStatus: disinfecting → complete", "batteryLevel: 87% → 72%");
  } else if (tick === 9) {
    uv.cycleStatus = "standby";
    uv.progress = "0";
    uv.cycleMode = "standard";
    uv.displayMode = "standard";
    uvChanges.push("cycleStatus: complete → standby");
  }
  // Battery drain
  if (tick > 0 && tick % 3 === 0) {
    const bat = Math.max(20, 87 - tick * 2);
    uv.batteryLevel = `${bat}%`;
  }

  if (uvChanges.length > 0) {
    updates["/uv-robot"] = { deviceId: ROUTE_TO_DEVICE["/uv-robot"].deviceId, fields: { ...uv }, changes: uvChanges };
  }

  // ── Environmental: sensor readings drift ──
  const env = state.env;
  const envChanges: string[] = [];
  const jitter = (base: number, range: number) => Math.round((base + (Math.random() - 0.5) * range) * 10) / 10;

  const oldPm = env.sensor_ENV003_pm25;
  const oldTemp = env.sensor_ENV003_temp;
  const oldCo2 = env.sensor_ENV003_co2;

  env.sensor_ENV001_pm25 = String(jitter(42, 15));
  env.sensor_ENV001_temp = `${jitter(68.5, 2)}°F`;
  env.sensor_ENV001_co2 = String(Math.round(jitter(620, 80)));
  env.sensor_ENV003_pm25 = String(jitter(95, 30));
  env.sensor_ENV003_temp = `${jitter(71.2, 3)}°F`;
  env.sensor_ENV003_co2 = String(Math.round(jitter(750, 100)));

  if (env.sensor_ENV003_pm25 !== oldPm) envChanges.push(`ENV003 PM2.5: ${oldPm} → ${env.sensor_ENV003_pm25}`);
  if (env.sensor_ENV003_co2 !== oldCo2) envChanges.push(`ENV003 CO2: ${oldCo2} → ${env.sensor_ENV003_co2}`);

  // Alerts change based on readings
  const pm = parseFloat(env.sensor_ENV003_pm25);
  if (pm > 100) {
    env.highRiskSensors = "2";
    env.activeAlerts = "3";
    envChanges.push("highRiskSensors: 1 → 2 (threshold exceeded)");
  } else {
    env.highRiskSensors = "1";
    env.activeAlerts = "2";
  }

  if (envChanges.length > 0) {
    updates["/environmental"] = { deviceId: ROUTE_TO_DEVICE["/environmental"].deviceId, fields: { ...env }, changes: envChanges };
  }

  // ── TUG Robot: bot status progression ──
  const tug = state.tug;
  const tugChanges: string[] = [];

  if (tick % 4 === 1) {
    tug.bot1_status = "EN ROUTE";
    tug.bot1_source = "OR-3";
    tug.activeCount = "3 / 4";
    tugChanges.push("TUG-01: IDLE → EN ROUTE from OR-3");
  } else if (tick % 4 === 2) {
    tug.bot2_status = "ARRIVED";
    tug.bot1_status = "EN ROUTE";
    tugChanges.push("TUG-02: EN ROUTE → ARRIVED");
  } else if (tick % 4 === 3) {
    tug.bot1_status = "ARRIVED";
    tug.bot2_status = "RETURNING";
    tug.tripCount = String(parseInt(tug.tripCount) + 1);
    tugChanges.push("TUG-01: EN ROUTE → ARRIVED", `trips: ${parseInt(tug.tripCount) - 1} → ${tug.tripCount}`);
  } else if (tick % 4 === 0 && tick > 0) {
    tug.bot1_status = "IDLE";
    tug.bot2_status = "IDLE";
    tug.bot4_status = "IDLE";
    tug.activeCount = "0 / 4";
    tugChanges.push("All bots returned to IDLE");
  }

  if (tugChanges.length > 0) {
    updates["/tug-robot"] = { deviceId: ROUTE_TO_DEVICE["/tug-robot"].deviceId, fields: { ...tug }, changes: tugChanges };
  }

  // ── EHR: checklist progression ──
  const ehr = state.ehr;
  const ehrChanges: string[] = [];

  if (tick === 2) {
    ehr.checklist_InstrumentsVerified = "true";
    ehrChanges.push("checklist: Instruments Verified ✓");
  } else if (tick === 4) {
    ehr.checklist_AnesthesiaSetup = "true";
    ehrChanges.push("checklist: Anesthesia Setup ✓");
  } else if (tick === 6) {
    ehr.checklist_PatientReady = "true";
    ehr.activeRoomStatus = "Ready";
    ehr.roomStatus_OR3 = "Ready";
    ehrChanges.push("checklist: Patient Ready ✓", "OR-3 status: Turnover → Ready");
  } else if (tick === 8) {
    ehr.activeRoomStatus = "Occupied";
    ehr.roomStatus_OR3 = "Occupied";
    ehrChanges.push("OR-3 status: Ready → Occupied (surgery started)");
  } else if (tick === 12) {
    ehr.roomStatus_OR1 = "Ready";
    ehrChanges.push("OR-1 status: Occupied → Ready");
  }

  if (ehrChanges.length > 0) {
    updates["/ehr"] = { deviceId: ROUTE_TO_DEVICE["/ehr"].deviceId, fields: { ...ehr }, changes: ehrChanges };
  }

  return updates;
}

// ─── Route handler ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { intervalMs: rawInterval } = await req.json().catch(() => ({}));
  const intervalMs = Math.max(3000, rawInterval || TICK_MS);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* closed */ }
      };

      const state: DeviceState = {
        uvRobot: { ...UV_ROBOT_BASE },
        env: { ...ENV_BASE },
        tug: { ...TUG_BASE },
        ehr: { ...EHR_BASE },
      };

      // Push initial state for all devices
      send({ type: "watch_started", url: "All 4 devices", intervalMs });

      for (const [route, mapping] of Object.entries(ROUTE_TO_DEVICE)) {
        const baseData = route === "/uv-robot" ? UV_ROBOT_BASE
          : route === "/environmental" ? ENV_BASE
          : route === "/tug-robot" ? TUG_BASE
          : EHR_BASE;

        await pushToConvex(mapping.deviceId, baseData, send);
      }

      send({
        type: "change_detected",
        diff: { changed: {}, added: { devices: "4 devices initialized" }, removed: [] },
        hasChanges: true,
        iteration: 0,
        cost: "0",
        isFirstRun: true,
      });

      // Tick loop
      for (let tick = 1; tick <= MAX_TICKS; tick++) {
        await new Promise((r) => setTimeout(r, intervalMs));

        try {
          const updates = applyTick(state, tick);
          const routesUpdated = Object.keys(updates);

          if (routesUpdated.length === 0) {
            send({ type: "heartbeat", iteration: tick, timestamp: Date.now(), cost: "0" });
            continue;
          }

          // Push each device that changed
          const allChanges: string[] = [];
          for (const [route, update] of Object.entries(updates)) {
            await pushToConvex(update.deviceId, update.fields, send);
            allChanges.push(`${ROUTE_TO_DEVICE[route].name}: ${update.changes.join(", ")}`);
          }

          send({
            type: "change_detected",
            diff: {
              changed: Object.fromEntries(allChanges.map((c, i) => [`update_${i}`, { old: "", new: c }])),
              added: {},
              removed: [],
            },
            hasChanges: true,
            iteration: tick,
            cost: "0",
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          send({ type: "watch_error", message: msg, iteration: tick });
        }
      }

      send({ type: "watch_ended", reason: "complete", iterations: MAX_TICKS });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function pushToConvex(
  deviceId: string,
  fields: Record<string, string>,
  send: (data: Record<string, unknown>) => void
) {
  try {
    const url = `${CONVEX_URL}/field-update`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, fields }),
    });
    const text = await res.text();
    let result: { ok?: boolean } = {};
    try { result = JSON.parse(text); } catch { /* non-JSON response */ }
    if (result.ok) {
      send({ type: "convex_push", ok: true, deviceId, fieldsSent: Object.keys(fields).length });
    } else {
      send({ type: "convex_push", ok: false, deviceId, error: `${res.status} ${text.slice(0, 200)}`, fieldsSent: 0 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    send({ type: "convex_push", ok: false, deviceId, error: msg, fieldsSent: 0 });
  }
}
