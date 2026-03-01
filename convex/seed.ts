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

    // Insert 4 rooms: OR-1, OR-2, OR-4 as "ready" (no devices), OR-3 as "idle" (5 devices)
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
      deviceCount: 5,
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

    // Insert 5 devices for OR-3 with fieldSchema so agents know what to extract
    const devices = [
      {
        name: "UV Robot",
        category: "sterilization",
        url: "http://localhost:3001",
        fields: {
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
        name: "Env Monitoring",
        category: "monitoring",
        url: "http://localhost:3002",
        fields: {},
        fieldSchema: {
          temperature: { type: "number", label: "Temperature", readOnly: true, unit: "°C" },
          humidity: { type: "number", label: "Humidity", readOnly: true, unit: "%" },
          co2: { type: "number", label: "CO2", readOnly: true, unit: "ppm" },
          particulateCount: { type: "number", label: "Particulate Count", readOnly: true },
          airPressure: { type: "number", label: "Air Pressure", readOnly: true, unit: "Pa" },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
      {
        name: "Sterilizer",
        category: "sterilization",
        url: "http://localhost:3003",
        fields: {},
        fieldSchema: {
          cycleType: { type: "string", label: "Cycle Type", control: "dropdown" },
          temperature: { type: "number", label: "Temperature", readOnly: true, unit: "°C" },
          pressure: { type: "number", label: "Pressure", readOnly: true, unit: "PSI" },
          cycleProgress: { type: "number", label: "Cycle Progress", readOnly: true, unit: "%" },
          status: { type: "string", label: "Status", readOnly: true },
        },
      },
      {
        name: "Scheduling",
        category: "scheduling",
        url: "http://localhost:3004",
        fields: {},
        fieldSchema: {
          nextCase: { type: "string", label: "Next Case", readOnly: true },
          surgeon: { type: "string", label: "Surgeon", readOnly: true },
          procedure: { type: "string", label: "Procedure", readOnly: true },
          scheduledTime: { type: "string", label: "Scheduled Time", readOnly: true },
          turnaroundStatus: { type: "string", label: "Turnaround Status", readOnly: true },
        },
      },
      {
        name: "Surveillance",
        category: "monitoring",
        url: "http://localhost:3005",
        fields: {},
        fieldSchema: {
          occupancy: { type: "string", label: "Room Occupancy", readOnly: true },
          personnelCount: { type: "number", label: "Personnel Count", readOnly: true },
          lastMotionDetected: { type: "string", label: "Last Motion", readOnly: true },
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
      devices: "5 devices for OR-3",
    });
  },
});
