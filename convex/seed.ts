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
      deviceCount: 2,
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
        url: "http://localhost:3000/tug-fleet",
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
      devices: "2 devices for OR-3",
    });
  },
});
