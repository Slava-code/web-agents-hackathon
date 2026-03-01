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
      deviceCount: 0,
      devicesReady: 0,
      updatedAt: now,
    });
    const or2 = await ctx.db.insert("rooms", {
      name: "OR-2",
      status: "ready",
      deviceCount: 0,
      devicesReady: 0,
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
      deviceCount: 0,
      devicesReady: 0,
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
          outOfRangeFields: [],
        },
        fieldSchema: {
          co2: { type: "number", label: "CO2 Level", readOnly: true, unit: "ppm", allowedRange: { min: 400, max: 800 } },
          particulate: { type: "number", label: "Particulate (PM2.5)", readOnly: true, unit: "μg/m³", allowedRange: { min: 0, max: 100 } },
          temperature: { type: "number", label: "Temperature", readOnly: true, unit: "°F", allowedRange: { min: 65, max: 72 } },
          humidity: { type: "number", label: "Humidity", readOnly: true, unit: "%", allowedRange: { min: 30, max: 60 } },
          pressureDifferential: { type: "number", label: "Pressure Differential", readOnly: true, unit: "inH₂O", allowedRange: { min: 0.03, max: 0.10 } },
          allWithinRange: { type: "boolean", label: "All Within Range", readOnly: true },
          riskLevel: { type: "string", label: "Risk Level", readOnly: true },
          status: { type: "string", label: "Status", readOnly: true },
          outOfRangeFields: { type: "array", label: "Out-of-Range Fields", readOnly: true },
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

    console.log("Seed data inserted:", {
      rooms: { "OR-1": or1, "OR-2": or2, "OR-3": or3, "OR-4": or4 },
      devices: "4 devices for OR-3",
    });
  },
});
