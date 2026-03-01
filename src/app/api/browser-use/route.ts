import { NextRequest } from "next/server";
import { recallRoute, storeSnapshot } from "@/lib/supermemory";
import { loadSiteConfig, buildMemoryPrompt } from "@/lib/site-config";

const BU_API = "https://api.browser-use.com/api/v3";
const POLL_INTERVAL_MS = 2000;

export async function POST(req: NextRequest) {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "BROWSER_USE_API_KEY not set" }, { status: 500 });
  }

  const body = await req.json();
  let task: string = body.task;
  const siteId: string | undefined = body.siteId;
  const routePath: string | undefined = body.route;
  const containerId: string | undefined = body.containerId;

  let hostname: string | undefined;

  // If siteId + route provided, build a memory-enhanced prompt
  if (siteId && routePath) {
    const config = await loadSiteConfig(siteId);
    if (config) {
      hostname = config.baseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const memoryTask = buildMemoryPrompt(config, routePath);
      if (memoryTask) {
        task = memoryTask;
      }
    }

    // Fallback: try Supermemory if no local config or no fields found
    if (!task && hostname) {
      const memories = await recallRoute(hostname, routePath, containerId);
      if (memories.length > 0) {
        task = `Use this knowledge about the page to extract data:\n\n${memories[0].content}\n\nNavigate to the page and extract current values for all fields. Return ONLY valid JSON.`;
      }
    }
  }

  if (!task || typeof task !== "string") {
    return Response.json({ error: "task is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // 1. Create session + dispatch task
        const createRes = await fetch(`${BU_API}/sessions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Browser-Use-API-Key": apiKey,
          },
          body: JSON.stringify({ task, model: "bu-mini", keepAlive: true }),
        });

        if (!createRes.ok) {
          const err = await createRes.text();
          send({ type: "error", message: `Failed to create session: ${createRes.status} ${err}` });
          controller.close();
          return;
        }

        const session = await createRes.json();
        send({
          type: "session",
          id: session.id,
          status: session.status,
          liveUrl: session.liveUrl,
        });

        // 2. Poll until done
        const terminalStatuses = ["idle", "stopped", "timed_out", "error"];
        let lastStatus = session.status;

        while (true) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

          const pollRes = await fetch(`${BU_API}/sessions/${session.id}`, {
            headers: { "X-Browser-Use-API-Key": apiKey },
          });

          if (!pollRes.ok) {
            send({ type: "error", message: `Poll failed: ${pollRes.status}` });
            break;
          }

          const state = await pollRes.json();

          if (state.status !== lastStatus) {
            send({
              type: "status",
              status: state.status,
              output: state.output,
              cost: state.totalCostUsd,
            });
            lastStatus = state.status;
          }

          if (terminalStatuses.includes(state.status)) {
            let finalOutput = state.output;

            // If output doesn't look like JSON, check session files
            if (finalOutput && !finalOutput.trim().startsWith("{")) {
              try {
                const filesRes = await fetch(
                  `${BU_API}/sessions/${session.id}/files?includeUrls=true`,
                  { headers: { "X-Browser-Use-API-Key": apiKey } }
                );
                if (filesRes.ok) {
                  const filesData = await filesRes.json();
                  for (const file of filesData.files || []) {
                    if (file.path?.endsWith(".json") && file.url) {
                      const fileContent = await fetch(file.url).then((r) => r.text());
                      if (fileContent.trim().startsWith("{")) {
                        finalOutput = fileContent;
                        break;
                      }
                    }
                  }
                }
              } catch {
                // ignore file retrieval errors
              }
            }

            // Store snapshot in Supermemory if we have structured data
            let snapshotStored = false;
            if (finalOutput && hostname && routePath) {
              try {
                const parsed = JSON.parse(finalOutput.trim().startsWith("{") ? finalOutput : "{}");
                if (Object.keys(parsed).length > 0) {
                  snapshotStored = await storeSnapshot(hostname, routePath, parsed, containerId);
                }
              } catch {
                // not JSON, skip snapshot
              }
            }

            send({
              type: "done",
              status: state.status,
              output: finalOutput,
              cost: state.totalCostUsd,
              inputTokens: state.totalInputTokens,
              outputTokens: state.totalOutputTokens,
              supermemory: snapshotStored,
            });

            // Stop the session to free resources
            await fetch(`${BU_API}/sessions/${session.id}/stop`, {
              method: "POST",
              headers: { "X-Browser-Use-API-Key": apiKey },
            }).catch(() => {});

            break;
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
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
