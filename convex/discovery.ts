import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// --- Public mutations ---

export const createSession = mutation({
  args: {
    mode: v.union(v.literal("mock"), v.literal("live")),
    baseUrl: v.string(),
    pages: v.array(
      v.object({
        pageUrl: v.string(),
        pageName: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const sessionId = await ctx.db.insert("discoverySessions", {
      mode: args.mode,
      baseUrl: args.baseUrl,
      status: "running",
      totalPages: args.pages.length,
      completedPages: 0,
      startedAt: now,
    });

    for (const page of args.pages) {
      await ctx.db.insert("discoveryPages", {
        sessionId: sessionId,
        pageUrl: page.pageUrl,
        pageName: page.pageName,
        status: "pending",
        updatedAt: now,
      });
    }

    await ctx.db.insert("discoveryLogs", {
      sessionId: sessionId,
      level: "info",
      message: `Discovery session started in ${args.mode} mode with ${args.pages.length} pages`,
      timestamp: now,
    });

    return { sessionId };
  },
});

export const resetDiscovery = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "discoveryLogs",
      "discoveryPages",
      "discoverySessions",
    ] as const;
    let deleted = 0;
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { ok: true, deleted };
  },
});

// --- Internal mutations (called from HTTP routes) ---

export const logActivity = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("discoveryLogs", {
      sessionId: args.sessionId,
      pageUrl: args.pageUrl,
      level: args.level,
      message: args.message,
      detail: args.detail,
      timestamp: Date.now(),
    });
  },
});

export const updatePageStatus = internalMutation({
  args: {
    sessionId: v.string(),
    pageUrl: v.string(),
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
  },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("discoveryPages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const page = pages.find((p) => p.pageUrl === args.pageUrl);
    if (!page) {
      throw new Error(
        `Page ${args.pageUrl} not found in session ${args.sessionId}`,
      );
    }

    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.discoveredFields !== undefined)
      patch.discoveredFields = args.discoveredFields;
    if (args.inferredSchema !== undefined)
      patch.inferredSchema = args.inferredSchema;
    if (args.extractionScript !== undefined)
      patch.extractionScript = args.extractionScript;
    if (args.extractedData !== undefined)
      patch.extractedData = args.extractedData;
    if (args.error !== undefined) patch.error = args.error;

    await ctx.db.patch(page._id, patch);

    // If page is complete, update session completedPages count
    if (args.status === "complete") {
      const session = await ctx.db.get(
        args.sessionId as any,
      );
      if (session) {
        const newCompleted = (session as any).completedPages + 1;
        await ctx.db.patch(session._id, {
          completedPages: newCompleted,
        });
      }
    }

    return { ok: true };
  },
});

export const completeSession = internalMutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId as any);
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    const now = Date.now();
    await ctx.db.patch(session._id, {
      status: "completed" as const,
      completedAt: now,
      elapsedMs: now - (session as any).startedAt,
    });

    return { ok: true };
  },
});

// --- Public queries (for React useQuery subscriptions) ---

export const getLatestSession = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("discoverySessions").order("desc").first();
    return sessions;
  },
});

export const getSessionPages = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("discoveryPages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const getSessionLogs = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("discoveryLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});
