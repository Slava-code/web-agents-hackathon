import { internalMutation } from "./_generated/server";

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

    // Insert 5 devices for OR-3
    const devices = [
      { name: "UV Robot", category: "sterilization", url: "http://localhost:3001" },
      { name: "Env Monitoring", category: "monitoring", url: "http://localhost:3002" },
      { name: "Sterilizer", category: "sterilization", url: "http://localhost:3003" },
      { name: "Scheduling", category: "scheduling", url: "http://localhost:4004" },
      { name: "Surveillance", category: "monitoring", url: "http://localhost:3005" },
    ];

    for (const device of devices) {
      await ctx.db.insert("devices", {
        name: device.name,
        category: device.category,
        roomId: or3,
        url: device.url,
        status: "idle",
        fields: {},
        updatedAt: now,
      });
    }

    console.log("Seed data inserted:", {
      rooms: { "OR-1": or1, "OR-2": or2, "OR-3": or3, "OR-4": or4 },
      devices: "5 devices for OR-3",
    });
  },
});
