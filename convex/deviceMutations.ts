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

      const existingFields = envDevice.fields as Record<string, unknown>;
      const spikedTemp = ((existingFields.temperature as number) || 71.2) + 3;

      // Spike multiple readings simultaneously — agent must correlate the pattern
      const spikedFields = {
        ...existingFields,
        co2: 1200,                    // allowed: 400-800 ppm
        particulate: 150,             // allowed: 0-100 μg/m³
        temperature: spikedTemp,      // allowed: 65-72 °F
        humidity: 68,                 // allowed: 30-60 %
        pressureDifferential: 0.01,   // allowed: 0.03-0.10 inH₂O (positive pressure lost)
        allWithinRange: false,
        riskLevel: "critical",
        status: "MULTIPLE THRESHOLDS EXCEEDED",
        outOfRangeFields: [
          { field: "co2", value: 1200, allowed: { min: 400, max: 800 }, unit: "ppm" },
          { field: "particulate", value: 150, allowed: { min: 0, max: 100 }, unit: "μg/m³" },
          { field: "temperature", value: spikedTemp, allowed: { min: 65, max: 72 }, unit: "°F" },
          { field: "humidity", value: 68, allowed: { min: 30, max: 60 }, unit: "%" },
          { field: "pressureDifferential", value: 0.01, allowed: { min: 0.03, max: 0.10 }, unit: "inH₂O" },
        ],
      };

      await ctx.db.patch(envDevice._id, {
        status: "error",
        currentAction: "MULTIPLE THRESHOLDS EXCEEDED — 5 readings out of allowed range",
        fields: spikedFields,
        updatedAt: now,
      });

      // Insert an environmentReadings record
      await ctx.db.insert("environmentReadings", {
        roomId: args.roomId,
        co2: 1200,
        particulateCount: 150,
        temperature: spikedTemp,
        humidity: 68,
        pressureDifferential: 0.01,
        allWithinRange: false,
        outOfRangeFields: ["co2", "particulate", "temperature", "humidity", "pressureDifferential"],
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

      // Only CO2 spikes — other readings stay normal. Agent should note that
      // only 1 reading is out of range (unlike ventilation_failure where 5 spike).
      const spikedFields = {
        ...(envDevice.fields as Record<string, unknown>),
        co2: 1050,
        allWithinRange: false,
        riskLevel: "high",
        status: "THRESHOLD EXCEEDED",
        outOfRangeFields: [
          { field: "co2", value: 1050, allowed: { min: 400, max: 800 }, unit: "ppm" },
        ],
      };

      await ctx.db.patch(envDevice._id, {
        status: "error",
        currentAction: "THRESHOLD EXCEEDED — 1 reading out of allowed range",
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

export const resolveAnomaly = internalMutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find Environmental Monitoring device in this room
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const envDevice = devices.find((d) => d.name === "Environmental Monitoring");

    if (envDevice) {
      const existingFields = envDevice.fields as Record<string, unknown>;
      const safeFields = {
        ...existingFields,
        co2: 450,
        particulate: 25,
        temperature: 70.2,
        humidity: 45,
        pressureDifferential: 0.05,
        allWithinRange: true,
        riskLevel: "normal",
        status: "normal",
        outOfRangeFields: [],
      };

      await ctx.db.patch(envDevice._id, {
        status: "idle",
        currentAction: undefined,
        lastError: undefined,
        fields: safeFields,
        updatedAt: now,
      });

      // Insert a clean environmentReadings record
      await ctx.db.insert("environmentReadings", {
        roomId: args.roomId,
        co2: 450,
        particulateCount: 25,
        temperature: 70.2,
        humidity: 45,
        pressureDifferential: 0.05,
        allWithinRange: true,
        outOfRangeFields: [],
        timestamp: now,
      });
    }

    // Reset all devices in room to idle
    for (const device of devices) {
      if (device._id !== envDevice?._id) {
        await ctx.db.patch(device._id, {
          status: "idle",
          currentAction: undefined,
          lastError: undefined,
          updatedAt: now,
        });
      }
    }

    // Set room to ready
    const readyCount = devices.length;
    await ctx.db.patch(args.roomId, {
      status: "ready",
      devicesReady: readyCount,
      updatedAt: now,
    });

    return { ok: true, resolvedAt: now };
  },
});
