import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getLatest = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("commands")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .first();
  },
});

export const submit = mutation({
  args: {
    text: v.string(),
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get all devices in the room
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    // Create the command
    const commandId = await ctx.db.insert("commands", {
      text: args.text,
      roomId: args.roomId,
      status: "running",
      deviceCount: devices.length,
      devicesReady: 0,
      startedAt: now,
    });

    // Set room to "preparing"
    await ctx.db.patch(args.roomId, {
      status: "preparing",
      updatedAt: now,
    });

    // Set all devices to "configuring"
    for (const device of devices) {
      await ctx.db.patch(device._id, {
        status: "configuring",
        currentAction: args.text,
        updatedAt: now,
      });
    }

    return commandId;
  },
});
