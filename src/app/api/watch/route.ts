import { NextRequest } from "next/server";
import { loadSiteConfig, saveSnapshot, loadLastSnapshot } from "@/lib/site-config";
import { ROUTE_TO_DEVICE, CONVEX_URL } from "@/lib/device-mapping";
import { diffSnapshots, diffToFieldUpdate } from "@/lib/diff";
import { runBrowserUseTask, parseOutputAsString } from "@/lib/browser-use";

const DEFAULT_INTERVAL_MS = 30000; // 30 seconds between checks
const MAX_ITERATIONS = 200;        // ~100 minutes at 30s

export async function POST(req: NextRequest) {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "BROWSER_USE_API_KEY not set" }, { status: 500 });
  }

  const { siteId, route: routePath, intervalMs: rawInterval } = await req.json();
  if (!siteId || !routePath) {
    return Response.json({ error: "siteId and route are required" }, { status: 400 });
  }

  const intervalMs = Math.max(10000, rawInterval || DEFAULT_INTERVAL_MS);

  const deviceMapping = ROUTE_TO_DEVICE[routePath];
  if (!deviceMapping) {
    return Response.json(
      { error: `No Convex device mapping for route ${routePath}` },
      { status: 400 }
    );
  }

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

      try {
        // 1. Load site config
        const config = await loadSiteConfig(siteId);
        if (!config) {
          send({ type: "error", message: `Site config not found for id: ${siteId}` });
          controller.close();
          return;
        }

        const route = config.routes.find((r) => r.path === routePath);
        if (!route) {
          send({ type: "error", message: `Route ${routePath} not found in site config` });
          controller.close();
          return;
        }

        if (!route.fullExtractScript) {
          send({ type: "error", message: `No extraction script for route ${routePath}. Re-learn the route to generate scripts.` });
          controller.close();
          return;
        }

        const hostname = config.hostname;
        const pageUrl = `${config.baseUrl}${routePath}`;

        // 2. Load previous snapshot (if any)
        let previousData = await loadLastSnapshot(hostname, routePath);

        send({
          type: "watch_started",
          url: pageUrl,
          intervalMs,
          deviceId: deviceMapping.deviceId,
          deviceName: deviceMapping.name,
          hasSnapshot: !!previousData,
        });

        // 3. Watch loop — every iteration does a full extract and diffs server-side
        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          // Wait between iterations (skip wait on first)
          if (iteration > 0) {
            await new Promise((r) => setTimeout(r, intervalMs));
          }

          try {
            const extractResult = await runBrowserUseTask(
              buildExtractPrompt(pageUrl, route.fullExtractScript),
              apiKey
            );

            const extractOutput = parseOutputAsString(extractResult.output);
            const currentData = tryParseJSON(extractOutput);

            if (!currentData) {
              send({
                type: "watch_error",
                message: "Extract failed to return valid JSON",
                rawOutput: extractOutput.slice(0, 300),
                iteration,
                cost: extractResult.cost,
              });
              continue;
            }

            // Diff against previous snapshot server-side
            if (!previousData) {
              // First run — treat everything as new
              const fields = { ...currentData };
              await pushToConvex(deviceMapping.deviceId, fields, send);
              previousData = currentData;
              await saveSnapshot(hostname, routePath, currentData);

              send({
                type: "change_detected",
                diff: { changed: {}, added: fields, removed: [] },
                hasChanges: true,
                iteration,
                cost: extractResult.cost,
                isFirstRun: true,
              });
            } else {
              const diff = diffSnapshots(previousData, currentData);

              if (diff.hasChanges) {
                const fields = diffToFieldUpdate(diff);
                await pushToConvex(deviceMapping.deviceId, fields, send);
                previousData = currentData;
                await saveSnapshot(hostname, routePath, currentData);

                send({
                  type: "change_detected",
                  diff: { changed: diff.changed, added: diff.added, removed: diff.removed },
                  hasChanges: true,
                  iteration,
                  cost: extractResult.cost,
                });
              } else {
                send({
                  type: "heartbeat",
                  iteration,
                  timestamp: Date.now(),
                  cost: extractResult.cost,
                });
              }
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            send({ type: "watch_error", message: msg, iteration });
          }
        }

        send({ type: "watch_ended", reason: "max_iterations", iterations: MAX_ITERATIONS });
      } catch (e) {
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

// ─── Helpers ───

function buildExtractPrompt(url: string, script: string): string {
  return `Go to ${url}

Wait for the page to fully load. Then open the browser console and execute this JavaScript. Return ONLY the raw JSON string result — nothing else, no explanation, no markdown:

${script}`;
}

function tryParseJSON(str: string): Record<string, unknown> | null {
  if (!str) return null;
  const cleaned = str.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : cleaned;
  try {
    return JSON.parse(jsonStr);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function pushToConvex(
  deviceId: string,
  fields: Record<string, unknown>,
  send: (data: Record<string, unknown>) => void
) {
  try {
    const res = await fetch(`${CONVEX_URL}/field-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, fields }),
    });
    const result = await res.json();
    send({
      type: "convex_push",
      ok: result.ok === true,
      deviceId,
      fieldsSent: Object.keys(fields).length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    send({ type: "convex_push", ok: false, deviceId, error: msg });
  }
}
