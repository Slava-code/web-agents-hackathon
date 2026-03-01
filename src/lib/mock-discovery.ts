export interface MockField {
  name: string;
  selector: string;
  sampleValue: string;
  type: string;
}

export interface MockPageResult {
  pagePurpose: string;
  pageLayout: string;
  fields: MockField[];
  agentThoughts: string[];
  inferredSchema: Record<
    string,
    {
      type: string;
      label: string;
      readOnly?: boolean;
      unit?: string;
    }
  >;
  extractionScript: string;
  extractedData: Record<string, unknown>;
}

// Step delays in ms for realistic demo pacing
export const STEP_DELAYS = {
  visiting: 1500,
  analyzing: 2500,
  schema: 2000,
  script: 1500,
  extraction: 2000,
} as const;

// Agent thought delay range
export const THOUGHT_DELAY = { min: 400, max: 1000 } as const;

export const MOCK_PAGES: Record<string, MockPageResult> = {
  "/uv-robot": {
    pagePurpose:
      "UV-C sterilization robot control panel for managing disinfection cycles in operating rooms",
    pageLayout:
      "Two-column layout: left side has device ID, room selector, cycle mode radio buttons, and intensity slider; right side shows battery level, health status, lamp hours, connection status, and cycle history table",
    fields: [
      { name: "deviceId", selector: '[data-testid="device-id"]', sampleValue: "UVC-2019-4721", type: "string" },
      { name: "connectionStatus", selector: '[data-testid="connection-status"]', sampleValue: "Online", type: "string" },
      { name: "targetRoom", selector: '[data-testid="target-room"]', sampleValue: "OR-3", type: "string" },
      { name: "cycleMode", selector: '[data-testid="cycle-mode"]', sampleValue: "Standard", type: "string" },
      { name: "intensity", selector: '[data-testid="intensity"]', sampleValue: "85", type: "number" },
      { name: "battery", selector: '[data-testid="battery-level"]', sampleValue: "87", type: "number" },
      { name: "health", selector: '[data-testid="health-status"]', sampleValue: "Optimal", type: "string" },
      { name: "lampHours", selector: '[data-testid="lamp-hours"]', sampleValue: "1247", type: "number" },
    ],
    agentThoughts: [
      "Opening UV Robot control panel... I see a medical device interface with a dark theme.",
      "Found the device identifier UVC-2019-4721 in the top-left header area.",
      "There are radio buttons for cycle mode: Standard, High, and Terminal. Standard is currently selected.",
      "I see a slider control for UV-C intensity currently set to 85%. This is adjustable.",
      "Right panel shows device status: Battery at 87%, Health is Optimal, 1247 lamp hours logged.",
      "There's a cycle history table at the bottom showing recent sterilization runs.",
    ],
    inferredSchema: {
      deviceId: { type: "string", label: "Device ID", readOnly: true },
      connectionStatus: { type: "string", label: "Connection Status", readOnly: true },
      targetRoom: { type: "string", label: "Target Room" },
      cycleMode: { type: "string", label: "Cycle Mode" },
      intensity: { type: "number", label: "UV-C Intensity", unit: "%" },
      battery: { type: "number", label: "Battery", readOnly: true, unit: "%" },
      health: { type: "string", label: "Health", readOnly: true },
      lampHours: { type: "number", label: "Lamp Hours", readOnly: true },
    },
    extractionScript: `document.querySelectorAll('[data-testid]').forEach(el => {
  const id = el.getAttribute('data-testid');
  console.log(id, '=', el.textContent?.trim());
});`,
    extractedData: {
      deviceId: "UVC-2019-4721",
      connectionStatus: "Online",
      targetRoom: "OR-3",
      cycleMode: "Standard",
      intensity: 85,
      battery: 87,
      health: "Optimal",
      lampHours: 1247,
    },
  },

  "/tug-robot": {
    pagePurpose:
      "TUG autonomous transport robot fleet monitoring dashboard for tracking deliveries across hospital",
    pageLayout:
      "Top section shows fleet status summary (active/en-route/arrived/returning/idle counts); middle section has today's metrics (trips, transit time, on-time rate); bottom shows fleet unit cards",
    fields: [
      { name: "activeUnits", selector: '[data-testid="active-units"]', sampleValue: "0 / 4", type: "string" },
      { name: "enRouteCount", selector: '[data-testid="en-route"]', sampleValue: "0", type: "number" },
      { name: "arrivedCount", selector: '[data-testid="arrived"]', sampleValue: "0", type: "number" },
      { name: "returningCount", selector: '[data-testid="returning"]', sampleValue: "0", type: "number" },
      { name: "idleCount", selector: '[data-testid="idle"]', sampleValue: "4", type: "number" },
      { name: "todaysTrips", selector: '[data-testid="todays-trips"]', sampleValue: "47", type: "number" },
      { name: "avgTransitTime", selector: '[data-testid="avg-transit"]', sampleValue: "3:42", type: "string" },
      { name: "onTimeRate", selector: '[data-testid="on-time-rate"]', sampleValue: "98.2", type: "number" },
    ],
    agentThoughts: [
      "Loading TUG Fleet Monitor... I see a hospital logistics dashboard with a blue/dark theme.",
      "Top section shows fleet status: 0 of 4 units active. All 4 are currently idle.",
      "Status breakdown: EN_ROUTE: 0, ARRIVED: 0, RETURNING: 0, IDLE: 4.",
      "Today's metrics section: 47 trips completed, average transit time 3:42, on-time rate 98.2%.",
      "I can see individual unit cards at the bottom — each TUG robot has its own status indicator.",
    ],
    inferredSchema: {
      activeUnits: { type: "string", label: "Active Units", readOnly: true },
      enRouteCount: { type: "number", label: "EN_ROUTE", readOnly: true },
      arrivedCount: { type: "number", label: "ARRIVED", readOnly: true },
      returningCount: { type: "number", label: "RETURNING", readOnly: true },
      idleCount: { type: "number", label: "IDLE", readOnly: true },
      todaysTrips: { type: "number", label: "Today's Trips", readOnly: true },
      avgTransitTime: { type: "string", label: "Avg Transit Time", readOnly: true },
      onTimeRate: { type: "number", label: "On-Time Rate", readOnly: true, unit: "%" },
    },
    extractionScript: `const data = {};
document.querySelectorAll('[data-testid]').forEach(el => {
  data[el.getAttribute('data-testid')] = el.textContent?.trim();
});
JSON.stringify(data);`,
    extractedData: {
      activeUnits: "0 / 4",
      enRouteCount: 0,
      arrivedCount: 0,
      returningCount: 0,
      idleCount: 4,
      todaysTrips: 47,
      avgTransitTime: "3:42",
      onTimeRate: 98.2,
    },
  },

  "/environmental": {
    pagePurpose:
      "Operating room environmental monitoring system tracking air quality, temperature, humidity, and pressure for surgical safety compliance",
    pageLayout:
      "Grid of sensor cards showing live readings with color-coded status indicators; each card has a gauge or number display with unit labels and normal range indicators",
    fields: [
      { name: "co2", selector: '[data-testid="co2-reading"]', sampleValue: "750", type: "number" },
      { name: "particulate", selector: '[data-testid="particulate-reading"]', sampleValue: "95", type: "number" },
      { name: "temperature", selector: '[data-testid="temp-reading"]', sampleValue: "71.2", type: "number" },
      { name: "humidity", selector: '[data-testid="humidity-reading"]', sampleValue: "52", type: "number" },
      { name: "pressureDifferential", selector: '[data-testid="pressure-reading"]', sampleValue: "0.05", type: "number" },
      { name: "allWithinRange", selector: '[data-testid="overall-status"]', sampleValue: "false", type: "boolean" },
      { name: "riskLevel", selector: '[data-testid="risk-level"]', sampleValue: "high", type: "string" },
    ],
    agentThoughts: [
      "Opening Environmental Monitoring page... I see a sensor dashboard with multiple reading cards.",
      "CO2 level reads 750 ppm — within normal range (400-800 ppm). Card is showing green.",
      "Particulate matter (PM2.5) at 95 μg/m³ — this is close to the 100 μg/m³ limit, card is yellow.",
      "Temperature is 71.2°F (normal range 65-72°F), humidity at 52% (normal 30-60%).",
      "Pressure differential at 0.05 inH₂O — positive pressure maintained for OR infection control.",
      "Overall status shows 'Warning' with risk level 'high' — likely due to elevated particulate levels.",
    ],
    inferredSchema: {
      co2: { type: "number", label: "CO2 Level", readOnly: true, unit: "ppm" },
      particulate: { type: "number", label: "Particulate (PM2.5)", readOnly: true, unit: "μg/m³" },
      temperature: { type: "number", label: "Temperature", readOnly: true, unit: "°F" },
      humidity: { type: "number", label: "Humidity", readOnly: true, unit: "%" },
      pressureDifferential: { type: "number", label: "Pressure Differential", readOnly: true, unit: "inH₂O" },
      allWithinRange: { type: "boolean", label: "All Within Range", readOnly: true },
      riskLevel: { type: "string", label: "Risk Level", readOnly: true },
    },
    extractionScript: `const readings = {};
['co2', 'particulate', 'temp', 'humidity', 'pressure'].forEach(key => {
  const el = document.querySelector(\`[data-testid="\${key}-reading"]\`);
  if (el) readings[key] = parseFloat(el.textContent) || el.textContent?.trim();
});
JSON.stringify(readings);`,
    extractedData: {
      co2: 750,
      particulate: 95,
      temperature: 71.2,
      humidity: 52,
      pressureDifferential: 0.05,
      allWithinRange: false,
      riskLevel: "high",
    },
  },

  "/ehr": {
    pagePurpose:
      "Electronic health record integration for OR room scheduling — shows upcoming procedures, patient info, and surgeon assignments",
    pageLayout:
      "Single-page form layout: room selector dropdown at top, then procedure details card showing patient name, procedure type, surgeon, scheduled time, and delay status",
    fields: [
      { name: "selectedRoom", selector: '[data-testid="room-selector"]', sampleValue: "OR-3", type: "string" },
      { name: "roomStatus", selector: '[data-testid="room-status"]', sampleValue: "Ready", type: "string" },
      { name: "nextProcedure", selector: '[data-testid="procedure-name"]', sampleValue: "Rotator Cuff Repair", type: "string" },
      { name: "nextPatient", selector: '[data-testid="patient-name"]', sampleValue: "Brown, Elizabeth K.", type: "string" },
      { name: "scheduledTime", selector: '[data-testid="scheduled-time"]', sampleValue: "14:45", type: "string" },
      { name: "surgeon", selector: '[data-testid="surgeon-name"]', sampleValue: "Dr. Mark Thompson", type: "string" },
      { name: "delayMinutes", selector: '[data-testid="delay-minutes"]', sampleValue: "0", type: "number" },
    ],
    agentThoughts: [
      "Loading EHR scheduling page... I see a clinical scheduling interface with a clean white/blue theme.",
      "Room selector dropdown is set to OR-3. Room status shows 'Ready'.",
      "Next procedure: Rotator Cuff Repair for patient Brown, Elizabeth K.",
      "Surgeon assigned: Dr. Mark Thompson. Scheduled for 14:45.",
      "No delays reported — delay shows 0 minutes. Status indicator is green 'on_schedule'.",
    ],
    inferredSchema: {
      selectedRoom: { type: "string", label: "Selected Room" },
      roomStatus: { type: "string", label: "Room Status", readOnly: true },
      nextProcedure: { type: "string", label: "Next Procedure", readOnly: true },
      nextPatient: { type: "string", label: "Next Patient", readOnly: true },
      scheduledTime: { type: "string", label: "Scheduled Time", readOnly: true },
      surgeon: { type: "string", label: "Surgeon", readOnly: true },
      delayMinutes: { type: "number", label: "Delay", unit: "min" },
    },
    extractionScript: `const data = {};
['room-selector','room-status','procedure-name','patient-name','scheduled-time','surgeon-name','delay-minutes']
  .forEach(id => {
    const el = document.querySelector(\`[data-testid="\${id}"]\`);
    if (el) data[id] = el.textContent?.trim();
  });
JSON.stringify(data);`,
    extractedData: {
      selectedRoom: "OR-3",
      roomStatus: "Ready",
      nextProcedure: "Rotator Cuff Repair",
      nextPatient: "Brown, Elizabeth K.",
      scheduledTime: "14:45",
      surgeon: "Dr. Mark Thompson",
      delayMinutes: 0,
    },
  },

  "/agent": {
    pagePurpose:
      "AI agent execution dashboard showing BrowserUse agent sessions, learned routes, and real-time agent activity for autonomous OR preparation",
    pageLayout:
      "Split layout: left panel shows agent session controls and status; right panel shows learned page inventory with field counts and extraction status per route",
    fields: [
      { name: "agentStatus", selector: '[data-testid="agent-status"]', sampleValue: "idle", type: "string" },
      { name: "learnedRoutes", selector: '[data-testid="learned-count"]', sampleValue: "0", type: "number" },
      { name: "totalFields", selector: '[data-testid="total-fields"]', sampleValue: "0", type: "number" },
      { name: "sessionId", selector: '[data-testid="session-id"]', sampleValue: "none", type: "string" },
      { name: "lastAction", selector: '[data-testid="last-action"]', sampleValue: "Waiting for command", type: "string" },
    ],
    agentThoughts: [
      "Loading Agent dashboard... I see an AI orchestration interface with session management controls.",
      "Agent status is 'idle' — no active sessions. Session ID shows 'none'.",
      "Learned routes counter shows 0 — no pages have been analyzed yet.",
      "Last action reads 'Waiting for command'. The interface has Start/Stop/Learn buttons.",
      "This page is for monitoring the AI agents, not a device dashboard itself.",
    ],
    inferredSchema: {
      agentStatus: { type: "string", label: "Agent Status", readOnly: true },
      learnedRoutes: { type: "number", label: "Learned Routes", readOnly: true },
      totalFields: { type: "number", label: "Total Fields", readOnly: true },
      sessionId: { type: "string", label: "Session ID", readOnly: true },
      lastAction: { type: "string", label: "Last Action", readOnly: true },
    },
    extractionScript: `const data = {};
['agent-status','learned-count','total-fields','session-id','last-action']
  .forEach(id => {
    const el = document.querySelector(\`[data-testid="\${id}"]\`);
    if (el) data[id] = el.textContent?.trim();
  });
JSON.stringify(data);`,
    extractedData: {
      agentStatus: "idle",
      learnedRoutes: 0,
      totalFields: 0,
      sessionId: "none",
      lastAction: "Waiting for command",
    },
  },
};

export function getRandomThoughtDelay(): number {
  return (
    Math.floor(Math.random() * (THOUGHT_DELAY.max - THOUGHT_DELAY.min)) +
    THOUGHT_DELAY.min
  );
}
