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

export default http;
