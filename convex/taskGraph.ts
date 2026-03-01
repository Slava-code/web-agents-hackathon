import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const createTask = internalMutation({
  args: {
    commandId: v.string(),
    agentId: v.string(),
    taskName: v.string(),
    phase: v.number(),
    dependsOn: v.array(v.string()),
    input: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Auto-set status to "ready" if no dependencies
    const status = args.dependsOn.length === 0 ? "ready" : "pending";

    const taskId = await ctx.db.insert("taskGraph", {
      commandId: args.commandId,
      agentId: args.agentId,
      taskName: args.taskName,
      phase: args.phase,
      dependsOn: args.dependsOn,
      status,
      input: args.input,
      createdAt: now,
    });

    return { taskId, status };
  },
});

export const updateTaskStatus = internalMutation({
  args: {
    taskId: v.id("taskGraph"),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    output: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    // Validate state transitions
    const validTransitions: Record<string, string[]> = {
      ready: ["running"],
      running: ["completed", "failed"],
    };

    const allowed = validTransitions[task.status];
    if (!allowed || !allowed.includes(args.status)) {
      throw new Error(
        `Invalid transition: ${task.status} → ${args.status}. Allowed: ${allowed?.join(", ") ?? "none"}`
      );
    }

    const updates: Record<string, unknown> = {
      status: args.status,
    };

    if (args.status === "running") {
      updates.startedAt = now;
    }
    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = now;
      if (args.output !== undefined) {
        updates.output = args.output;
      }
    }

    await ctx.db.patch(args.taskId, updates);

    // On completion, promote downstream tasks
    const unblockedTasks: string[] = [];

    if (args.status === "completed") {
      const taskIdStr = args.taskId as string;

      // Find all tasks in same command
      const allTasks = await ctx.db
        .query("taskGraph")
        .withIndex("by_command", (q) => q.eq("commandId", task.commandId))
        .collect();

      // Get set of completed task IDs (including the one we just completed)
      const completedIds = new Set(
        allTasks
          .filter((t) => t.status === "completed" || t._id === args.taskId)
          .map((t) => t._id as string)
      );

      // Promote pending tasks whose dependencies are ALL completed
      for (const t of allTasks) {
        if (t.status !== "pending") continue;
        if (!t.dependsOn.includes(taskIdStr)) continue; // not dependent on us

        const allDepsMet = t.dependsOn.every((depId) =>
          completedIds.has(depId)
        );
        if (allDepsMet) {
          await ctx.db.patch(t._id, { status: "ready" });
          unblockedTasks.push(t._id as string);
        }
      }

      // Check if ALL tasks in this command are now completed
      const refreshedTasks = await ctx.db
        .query("taskGraph")
        .withIndex("by_command", (q) => q.eq("commandId", task.commandId))
        .collect();

      const allDone =
        refreshedTasks.length > 0 &&
        refreshedTasks.every((t) => t.status === "completed");

      if (allDone) {
        // Find the roomId and scenarioType from any task's input
        const taskWithRoom = refreshedTasks.find(
          (t) => t.input && (t.input as Record<string, unknown>).roomId
        );
        if (taskWithRoom) {
          const input = taskWithRoom.input as Record<string, unknown>;
          const roomId = input.roomId as string;
          const scenarioType = input.scenarioType as string | undefined;

          if (scenarioType === "prepare_room") {
            // For prepare_room: just set room to "ready" directly
            const roomDoc = await ctx.db.get(roomId as Id<"rooms">);
            if (roomDoc) {
              await ctx.db.patch(roomId as Id<"rooms">, {
                status: "ready",
                updatedAt: Date.now(),
              });
            }
          } else {
            // For emergency flows: resolve anomaly (resets env readings + devices)
            await ctx.runMutation(internal.deviceMutations.resolveAnomaly, {
              roomId: roomId as Id<"rooms">,
            });
          }
        }
      }

      return { ok: true, unblockedTasks, allDone };
    }

    return { ok: true, unblockedTasks };
  },
});

export const getNextTask = internalQuery({
  args: {
    agentId: v.string(),
    commandId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find a "ready" task for this agent in this command
    const tasks = await ctx.db
      .query("taskGraph")
      .withIndex("by_agent_command", (q) =>
        q.eq("agentId", args.agentId).eq("commandId", args.commandId)
      )
      .collect();

    const readyTask = tasks.find((t) => t.status === "ready");
    if (readyTask) {
      return { task: readyTask, waiting: false };
    }

    const runningTask = tasks.find((t) => t.status === "running");
    if (runningTask) {
      return { task: runningTask, waiting: false, alreadyRunning: true };
    }

    // Check if blocked
    const pendingTask = tasks.find((t) => t.status === "pending");
    if (pendingTask) {
      // Find what's blocking it
      const blockers = [];
      for (const depId of pendingTask.dependsOn) {
        const dep = await ctx.db.get(depId as Id<"taskGraph">);
        if (dep && dep.status !== "completed") {
          blockers.push({
            taskId: dep._id,
            taskName: dep.taskName,
            agentId: dep.agentId,
            status: dep.status,
          });
        }
      }
      return { task: null, waiting: true, blockedBy: blockers };
    }

    // All done or no tasks
    const completedTasks = tasks.filter((t) => t.status === "completed");
    if (completedTasks.length > 0) {
      return { task: null, waiting: false, allDone: true };
    }

    return { task: null, waiting: false, noTasks: true };
  },
});

export const getTaskGraph = query({
  args: {
    commandId: v.string(),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("taskGraph")
      .withIndex("by_command", (q) => q.eq("commandId", args.commandId))
      .collect();

    tasks.sort((a, b) => a.phase - b.phase);

    const completed = tasks.filter((t) => t.status === "completed").length;
    const running = tasks.filter((t) => t.status === "running").length;
    const pending = tasks.filter(
      (t) => t.status === "pending" || t.status === "ready"
    ).length;
    const failed = tasks.filter((t) => t.status === "failed").length;
    const allDone = tasks.length > 0 && completed === tasks.length;

    return {
      tasks,
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
