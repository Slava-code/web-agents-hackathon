import { NextRequest } from "next/server";
import { runBrowserUseTask, parseOutputAsJSON } from "@/lib/browser-use";

const CONVEX_URL =
  process.env.CONVEX_SITE_URL ||
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
  "https://impartial-whale-32.convex.site";

// Agent ordering by scenario — sequential phases
const SCENARIO_AGENTS: Record<string, string[]> = {
  prepare_room: ["tug-agent", "uv-agent"],
  emergency_air_quality_response: ["env-agent", "tug-agent", "uv-agent", "ehr-agent"],
};

interface TaskInfo {
  _id: string;
  taskName: string;
  phase: number;
  input: {
    roomId: string;
    deviceId: string;
    deviceUrl: string;
    instructions: string;
  };
}

const POLL_NEXT_TASK_INTERVAL_MS = 2000;
const POLL_NEXT_TASK_TIMEOUT_MS = 30000;

// ─── Helpers ──────────────────────────────────────────────────────────

async function convexFetch(
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<unknown> {
  const res = await fetch(`${CONVEX_URL}${path}`, {
    method: options?.method ?? "GET",
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  return res.json();
}

// ─── Route Handler ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "BROWSER_USE_API_KEY not set" }, { status: 500 });
  }

  let body: { roomId?: string; scenario?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { roomId, scenario = "ventilation_failure" } = body;
  if (!roomId) {
    return Response.json({ error: "roomId is required" }, { status: 400 });
  }

  // Determine scenario type for coordination
  const isPrepareRoom = scenario === "prepare_room";
  const coordinationScenario = isPrepareRoom ? "prepare_room" : "emergency_air_quality_response";
  const agentOrder = SCENARIO_AGENTS[coordinationScenario] ?? SCENARIO_AGENTS.emergency_air_quality_response;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream closed
        }
      };

      const startTime = Date.now();
      let totalCost = 0;
      let failed = false;
      let commandId = "";

      try {
        // ── Step 1: Discover room + devices via GET /room-state ──
        const roomState = (await convexFetch(`/room-state?roomId=${roomId}`)) as {
          room: { _id: string; name: string; status: string };
          devices: Array<{
            _id: string;
            name: string;
            category: string;
            url: string;
            status: string;
          }>;
        };

        if (!roomState?.room) {
          send({ type: "error", message: `Room not found: ${roomId}` });
          controller.close();
          return;
        }

        // ── Step 2: Trigger anomaly (skip for prepare_room) ──
        if (!isPrepareRoom) {
          const anomalyResult = (await convexFetch("/trigger-anomaly", {
            method: "POST",
            body: { roomId, scenario },
          })) as { ok: boolean; error?: string };

          if (!anomalyResult.ok) {
            send({
              type: "error",
              message: `Failed to trigger anomaly: ${anomalyResult.error ?? "unknown"}`,
            });
            controller.close();
            return;
          }

          send({ type: "anomaly_triggered", scenario });
        }

        // ── Step 3: Generate commandId and create task graph ──
        commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const startResult = (await convexFetch("/coordination-start", {
          method: "POST",
          body: { commandId, roomId, scenario: coordinationScenario },
        })) as {
          ok: boolean;
          commandId: string;
          tasks: Record<string, string>;
          taskCount: number;
          error?: string;
        };

        if (!startResult.ok) {
          send({
            type: "error",
            message: `Failed to start coordination: ${startResult.error ?? "unknown"}`,
          });
          controller.close();
          return;
        }

        send({
          type: "scenario_start",
          commandId,
          roomId,
          tasks: startResult.tasks,
          taskCount: startResult.taskCount,
        });

        // ── Step 4: Execute each phase sequentially ──
        for (let phaseIdx = 0; phaseIdx < agentOrder.length; phaseIdx++) {
          if (failed) break;

          const agentId = agentOrder[phaseIdx];
          const phase = phaseIdx + 1;

          try {
            // 4a. Poll for next task until ready
            let task: TaskInfo | null = null;

            const pollStart = Date.now();
            while (!task) {
              const nextResult = (await convexFetch(
                `/agent-next-task?agentId=${agentId}&commandId=${commandId}`
              )) as {
                task: TaskInfo | null;
                waiting: boolean;
                allDone?: boolean;
              };

              if (nextResult.task) {
                task = nextResult.task;
                break;
              }

              if (nextResult.allDone) {
                send({ type: "error", message: `All tasks already done at phase ${phase}` });
                break;
              }

              if (Date.now() - pollStart > POLL_NEXT_TASK_TIMEOUT_MS) {
                throw new Error(`Timeout waiting for task to become ready (phase ${phase})`);
              }

              await new Promise((r) => setTimeout(r, POLL_NEXT_TASK_INTERVAL_MS));
            }

            if (!task) break;

            send({
              type: "phase_start",
              phase,
              agentId,
              taskName: task.taskName,
            });

            // 4b. Claim the device lock
            const claimResult = (await convexFetch("/agent-claim", {
              method: "POST",
              body: {
                agentId,
                resourceType: "device",
                resourceId: task.input.deviceId,
                action: task.taskName,
              },
            })) as { ok: boolean; error?: string };

            if (!claimResult.ok) {
              send({
                type: "phase_error",
                phase,
                agentId,
                error: `Failed to claim device: ${claimResult.error ?? "unknown"}`,
              });
              // Mark task failed
              await convexFetch("/agent-task-update", {
                method: "POST",
                body: { taskId: task._id, status: "failed", output: { error: "claim_failed" } },
              });
              failed = true;
              break;
            }

            // 4c. Mark task as running
            await convexFetch("/agent-task-update", {
              method: "POST",
              body: { taskId: task._id, status: "running" },
            });

            // 4d. Launch BrowserUse session
            let sessionId = "";
            let liveUrl: string | null = null;

            const sessionResult = await runBrowserUseTask(
              task.input.instructions,
              apiKey,
              {
                model: "bu-mini",
                onStatus: (status: string) => {
                  send({ type: "agent_status", phase, status });
                },
              }
            );

            sessionId = sessionResult.sessionId;
            const cost = parseFloat(sessionResult.cost) || 0;
            totalCost += cost;

            send({
              type: "agent_start",
              phase,
              sessionId,
              liveUrl,
            });

            // 4e. Parse output
            const output = parseOutputAsJSON(sessionResult.output) ?? {
              raw: String(sessionResult.output).slice(0, 500),
              status: sessionResult.status,
            };

            const taskSucceeded = sessionResult.status !== "error";

            // 4f. Update task status
            const updateResult = (await convexFetch("/agent-task-update", {
              method: "POST",
              body: {
                taskId: task._id,
                status: taskSucceeded ? "completed" : "failed",
                output,
              },
            })) as { ok: boolean; allDone?: boolean };

            // 4g. Release device lock
            await convexFetch("/agent-release", {
              method: "POST",
              body: { agentId, resourceId: task.input.deviceId },
            });

            // 4h. Broadcast completion message
            await convexFetch("/agent-message", {
              method: "POST",
              body: {
                fromAgent: agentId,
                type: taskSucceeded ? "response" : "alert",
                payload: {
                  taskName: task.taskName,
                  status: taskSucceeded ? "completed" : "failed",
                  output,
                },
                roomId,
              },
            });

            if (taskSucceeded) {
              send({
                type: "phase_complete",
                phase,
                agentId,
                output,
                cost: cost.toFixed(4),
              });
            } else {
              send({
                type: "phase_error",
                phase,
                agentId,
                error: `BrowserUse session ended with status: ${sessionResult.status}`,
              });
              failed = true;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            send({ type: "phase_error", phase, agentId, error: msg });

            // Attempt cleanup: release lock + mark failed
            try {
              const nextResult = (await convexFetch(
                `/agent-next-task?agentId=${agentId}&commandId=${commandId}`
              )) as { task: { _id: string; input: { deviceId: string } } | null };
              if (nextResult?.task) {
                await convexFetch("/agent-task-update", {
                  method: "POST",
                  body: { taskId: nextResult.task._id, status: "failed", output: { error: msg } },
                });
                await convexFetch("/agent-release", {
                  method: "POST",
                  body: { agentId, resourceId: nextResult.task.input.deviceId },
                });
              }
            } catch {
              // cleanup best-effort
            }

            failed = true;
          }
        }

        // ── Step 5: Scenario complete ──
        const elapsedMs = Date.now() - startTime;

        // Check final coordination state
        const finalState = (await convexFetch(
          `/coordination-state?roomId=${roomId}`
        )) as { allDone: boolean };

        send({
          type: "scenario_complete",
          commandId,
          totalCost: totalCost.toFixed(4),
          elapsedMs,
          allDone: finalState.allDone ?? false,
          failed,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: msg });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
