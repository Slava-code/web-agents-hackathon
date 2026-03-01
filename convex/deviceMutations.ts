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

    const hasConfiguring = roomDevices.some((d) => d.status === "configuring");
    const allIdle = roomDevices.every((d) => d.status === "idle");

    let roomStatus = room.status;
    if (hasError) {
      roomStatus = "needs_attention";
    } else if (readyCount === totalDevices && totalDevices > 0) {
      roomStatus = "ready";
    } else if (allIdle && room.status === "needs_attention") {
      roomStatus = "idle";
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

export const triggerAnomaly = internalMutation({
  args: {
    roomId: v.id("rooms"),
    scenario: v.union(
      v.literal("ventilation_failure"),
      v.literal("battery_failure"),
      v.literal("co2_spike"),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get all devices in the room
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const findDevice = (name: string) =>
      devices.find((d) => d.name === name);

    if (args.scenario === "ventilation_failure") {
      const envDevice = findDevice("Environmental Monitoring");
      if (!envDevice) throw new Error("Environmental Monitoring device not found in room");

      // Spike environmental readings
      const spikedFields = {
        ...(envDevice.fields as Record<string, unknown>),
        co2: 1200,
        particulate: 150,
        temperature: ((envDevice.fields as Record<string, unknown>).temperature as number || 71.2) + 3,
        allWithinRange: false,
        riskLevel: "critical",
        status: "VENTILATION FAILURE DETECTED",
      };

      await ctx.db.patch(envDevice._id, {
        status: "error",
        currentAction: "VENTILATION FAILURE DETECTED",
        fields: spikedFields,
        updatedAt: now,
      });

      // Insert an environmentReadings record
      await ctx.db.insert("environmentReadings", {
        roomId: args.roomId,
        co2: 1200,
        particulateCount: 150,
        temperature: spikedFields.temperature as number,
        humidity: (envDevice.fields as Record<string, unknown>).humidity as number || 52,
        pressureDifferential: 0.01,
        allWithinRange: false,
        outOfRangeFields: ["co2", "particulate", "temperature"],
        timestamp: now,
      });
    } else if (args.scenario === "battery_failure") {
      const uvDevice = findDevice("UV Robot");
      if (!uvDevice) throw new Error("UV Robot device not found in room");

      const spikedFields = {
        ...(uvDevice.fields as Record<string, unknown>),
        battery: 15,
        status: "BATTERY CRITICAL",
        health: "Critical",
        cycleMode: "Aborted",
      };

      await ctx.db.patch(uvDevice._id, {
        status: "error",
        currentAction: "BATTERY CRITICAL - Cycle aborted",
        fields: spikedFields,
        updatedAt: now,
      });
    } else if (args.scenario === "co2_spike") {
      const envDevice = findDevice("Environmental Monitoring");
      if (!envDevice) throw new Error("Environmental Monitoring device not found in room");

      const spikedFields = {
        ...(envDevice.fields as Record<string, unknown>),
        co2: 1050,
        allWithinRange: false,
        riskLevel: "high",
        status: "CO2 ELEVATED",
      };

      await ctx.db.patch(envDevice._id, {
        status: "error",
        currentAction: "CO2 SPIKE DETECTED",
        fields: spikedFields,
        updatedAt: now,
      });
    }

    // Set room to needs_attention
    await ctx.db.patch(args.roomId, {
      status: "needs_attention",
      updatedAt: now,
    });

    return { ok: true, scenario: args.scenario, triggeredAt: now };
  },
});
