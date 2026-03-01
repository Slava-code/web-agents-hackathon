import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const byCommand = query({
  args: { commandId: v.id("commands") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("actionLogs")
      .withIndex("by_command", (q) => q.eq("commandId", args.commandId))
      .order("desc")
      .take(50);
  },
});

export const log = mutation({
  args: {
    deviceId: v.id("devices"),
    commandId: v.id("commands"),
    action: v.string(),
    result: v.union(
      v.literal("success"),
      v.literal("failure"),
      v.literal("in_progress"),
    ),
    reasoning: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("actionLogs", {
      deviceId: args.deviceId,
      commandId: args.commandId,
      action: args.action,
      result: args.result,
      reasoning: args.reasoning,
      timestamp: Date.now(),
    });
  },
});
