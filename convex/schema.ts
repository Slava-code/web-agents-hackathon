import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    name: v.string(),
    status: v.union(
      v.literal("idle"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("in_use"),
      v.literal("needs_attention"),
    ),
    procedure: v.optional(v.string()),
    deviceCount: v.number(),
    devicesReady: v.number(),
    updatedAt: v.number(),
  }),

  devices: defineTable({
    name: v.string(),
    category: v.string(),
    roomId: v.id("rooms"),
    url: v.string(),
    status: v.union(
      v.literal("idle"),
      v.literal("configuring"),
      v.literal("ready"),
      v.literal("error"),
    ),
    currentAction: v.optional(v.string()),
    lastError: v.optional(v.string()),
    fields: v.any(),
    fieldSchema: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_status", ["status"]),

  commands: defineTable({
    text: v.string(),
    roomId: v.id("rooms"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    deviceCount: v.number(),
    devicesReady: v.number(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    elapsedMs: v.optional(v.number()),
  }).index("by_room", ["roomId"]),

  actionLogs: defineTable({
    deviceId: v.id("devices"),
    commandId: v.id("commands"),
    action: v.string(),
    result: v.union(
      v.literal("success"),
      v.literal("failure"),
      v.literal("in_progress"),
    ),
    timestamp: v.number(),
  })
    .index("by_device", ["deviceId"])
    .index("by_command", ["commandId"]),

  environmentReadings: defineTable({
    roomId: v.id("rooms"),
    temperature: v.optional(v.number()),
    humidity: v.optional(v.number()),
    bacterialConcentration: v.optional(v.number()),
    co2: v.optional(v.number()),
    oxygen: v.optional(v.number()),
    particulateCount: v.optional(v.number()),
    pressureDifferential: v.optional(v.number()),
    allWithinRange: v.boolean(),
    outOfRangeFields: v.optional(v.array(v.string())),
    timestamp: v.number(),
  }).index("by_room", ["roomId"]),
});
