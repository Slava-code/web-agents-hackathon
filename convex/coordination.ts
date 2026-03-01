import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// --- Resource Locks ---

export const claimResource = internalMutation({
  args: {
    agentId: v.string(),
    resourceType: v.union(v.literal("room"), v.literal("device")),
    resourceId: v.string(),
    action: v.string(),
    ttlMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ttl = args.ttlMs ?? 300000;

    // Check for existing held lock on this resource
    const existingLocks = await ctx.db
      .query("resourceLocks")
      .withIndex("by_resource_status", (q) =>
        q.eq("resourceId", args.resourceId).eq("status", "held")
      )
      .collect();

    for (const lock of existingLocks) {
      // Lazy TTL expiry
      if (now - lock.acquiredAt > lock.ttlMs) {
        await ctx.db.patch(lock._id, {
          status: "expired",
          releasedAt: now,
        });
        continue;
      }

      // Same agent re-claiming = idempotent
      if (lock.agentId === args.agentId) {
        return { ok: true, lockId: lock._id, idempotent: true };
      }

      // Different agent → blocked
      return {
        ok: false,
        error: "resource_locked",
        heldBy: lock.agentId,
        lockId: lock._id,
      };
    }

    // Grant new lock
    const lockId = await ctx.db.insert("resourceLocks", {
      agentId: args.agentId,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      action: args.action,
      status: "held",
      acquiredAt: now,
      ttlMs: ttl,
    });

    return { ok: true, lockId };
  },
});

export const releaseResource = internalMutation({
  args: {
    agentId: v.string(),
    resourceId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existingLocks = await ctx.db
      .query("resourceLocks")
      .withIndex("by_resource_status", (q) =>
        q.eq("resourceId", args.resourceId).eq("status", "held")
      )
      .collect();

    for (const lock of existingLocks) {
      if (lock.agentId !== args.agentId) {
        return {
          ok: false,
          error: "not_owner",
          heldBy: lock.agentId,
        };
      }

      await ctx.db.patch(lock._id, {
        status: "released",
        releasedAt: now,
      });

      return { ok: true };
    }

    return { ok: false, error: "no_lock_found" };
  },
});

// --- Agent Messages ---

export const postMessage = internalMutation({
  args: {
    fromAgent: v.string(),
    toAgent: v.optional(v.string()),
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
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const messageId = await ctx.db.insert("agentMessages", {
      fromAgent: args.fromAgent,
      toAgent: args.toAgent ?? "broadcast",
      type: args.type,
      payload: args.payload,
      status: "sent",
      roomId: args.roomId,
      timestamp: now,
    });

    return { ok: true, messageId };
  },
});

// --- Queries ---

export const getMessagesForAgent = internalQuery({
  args: {
    agentId: v.string(),
    roomId: v.id("rooms"),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lim = args.limit ?? 50;
    const since = args.since ?? 0;

    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_room_timestamp", (q) =>
        q.eq("roomId", args.roomId).gt("timestamp", since)
      )
      .order("desc")
      .take(lim);

    // Filter to broadcast + directed to this agent
    return messages.filter(
      (m) => m.toAgent === "broadcast" || m.toAgent === args.agentId
    );
  },
});

export const getActiveLocks = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    // Get all devices in this room to find their IDs
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const deviceIds = devices.map((d) => d._id as string);
    const resourceIds = [args.roomId as string, ...deviceIds];

    const locks = [];
    for (const rid of resourceIds) {
      const held = await ctx.db
        .query("resourceLocks")
        .withIndex("by_resource_status", (q) =>
          q.eq("resourceId", rid).eq("status", "held")
        )
        .collect();
      locks.push(...held);
    }

    return locks;
  },
});

export const getAgentMessages = query({
  args: {
    roomId: v.id("rooms"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lim = args.limit ?? 20;

    return await ctx.db
      .query("agentMessages")
      .withIndex("by_room_timestamp", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .take(lim);
  },
});

export const getCoordinationState = internalQuery({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    // Find latest task graph for this room by looking at recent tasks
    // We need to find the commandId from tasks whose input references this room
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const deviceIds = devices.map((d) => d._id as string);
    const resourceIds = [args.roomId as string, ...deviceIds];

    // Get held locks for room + devices
    const locks = [];
    for (const rid of resourceIds) {
      const held = await ctx.db
        .query("resourceLocks")
        .withIndex("by_resource_status", (q) =>
          q.eq("resourceId", rid).eq("status", "held")
        )
        .collect();
      locks.push(...held);
    }

    // Get recent messages
    const recentMessages = await ctx.db
      .query("agentMessages")
      .withIndex("by_room_timestamp", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .take(10);

    // Find the most recent active task graph
    // Look through all tasks to find one referencing this room
    const allTasks = await ctx.db.query("taskGraph").order("desc").take(100);

    // Group by commandId and find one that matches this room
    let activeCommandId: string | null = null;
    for (const task of allTasks) {
      const input = task.input as Record<string, unknown> | undefined;
      if (input && input.roomId === args.roomId) {
        activeCommandId = task.commandId;
        break;
      }
    }

    if (!activeCommandId) {
      return {
        activeScenario: null,
        commandId: null,
        currentPhase: 0,
        activeAgent: null,
        activeTask: null,
        locks: locks.map((l) => ({
          agentId: l.agentId,
          resourceType: l.resourceType,
          action: l.action,
        })),
        tasks: [],
        recentMessages: recentMessages.reverse(),
        progress: { total: 0, completed: 0, running: 0, pending: 0, failed: 0 },
        allDone: false,
      };
    }

    // Get all tasks for this command
    const tasks = await ctx.db
      .query("taskGraph")
      .withIndex("by_command", (q) => q.eq("commandId", activeCommandId!))
      .collect();

    tasks.sort((a, b) => a.phase - b.phase);

    // Find active task (running, or highest completed, or first ready)
    const runningTask = tasks.find((t) => t.status === "running");
    const readyTask = tasks.find((t) => t.status === "ready");
    const activeTask = runningTask ?? readyTask ?? null;

    const completed = tasks.filter((t) => t.status === "completed").length;
    const running = tasks.filter((t) => t.status === "running").length;
    const pending = tasks.filter(
      (t) => t.status === "pending" || t.status === "ready"
    ).length;
    const failed = tasks.filter((t) => t.status === "failed").length;
    const allDone = tasks.length > 0 && completed === tasks.length;

    return {
      activeScenario: "emergency_air_quality_response",
      commandId: activeCommandId,
      currentPhase: activeTask?.phase ?? (allDone ? tasks.length : 0),
      activeAgent: activeTask?.agentId ?? null,
      activeTask: activeTask
        ? {
            taskName: activeTask.taskName,
            status: activeTask.status,
            phase: activeTask.phase,
          }
        : null,
      locks: locks.map((l) => ({
        agentId: l.agentId,
        resourceType: l.resourceType,
        action: l.action,
      })),
      tasks: tasks.map((t) => ({
        taskId: t._id,
        taskName: t.taskName,
        phase: t.phase,
        status: t.status,
        agentId: t.agentId,
      })),
      recentMessages: recentMessages.reverse(),
      progress: {
        total: tasks.length,
        completed,
        running,
        pending,
        failed,
      },
      allDone,
    };
  },
});
