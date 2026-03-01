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
    reasoning: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_device", ["deviceId"])
    .index("by_command", ["commandId"]),

  // --- Discovery tables ---

  discoverySessions: defineTable({
    mode: v.union(v.literal("mock"), v.literal("live")),
    baseUrl: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    totalPages: v.number(),
    completedPages: v.number(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    elapsedMs: v.optional(v.number()),
  }),

  discoveryPages: defineTable({
    sessionId: v.string(),
    pageUrl: v.string(),
    pageName: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("visiting"),
      v.literal("analyzing"),
      v.literal("schema_created"),
      v.literal("extracting"),
      v.literal("complete"),
      v.literal("error"),
    ),
    discoveredFields: v.optional(v.any()),
    inferredSchema: v.optional(v.any()),
    extractionScript: v.optional(v.string()),
    extractedData: v.optional(v.any()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_session", ["sessionId"]),

  discoveryLogs: defineTable({
    sessionId: v.string(),
    pageUrl: v.optional(v.string()),
    level: v.union(
      v.literal("info"),
      v.literal("agent_thought"),
      v.literal("success"),
      v.literal("error"),
      v.literal("schema"),
      v.literal("script"),
      v.literal("data"),
    ),
    message: v.string(),
    detail: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_session", ["sessionId"]),

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

  // --- Agent Coordination tables ---

  agentMessages: defineTable({
    fromAgent: v.string(),
    toAgent: v.string(), // "broadcast" for all
    type: v.union(
      v.literal("intent"),
      v.literal("claim"),
      v.literal("release"),
      v.literal("request"),
      v.literal("response"),
      v.literal("alert"),
      v.literal("heartbeat"),
    ),
    payload: v.any(),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
    ),
    roomId: v.id("rooms"),
    timestamp: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_toAgent", ["toAgent"])
    .index("by_room_timestamp", ["roomId", "timestamp"]),

  resourceLocks: defineTable({
    agentId: v.string(),
    resourceType: v.union(v.literal("room"), v.literal("device")),
    resourceId: v.string(),
    action: v.string(),
    status: v.union(
      v.literal("held"),
      v.literal("released"),
      v.literal("expired"),
    ),
    acquiredAt: v.number(),
    releasedAt: v.optional(v.number()),
    ttlMs: v.number(), // default 300000 (5 min)
  })
    .index("by_resource_status", ["resourceId", "status"])
    .index("by_agent", ["agentId"]),

  taskGraph: defineTable({
    commandId: v.string(),
    agentId: v.string(),
    taskName: v.string(),
    phase: v.number(),
    dependsOn: v.array(v.string()), // array of taskGraph IDs
    status: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_command", ["commandId"])
    .index("by_agent_command", ["agentId", "commandId"])
    .index("by_command_status", ["commandId", "status"]),
});
