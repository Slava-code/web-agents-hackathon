import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const createEmergencyAirQualityScenario = internalMutation({
  args: {
    commandId: v.string(),
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args): Promise<{
    ok: boolean;
    commandId: string;
    tasks: { env: string; tug: string; uv: string; ehr: string };
    taskCount: number;
  }> => {
    // Look up devices in the room
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const findDevice = (name: string) =>
      devices.find((d) => d.name === name);

    const envDevice = findDevice("Environmental Monitoring");
    const tugDevice = findDevice("TUG Fleet Monitor");
    const uvDevice = findDevice("UV Robot");
    const ehrDevice = findDevice("Room Scheduling");

    if (!envDevice || !tugDevice || !uvDevice || !ehrDevice) {
      const missing = [
        !envDevice && "Environmental Monitoring",
        !tugDevice && "TUG Fleet Monitor",
        !uvDevice && "UV Robot",
        !ehrDevice && "Room Scheduling",
      ].filter(Boolean);
      throw new Error(`Missing devices in room: ${missing.join(", ")}`);
    }

    // Phase 1: ENV — Detect & Assess Anomaly (no deps) → ready
    const env = await ctx.runMutation(internal.taskGraph.createTask, {
      commandId: args.commandId,
      agentId: "env-agent",
      taskName: "ENV Detect & Assess Anomaly",
      phase: 1,
      dependsOn: [],
      input: {
        roomId: args.roomId,
        deviceId: envDevice._id,
        deviceUrl: envDevice.url,
        instructions:
          "Navigate to the Environmental Monitoring dashboard. Identify all out-of-range readings (CO2, particulate, temperature, humidity, pressure differential). Acknowledge each alert. Document the severity assessment with exact values and how far each reading is from its allowed range.",
        expectedOutput: {
          alertsAcknowledged: "number of alerts acknowledged",
          assessment: "severity assessment string",
          outOfRangeReadings: "array of { field, value, allowedRange }",
        },
      },
    });

    // Phase 2: TUG — Emergency Supply Delivery (depends on ENV)
    const tug = await ctx.runMutation(internal.taskGraph.createTask, {
      commandId: args.commandId,
      agentId: "tug-agent",
      taskName: "TUG Emergency Supply Delivery",
      phase: 2,
      dependsOn: [env.taskId],
      input: {
        roomId: args.roomId,
        deviceId: tugDevice._id,
        deviceUrl: tugDevice.url,
        instructions:
          "Navigate to the TUG Fleet Monitor dashboard. Dispatch an available TUG bot to OR-3 with emergency supplies: HEPA filters, air quality sensors, and replacement ventilation components. Monitor until delivery is confirmed.",
        expectedOutput: {
          delivered: "boolean",
          botId: "TUG bot identifier",
          supplies: "array of delivered items",
        },
      },
    });

    // Phase 3: UV — Sterilization Cycle (depends on TUG)
    const uv = await ctx.runMutation(internal.taskGraph.createTask, {
      commandId: args.commandId,
      agentId: "uv-agent",
      taskName: "UV Sterilization Cycle",
      phase: 3,
      dependsOn: [tug.taskId],
      input: {
        roomId: args.roomId,
        deviceId: uvDevice._id,
        deviceUrl: uvDevice.url,
        instructions:
          "Navigate to the UV Robot dashboard. Set cycle mode to Terminal and intensity to 100%. Start the sterilization cycle. Wait for the cycle to complete. Verify sterilization confirmation.",
        expectedOutput: {
          sterilized: "boolean",
          mode: "Terminal",
          intensity: 100,
          cycleTime: "duration of cycle",
        },
      },
    });

    // Phase 4: EHR — Confirm Room Ready (depends on UV)
    const ehr = await ctx.runMutation(internal.taskGraph.createTask, {
      commandId: args.commandId,
      agentId: "ehr-agent",
      taskName: "EHR Confirm Room Ready",
      phase: 4,
      dependsOn: [uv.taskId],
      input: {
        roomId: args.roomId,
        deviceId: ehrDevice._id,
        deviceUrl: ehrDevice.url,
        instructions:
          "Navigate to the Room Scheduling (EHR) dashboard. Confirm OR-3 status is Ready. Set delay to 0 minutes. Verify the schedule shows no delays and the room is operational.",
        expectedOutput: {
          roomStatus: "Ready",
          delayMinutes: 0,
          confirmed: "boolean",
        },
      },
    });

    return {
      ok: true,
      commandId: args.commandId,
      tasks: {
        env: env.taskId,
        tug: tug.taskId,
        uv: uv.taskId,
        ehr: ehr.taskId,
      },
      taskCount: 4,
    };
  },
});

export const createPrepareRoomScenario = internalMutation({
  args: {
    commandId: v.string(),
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args): Promise<{
    ok: boolean;
    commandId: string;
    tasks: { tug: string; uv: string };
    taskCount: number;
  }> => {
    // Set room to "preparing" immediately
    const room = await ctx.db.get(args.roomId);
    if (room) {
      await ctx.db.patch(args.roomId, { status: "preparing" });
    }

    // Look up devices in the room
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const findDevice = (name: string) =>
      devices.find((d) => d.name === name);

    const tugDevice = findDevice("TUG Fleet Monitor");
    const uvDevice = findDevice("UV Robot");

    if (!tugDevice || !uvDevice) {
      const missing = [
        !tugDevice && "TUG Fleet Monitor",
        !uvDevice && "UV Robot",
      ].filter(Boolean);
      throw new Error(`Missing devices in room: ${missing.join(", ")}`);
    }

    // Phase 1: TUG — Deploy to Sterilization (no deps) → ready
    const tug = await ctx.runMutation(internal.taskGraph.createTask, {
      commandId: args.commandId,
      agentId: "tug-agent",
      taskName: "TUG Deploy to Sterilization",
      phase: 1,
      dependsOn: [],
      input: {
        roomId: args.roomId,
        deviceId: tugDevice._id,
        deviceUrl: tugDevice.url,
        scenarioType: "prepare_room",
        instructions: `Navigate to ${tugDevice.url}. This is a TUG Fleet Monitor dashboard showing 4 robot bots in a table. Find the row for bot 'TUG-01' named 'Alpha'. Its status should show 'IDLE'. In that row, click the green button labeled 'Deploy to Sterilization' (data-testid: deploy-btn-TUG-01). After clicking, the bot's status badge (data-testid: bot-status-TUG-01) should change from 'IDLE' to 'EN_ROUTE'. Wait until you see the status text change, then report success.`,
        expectedOutput: {
          deployed: "boolean",
          botName: "Alpha",
          newStatus: "EN_ROUTE",
        },
      },
    });

    // Phase 2: UV — Start Sterilization Cycle (depends on TUG)
    const uv = await ctx.runMutation(internal.taskGraph.createTask, {
      commandId: args.commandId,
      agentId: "uv-agent",
      taskName: "UV Start Sterilization Cycle",
      phase: 2,
      dependsOn: [tug.taskId],
      input: {
        roomId: args.roomId,
        deviceId: uvDevice._id,
        deviceUrl: uvDevice.url,
        scenarioType: "prepare_room",
        instructions: `Navigate to ${uvDevice.url}. This is a UV-C Disinfection System control panel. Step 1: Find the 'Target Room' dropdown (data-testid: room-selector) and select 'OR-3'. Step 2: Find the cycle mode radio buttons and click the one labeled 'standard' (data-testid: mode-standard). Step 3: Click the black 'Start Cycle' button (data-testid: start-cycle-btn). Step 4: Watch the large progress number (data-testid: progress-value) in the center of the page. It will count from 0 to 100. Wait until the status text (data-testid: cycle-status) below the number changes to 'complete'. Then report success.`,
        expectedOutput: {
          sterilized: "boolean",
          mode: "standard",
          targetRoom: "OR-3",
        },
      },
    });

    return {
      ok: true,
      commandId: args.commandId,
      tasks: {
        tug: tug.taskId,
        uv: uv.taskId,
      },
      taskCount: 2,
    };
  },
});
