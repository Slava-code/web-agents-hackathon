import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

// --- CORS helpers ---

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function optionsHandler() {
  return httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  });
}

// --- POST /device-update ---

http.route({
  path: "/device-update",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { deviceId, status, currentAction, lastError } = body;

      if (!deviceId || !status) {
        return jsonResponse({ error: "deviceId and status are required" }, 400);
      }

      const result = await ctx.runMutation(internal.deviceMutations.updateDeviceStatus, {
        deviceId: deviceId as Id<"devices">,
        status,
        currentAction,
        lastError,
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/device-update",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- POST /field-update ---

http.route({
  path: "/field-update",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { deviceId, fields } = body;

      if (!deviceId || !fields) {
        return jsonResponse({ error: "deviceId and fields are required" }, 400);
      }

      const result = await ctx.runMutation(internal.deviceMutations.updateDeviceFields, {
        deviceId: deviceId as Id<"devices">,
        fields,
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/field-update",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- GET /room-state ---

http.route({
  path: "/room-state",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const roomId = url.searchParams.get("roomId");

      if (!roomId) {
        return jsonResponse({ error: "roomId query parameter is required" }, 400);
      }

      const result = await ctx.runQuery(internal.roomQueries.getRoomState, {
        roomId: roomId as Id<"rooms">,
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

// --- POST /trigger-anomaly ---

http.route({
  path: "/trigger-anomaly",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { roomId, scenario } = body;

      if (!roomId || !scenario) {
        return jsonResponse({ error: "roomId and scenario are required" }, 400);
      }

      const allowedScenarios = ["ventilation_failure", "battery_failure", "co2_spike"];
      if (!allowedScenarios.includes(scenario)) {
        return jsonResponse(
          { error: `Invalid scenario. Allowed: ${allowedScenarios.join(", ")}` },
          400,
        );
      }

      const result = await ctx.runMutation(internal.deviceMutations.triggerAnomaly, {
        roomId: roomId as Id<"rooms">,
        scenario,
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/trigger-anomaly",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- POST /action-log ---

http.route({
  path: "/action-log",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { deviceId, commandId, action, result, reasoning } = body;

      if (!deviceId || !commandId || !action || !result) {
        return jsonResponse(
          { error: "deviceId, commandId, action, and result are required" },
          400,
        );
      }

      const validResults = ["success", "failure", "in_progress"];
      if (!validResults.includes(result)) {
        return jsonResponse(
          { error: `Invalid result. Allowed: ${validResults.join(", ")}` },
          400,
        );
      }

      const logId = await ctx.runMutation(api.actionLogs.log, {
        deviceId: deviceId as Id<"devices">,
        commandId: commandId as Id<"commands">,
        action,
        result,
        ...(reasoning !== undefined ? { reasoning } : {}),
      });

      return jsonResponse({ ok: true, logId });
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/action-log",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- POST /discovery-start ---

http.route({
  path: "/discovery-start",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { mode, baseUrl, pages } = body;

      if (!mode || !baseUrl || !Array.isArray(pages)) {
        return jsonResponse(
          { error: "mode, baseUrl, and pages[] are required" },
          400,
        );
      }

      const result = await ctx.runMutation(api.discovery.createSession, {
        mode,
        baseUrl,
        pages,
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/discovery-start",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- POST /discovery-log ---

http.route({
  path: "/discovery-log",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { sessionId, pageUrl, level, message, detail } = body;

      if (!sessionId || !level || !message) {
        return jsonResponse(
          { error: "sessionId, level, and message are required" },
          400,
        );
      }

      const logId = await ctx.runMutation(internal.discovery.logActivity, {
        sessionId,
        pageUrl,
        level,
        message,
        detail,
      });

      return jsonResponse({ ok: true, logId });
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/discovery-log",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- POST /discovery-update ---

http.route({
  path: "/discovery-update",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { sessionId, pageUrl, status, discoveredFields, inferredSchema, extractionScript, extractedData, error } = body;

      if (!sessionId || !pageUrl || !status) {
        return jsonResponse(
          { error: "sessionId, pageUrl, and status are required" },
          400,
        );
      }

      const result = await ctx.runMutation(internal.discovery.updatePageStatus, {
        sessionId,
        pageUrl,
        status,
        ...(discoveredFields !== undefined ? { discoveredFields } : {}),
        ...(inferredSchema !== undefined ? { inferredSchema } : {}),
        ...(extractionScript !== undefined ? { extractionScript } : {}),
        ...(extractedData !== undefined ? { extractedData } : {}),
        ...(error !== undefined ? { error } : {}),
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/discovery-update",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- POST /discovery-complete ---

http.route({
  path: "/discovery-complete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { sessionId } = body;

      if (!sessionId) {
        return jsonResponse({ error: "sessionId is required" }, 400);
      }

      const result = await ctx.runMutation(internal.discovery.completeSession, {
        sessionId,
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/discovery-complete",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- POST /discovery-reset ---

http.route({
  path: "/discovery-reset",
  method: "POST",
  handler: httpAction(async (ctx) => {
    try {
      const result = await ctx.runMutation(api.discovery.resetDiscovery, {});
      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/discovery-reset",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- POST /agent-claim ---

http.route({
  path: "/agent-claim",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { agentId, resourceType, resourceId, action, ttlMs } = body;

      if (!agentId || !resourceType || !resourceId || !action) {
        return jsonResponse(
          { error: "agentId, resourceType, resourceId, and action are required" },
          400,
        );
      }

      const validTypes = ["room", "device"];
      if (!validTypes.includes(resourceType)) {
        return jsonResponse(
          { error: `Invalid resourceType. Allowed: ${validTypes.join(", ")}` },
          400,
        );
      }

      const result = await ctx.runMutation(internal.coordination.claimResource, {
        agentId,
        resourceType,
        resourceId,
        action,
        ...(ttlMs !== undefined ? { ttlMs } : {}),
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/agent-claim",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- POST /agent-release ---

http.route({
  path: "/agent-release",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { agentId, resourceId } = body;

      if (!agentId || !resourceId) {
        return jsonResponse(
          { error: "agentId and resourceId are required" },
          400,
        );
      }

      const result = await ctx.runMutation(internal.coordination.releaseResource, {
        agentId,
        resourceId,
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/agent-release",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- POST /agent-message ---

http.route({
  path: "/agent-message",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { fromAgent, toAgent, type, payload, roomId } = body;

      if (!fromAgent || !type || !roomId) {
        return jsonResponse(
          { error: "fromAgent, type, and roomId are required" },
          400,
        );
      }

      const validTypes = ["intent", "claim", "release", "request", "response", "alert", "heartbeat"];
      if (!validTypes.includes(type)) {
        return jsonResponse(
          { error: `Invalid type. Allowed: ${validTypes.join(", ")}` },
          400,
        );
      }

      const result = await ctx.runMutation(internal.coordination.postMessage, {
        fromAgent,
        ...(toAgent !== undefined ? { toAgent } : {}),
        type,
        payload: payload ?? {},
        roomId: roomId as Id<"rooms">,
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/agent-message",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- GET /agent-messages ---

http.route({
  path: "/agent-messages",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const agentId = url.searchParams.get("agentId");
      const roomId = url.searchParams.get("roomId");
      const since = url.searchParams.get("since");
      const limit = url.searchParams.get("limit");

      if (!agentId || !roomId) {
        return jsonResponse(
          { error: "agentId and roomId query parameters are required" },
          400,
        );
      }

      const result = await ctx.runQuery(internal.coordination.getMessagesForAgent, {
        agentId,
        roomId: roomId as Id<"rooms">,
        ...(since ? { since: Number(since) } : {}),
        ...(limit ? { limit: Number(limit) } : {}),
      });

      return jsonResponse({ messages: result });
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

// --- POST /agent-task-update ---

http.route({
  path: "/agent-task-update",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { taskId, status, output } = body;

      if (!taskId || !status) {
        return jsonResponse(
          { error: "taskId and status are required" },
          400,
        );
      }

      const validStatuses = ["running", "completed", "failed"];
      if (!validStatuses.includes(status)) {
        return jsonResponse(
          { error: `Invalid status. Allowed: ${validStatuses.join(", ")}` },
          400,
        );
      }

      const result = await ctx.runMutation(internal.taskGraph.updateTaskStatus, {
        taskId: taskId as Id<"taskGraph">,
        status,
        ...(output !== undefined ? { output } : {}),
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/agent-task-update",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- GET /agent-next-task ---

http.route({
  path: "/agent-next-task",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const agentId = url.searchParams.get("agentId");
      const commandId = url.searchParams.get("commandId");

      if (!agentId || !commandId) {
        return jsonResponse(
          { error: "agentId and commandId query parameters are required" },
          400,
        );
      }

      const result = await ctx.runQuery(internal.taskGraph.getNextTask, {
        agentId,
        commandId,
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

// --- POST /coordination-start ---

http.route({
  path: "/coordination-start",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { commandId, roomId, scenario } = body;

      if (!commandId || !roomId) {
        return jsonResponse(
          { error: "commandId and roomId are required" },
          400,
        );
      }

      const scenarioName = scenario ?? "emergency_air_quality_response";
      const validScenarios = ["emergency_air_quality_response"];
      if (!validScenarios.includes(scenarioName)) {
        return jsonResponse(
          { error: `Invalid scenario. Allowed: ${validScenarios.join(", ")}` },
          400,
        );
      }

      const result = await ctx.runMutation(
        internal.scenarios.createEmergencyAirQualityScenario,
        {
          commandId,
          roomId: roomId as Id<"rooms">,
        },
      );

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/coordination-start",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- POST /coordination-reset ---

http.route({
  path: "/coordination-reset",
  method: "POST",
  handler: httpAction(async (ctx) => {
    try {
      const result = await ctx.runMutation(internal.seed.resetCoordination, {});
      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/coordination-reset",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- GET /coordination-state ---

http.route({
  path: "/coordination-state",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const roomId = url.searchParams.get("roomId");

      if (!roomId) {
        return jsonResponse(
          { error: "roomId query parameter is required" },
          400,
        );
      }

      const result = await ctx.runQuery(internal.coordination.getCoordinationState, {
        roomId: roomId as Id<"rooms">,
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

// --- POST /resolve-anomaly ---

http.route({
  path: "/resolve-anomaly",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { roomId } = body;

      if (!roomId) {
        return jsonResponse({ error: "roomId is required" }, 400);
      }

      const result = await ctx.runMutation(internal.deviceMutations.resolveAnomaly, {
        roomId: roomId as Id<"rooms">,
      });

      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

http.route({
  path: "/resolve-anomaly",
  method: "OPTIONS",
  handler: optionsHandler(),
});

// --- POST /seed ---

http.route({
  path: "/seed",
  method: "POST",
  handler: httpAction(async (ctx) => {
    try {
      await ctx.runMutation(internal.seed.init, {});
      return jsonResponse({ ok: true, message: "Seed complete" });
    } catch (e: any) {
      return jsonResponse({ error: e.message }, 500);
    }
  }),
});

export default http;
