import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const getRoomState = internalQuery({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const devices = await ctx.db
      .query("devices")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const environmentReadings = await ctx.db
      .query("environmentReadings")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .take(10);

    return { room, devices, environmentReadings };
  },
});
