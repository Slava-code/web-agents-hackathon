import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const updateDeviceStatus = internalMutation({
  args: {
    deviceId: v.id("devices"),
    status: v.union(
      v.literal("idle"),
      v.literal("configuring"),
      v.literal("ready"),
      v.literal("error"),
    ),
    currentAction: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Patch the device
    await ctx.db.patch(args.deviceId, {
      status: args.status,
      currentAction: args.currentAction,
      lastError: args.lastError,
      updatedAt: now,
    });

    // Get device to find its room
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Device not found");

    // Count ready/error devices in the room
    const roomDevices = await ctx.db
      .query("devices")
      .withIndex("by_room", (q) => q.eq("roomId", device.roomId))
      .collect();

    const readyCount = roomDevices.filter((d) => d.status === "ready").length;
    const hasError = roomDevices.some((d) => d.status === "error");
    const totalDevices = roomDevices.length;

    // Update room status
    const room = await ctx.db.get(device.roomId);
    if (!room) throw new Error("Room not found");

    let roomStatus = room.status;
    if (hasError) {
      roomStatus = "needs_attention";
    } else if (readyCount === totalDevices && totalDevices > 0) {
      roomStatus = "ready";
    }

    await ctx.db.patch(device.roomId, {
      devicesReady: readyCount,
      status: roomStatus,
      updatedAt: now,
    });

    // Update active command's devicesReady if there's a running command
    const activeCommand = await ctx.db
      .query("commands")
      .withIndex("by_room", (q) => q.eq("roomId", device.roomId))
      .order("desc")
      .first();

    if (activeCommand && activeCommand.status === "running") {
      const updates: Record<string, unknown> = { devicesReady: readyCount };

      if (readyCount === totalDevices && totalDevices > 0) {
        updates.status = "completed";
        updates.completedAt = now;
        updates.elapsedMs = now - activeCommand.startedAt;
      }

      await ctx.db.patch(activeCommand._id, updates);
    }

    return { ok: true };
  },
});

export const updateDeviceFields = internalMutation({
  args: {
    deviceId: v.id("devices"),
    fields: v.any(),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Device not found");

    // Shallow-merge fields into existing
    const merged = { ...(device.fields ?? {}), ...args.fields };

    await ctx.db.patch(args.deviceId, {
      fields: merged,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});
