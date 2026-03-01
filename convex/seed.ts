import { internalMutation } from "./_generated/server";

export const reset = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = ["actionLogs", "commands", "environmentReadings", "devices", "rooms"] as const;
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }
    console.log("All data cleared.");
  },
});

export const init = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Idempotency guard: skip if rooms already exist
    const existing = await ctx.db.query("rooms").first();
    if (existing) {
      console.log("Seed data already exists, skipping.");
      return;
    }

    const now = Date.now();

    // Insert 4 rooms: OR-1, OR-2, OR-4 as "ready" (no devices), OR-3 as "idle" (2 devices)
    const or1 = await ctx.db.insert("rooms", {
      name: "OR-1",
      status: "ready",
      deviceCount: 3,
      devicesReady: 3,
      updatedAt: now,
    });
    const or2 = await ctx.db.insert("rooms", {
      name: "OR-2",
      status: "ready",
      deviceCount: 2,
      devicesReady: 2,
      updatedAt: now,
    });
    const or3 = await ctx.db.insert("rooms", {
      name: "OR-3",
      status: "idle",
      deviceCount: 4,
      devicesReady: 0,
      updatedAt: now,
    });
    const or4 = await ctx.db.insert("rooms", {
      name: "OR-4",
      status: "ready",
      deviceCount: 4,
      devicesReady: 4,
      updatedAt: now,
    });

    // Insert 2 devices for OR-3 with fieldSchema so agents know what to extract
    const devices = [
      {
        name: "UV Robot",
        category: "sterilization",
        url: "http://localhost:3000/uv-robot",
        fields: {
          deviceId: "UVC-2019-4721",
          connectionStatus: "Online",
          targetRoom: "OR-3",
          cycleMode: "Standard",
          intensity: 85,
          battery: 87,
          health: "Optimal",
          lampHours: 1247,
          connection: "Connected",
          status: "READY",
          cycleCount: 4,
        },
        fieldSchema: {
          deviceId: { type: "string", label: "Device ID", readOnly: true },
          connectionStatus: { type: "string", label: "Connection Status", readOnly: true },
          targetRoom: { type: "string", label: "Target Room", control: "dropdown" },
          cycleMode: { type: "string", label: "Cycle Mode", control: "radio", options: ["Standard", "High", "Terminal"] },
          intensity: { type: "number", label: "UV-C Intensity", control: "slider", min: 0, max: 100, unit: "%" },
          battery: { type: "number", label: "Battery", readOnly: true, unit: "%" },
          health: { type: "string", label: "Health", readOnly: true },
          lampHours: { type: "number", label: "Lamp Hours", readOnly: true },
          connection: { type: "string", label: "Connection", readOnly: true },
          status: { type: "string", label: "Status", readOnly: true },
          cycleCount: { type: "number", label: "Cycle Count", readOnly: true },
        },
      },
      {
        name: "TUG Fleet Monitor",
        category: "transport",
        url: "http://localhost:3000/tug-robot",
        fields: {
          activeUnits: "0 / 4",
          enRouteCount: 0,
          arrivedCount: 0,
          returningCount: 0,
          idleCount: 4,
          todaysTrips: 47,
          avgTransitTime: "3:42",
          onTimeRate: 98.2,
          itemsTransported: 156,
          fleetUptime: 99.9,
        },
        fieldSchema: {
          activeUnits: { type: "string", label: "Active Units", readOnly: true },
          enRouteCount: { type: "number", label: "EN_ROUTE", readOnly: true },
          arrivedCount: { type: "number", label: "ARRIVED", readOnly: true },
          returningCount: { type: "number", label: "RETURNING", readOnly: true },
          idleCount: { type: "number", label: "IDLE", readOnly: true },
          todaysTrips: { type: "number", label: "Today's Trips", readOnly: true },
          avgTransitTime: { type: "string", label: "Avg Transit Time", readOnly: true },
          onTimeRate: { type: "number", label: "On-Time Rate", readOnly: true, unit: "%" },
          itemsTransported: { type: "number", label: "Items Transported", readOnly: true },
          fleetUptime: { type: "number", label: "Fleet Uptime", readOnly: true, unit: "%" },
          // Per-unit data (agent can populate as nested objects)
          units: { type: "object", label: "Fleet Units", readOnly: true },
        },
      },
      {
        name: "Environmental Monitoring",
        category: "monitoring",
        url: "http://localhost:3000/environmental",
        fields: {
          co2: 750,
          particulate: 95,
          temperature: 71.2,
          humidity: 52,
          pressureDifferential: 0.05,
          allWithinRange: false,
          riskLevel: "high",
          status: "warning",
        },
        fieldSchema: {
          co2: { type: "number", label: "CO2 Level", readOnly: true, unit: "ppm" },
          particulate: { type: "number", label: "Particulate (PM2.5)", readOnly: true, unit: "μg/m³" },
          temperature: { type: "number", label: "Temperature", readOnly: true, unit: "°F" },
          humidity: { type: "number", label: "Humidity", readOnly: true, unit: "%" },
          pressureDifferential: { type: "number", label: "Pressure Differential", readOnly: true, unit: "inH₂O" },
          allWithinRange: { type: "boolean", label: "All Within Range", readOnly: true },
          riskLevel: { type: "string", label: "Risk Level", readOnly: true },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
      {
        name: "Room Scheduling",
        category: "scheduling",
        url: "http://localhost:3000/ehr",
        fields: {
          selectedRoom: "OR-3",
          roomStatus: "Ready",
          nextProcedure: "Rotator Cuff Repair",
          nextPatient: "Brown, Elizabeth K.",
          scheduledTime: "14:45",
          surgeon: "Dr. Mark Thompson",
          delayMinutes: 0,
          status: "on_schedule",
        },
        fieldSchema: {
          selectedRoom: { type: "string", label: "Selected Room", control: "dropdown" },
          roomStatus: { type: "string", label: "Room Status", readOnly: true },
          nextProcedure: { type: "string", label: "Next Procedure", readOnly: true },
          nextPatient: { type: "string", label: "Next Patient", readOnly: true },
          scheduledTime: { type: "string", label: "Scheduled Time", readOnly: true },
          surgeon: { type: "string", label: "Surgeon", readOnly: true },
          delayMinutes: { type: "number", label: "Delay (min)", control: "input", unit: "min" },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
    ];

    for (const device of devices) {
      await ctx.db.insert("devices", {
        name: device.name,
        category: device.category,
        roomId: or3,
        url: device.url,
        status: "idle",
        fields: device.fields,
        fieldSchema: device.fieldSchema,
        updatedAt: now,
      });
    }

    // --- OR-1: 3 devices (ready) ---
    const or1Devices = [
      {
        name: "Anesthesia Workstation",
        category: "anesthesia",
        url: "http://localhost:3000/anesthesia",
        fields: {
          deviceId: "ANE-3100-0812",
          connectionStatus: "Online",
          ventMode: "Volume Control",
          tidalVolume: 500,
          respiratoryRate: 12,
          o2Concentration: 40,
          sevoflurane: 0,
          battery: 100,
          status: "STANDBY",
        },
        fieldSchema: {
          deviceId: { type: "string", label: "Device ID", readOnly: true },
          connectionStatus: { type: "string", label: "Connection", readOnly: true },
          ventMode: { type: "string", label: "Ventilation Mode", control: "dropdown", options: ["Volume Control", "Pressure Control", "SIMV"] },
          tidalVolume: { type: "number", label: "Tidal Volume", control: "input", unit: "mL" },
          respiratoryRate: { type: "number", label: "Respiratory Rate", control: "input", unit: "bpm" },
          o2Concentration: { type: "number", label: "O₂ Concentration", control: "slider", min: 21, max: 100, unit: "%" },
          sevoflurane: { type: "number", label: "Sevoflurane", control: "slider", min: 0, max: 8, unit: "%" },
          battery: { type: "number", label: "Battery", readOnly: true, unit: "%" },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
      {
        name: "Surgical Lighting",
        category: "lighting",
        url: "http://localhost:3000/surgical-light",
        fields: {
          deviceId: "SL-7000-1433",
          brightness: 95,
          colorTemp: 4500,
          focusDiameter: 20,
          shadowReduction: "Active",
          status: "ON",
        },
        fieldSchema: {
          deviceId: { type: "string", label: "Device ID", readOnly: true },
          brightness: { type: "number", label: "Brightness", control: "slider", min: 0, max: 100, unit: "%" },
          colorTemp: { type: "number", label: "Color Temperature", control: "slider", min: 3500, max: 5500, unit: "K" },
          focusDiameter: { type: "number", label: "Focus Diameter", control: "slider", min: 10, max: 30, unit: "cm" },
          shadowReduction: { type: "string", label: "Shadow Reduction", readOnly: true },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
      {
        name: "Patient Monitor",
        category: "monitoring",
        url: "http://localhost:3000/patient-monitor",
        fields: {
          deviceId: "PM-4200-0291",
          heartRate: 72,
          bloodPressure: "120/80",
          spo2: 99,
          etCo2: 35,
          temperature: 98.6,
          status: "MONITORING",
        },
        fieldSchema: {
          deviceId: { type: "string", label: "Device ID", readOnly: true },
          heartRate: { type: "number", label: "Heart Rate", readOnly: true, unit: "bpm" },
          bloodPressure: { type: "string", label: "Blood Pressure", readOnly: true, unit: "mmHg" },
          spo2: { type: "number", label: "SpO₂", readOnly: true, unit: "%" },
          etCo2: { type: "number", label: "EtCO₂", readOnly: true, unit: "mmHg" },
          temperature: { type: "number", label: "Temperature", readOnly: true, unit: "°F" },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
    ];
    for (const d of or1Devices) {
      await ctx.db.insert("devices", {
        name: d.name, category: d.category, roomId: or1, url: d.url,
        status: "ready", fields: d.fields, fieldSchema: d.fieldSchema, updatedAt: now,
      });
    }

    // --- OR-2: 2 devices (ready) ---
    const or2Devices = [
      {
        name: "Electrosurgical Unit",
        category: "surgical",
        url: "http://localhost:3000/esu",
        fields: {
          deviceId: "ESU-5500-0637",
          cutPower: 40,
          coagPower: 30,
          mode: "Blend 1",
          padContact: "Good",
          status: "STANDBY",
        },
        fieldSchema: {
          deviceId: { type: "string", label: "Device ID", readOnly: true },
          cutPower: { type: "number", label: "Cut Power", control: "slider", min: 1, max: 120, unit: "W" },
          coagPower: { type: "number", label: "Coag Power", control: "slider", min: 1, max: 120, unit: "W" },
          mode: { type: "string", label: "Mode", control: "dropdown", options: ["Pure Cut", "Blend 1", "Blend 2", "Fulgurate"] },
          padContact: { type: "string", label: "Pad Contact", readOnly: true },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
      {
        name: "Infusion Pump Array",
        category: "infusion",
        url: "http://localhost:3000/infusion-pump",
        fields: {
          deviceId: "INF-8800-1102",
          channelsActive: 2,
          channelA_drug: "Normal Saline",
          channelA_rate: 125,
          channelB_drug: "Lactated Ringer",
          channelB_rate: 75,
          totalVolume: 1450,
          status: "INFUSING",
        },
        fieldSchema: {
          deviceId: { type: "string", label: "Device ID", readOnly: true },
          channelsActive: { type: "number", label: "Active Channels", readOnly: true },
          channelA_drug: { type: "string", label: "Channel A Drug", readOnly: true },
          channelA_rate: { type: "number", label: "Channel A Rate", control: "input", unit: "mL/hr" },
          channelB_drug: { type: "string", label: "Channel B Drug", readOnly: true },
          channelB_rate: { type: "number", label: "Channel B Rate", control: "input", unit: "mL/hr" },
          totalVolume: { type: "number", label: "Total Volume", readOnly: true, unit: "mL" },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
    ];
    for (const d of or2Devices) {
      await ctx.db.insert("devices", {
        name: d.name, category: d.category, roomId: or2, url: d.url,
        status: "ready", fields: d.fields, fieldSchema: d.fieldSchema, updatedAt: now,
      });
    }

    // --- OR-4: 4 devices (ready) ---
    const or4Devices = [
      {
        name: "Robotic Surgical System",
        category: "surgical",
        url: "http://localhost:3000/robotic-surgery",
        fields: {
          deviceId: "RSI-9000-0054",
          arms: 4,
          calibrationStatus: "Calibrated",
          instrumentSet: "Laparoscopic General",
          visionMode: "3D HD",
          motionScale: "3:1",
          status: "DOCKED",
        },
        fieldSchema: {
          deviceId: { type: "string", label: "Device ID", readOnly: true },
          arms: { type: "number", label: "Arms", readOnly: true },
          calibrationStatus: { type: "string", label: "Calibration", readOnly: true },
          instrumentSet: { type: "string", label: "Instrument Set", control: "dropdown", options: ["Laparoscopic General", "Thoracic", "Urologic", "Gynecologic"] },
          visionMode: { type: "string", label: "Vision Mode", control: "radio", options: ["2D", "3D HD", "Fluorescence"] },
          motionScale: { type: "string", label: "Motion Scale", control: "dropdown", options: ["2:1", "3:1", "5:1"] },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
      {
        name: "Surgical Display Array",
        category: "display",
        url: "http://localhost:3000/display-array",
        fields: {
          deviceId: "SDA-6100-0882",
          displays: 3,
          primarySource: "Endoscope",
          secondarySource: "Patient Vitals",
          tertiarySource: "Imaging (CT)",
          resolution: "4K",
          status: "ACTIVE",
        },
        fieldSchema: {
          deviceId: { type: "string", label: "Device ID", readOnly: true },
          displays: { type: "number", label: "Display Count", readOnly: true },
          primarySource: { type: "string", label: "Primary Source", control: "dropdown", options: ["Endoscope", "Microscope", "C-Arm", "Room Camera"] },
          secondarySource: { type: "string", label: "Secondary Source", readOnly: true },
          tertiarySource: { type: "string", label: "Tertiary Source", readOnly: true },
          resolution: { type: "string", label: "Resolution", readOnly: true },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
      {
        name: "Climate Control Unit",
        category: "environment",
        url: "http://localhost:3000/climate-control",
        fields: {
          deviceId: "CCU-2200-0419",
          temperature: 68,
          humidity: 45,
          airExchanges: 25,
          hepaStatus: "Normal",
          pressureMode: "Positive",
          status: "ACTIVE",
        },
        fieldSchema: {
          deviceId: { type: "string", label: "Device ID", readOnly: true },
          temperature: { type: "number", label: "Set Temperature", control: "input", unit: "°F" },
          humidity: { type: "number", label: "Set Humidity", control: "slider", min: 30, max: 60, unit: "%" },
          airExchanges: { type: "number", label: "Air Exchanges/hr", readOnly: true },
          hepaStatus: { type: "string", label: "HEPA Filter", readOnly: true },
          pressureMode: { type: "string", label: "Pressure Mode", control: "radio", options: ["Positive", "Negative", "Neutral"] },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
      {
        name: "Smoke Evacuator",
        category: "safety",
        url: "http://localhost:3000/smoke-evac",
        fields: {
          deviceId: "SE-1100-0763",
          filterLife: 82,
          flowRate: "Medium",
          activationMode: "Auto",
          noiseLevel: 42,
          status: "STANDBY",
        },
        fieldSchema: {
          deviceId: { type: "string", label: "Device ID", readOnly: true },
          filterLife: { type: "number", label: "Filter Life", readOnly: true, unit: "%" },
          flowRate: { type: "string", label: "Flow Rate", control: "dropdown", options: ["Low", "Medium", "High"] },
          activationMode: { type: "string", label: "Activation Mode", control: "radio", options: ["Manual", "Auto"] },
          noiseLevel: { type: "number", label: "Noise Level", readOnly: true, unit: "dB" },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
    ];
    for (const d of or4Devices) {
      await ctx.db.insert("devices", {
        name: d.name, category: d.category, roomId: or4, url: d.url,
        status: "ready", fields: d.fields, fieldSchema: d.fieldSchema, updatedAt: now,
      });
    }

    console.log("Seed data inserted:", {
      rooms: { "OR-1": or1, "OR-2": or2, "OR-3": or3, "OR-4": or4 },
      devices: "4 for OR-3, 3 for OR-1, 2 for OR-2, 4 for OR-4",
    });
  },
});
