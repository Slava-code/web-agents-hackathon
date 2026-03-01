import { NextRequest } from "next/server";
import { recallSnapshots, storeSnapshot, storeDiff, recallRoute } from "@/lib/supermemory";
import { loadSiteConfig, buildMemoryPrompt } from "@/lib/site-config";
import { ROUTE_TO_DEVICE, CONVEX_URL } from "@/lib/device-mapping";
import { diffSnapshots, diffToFieldUpdate, parseSnapshotContent } from "@/lib/diff";
import type { DiffResult } from "@/lib/diff";

const BU_API = "https://api.browser-use.com/api/v3";
const POLL_INTERVAL_MS = 2000;

export async function POST(req: NextRequest) {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "BROWSER_USE_API_KEY not set" }, { status: 500 });
  }

  const { siteId, route: routePath, containerId } = await req.json();
  if (!siteId || !routePath) {
    return Response.json({ error: "siteId and route are required" }, { status: 400 });
  }

  // Look up Convex device mapping
  const deviceMapping = ROUTE_TO_DEVICE[routePath];
  if (!deviceMapping) {
    return Response.json(
      { error: `No Convex device mapping for route ${routePath}. Known routes: ${Object.keys(ROUTE_TO_DEVICE).join(", ")}` },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // 1. Load site config and build task prompt
        const config = await loadSiteConfig(siteId);
        if (!config) {
          send({ type: "error", message: `Site config not found for id: ${siteId}` });
          controller.close();
          return;
        }

        const hostname = config.hostname;
        let task = buildMemoryPrompt(config, routePath);

        // Fallback to Supermemory if no local selectors
        if (!task) {
          const memories = await recallRoute(hostname, routePath, containerId);
          if (memories.length > 0) {
            task = `Use this knowledge about the page to extract data:\n\n${memories[0].content}\n\nNavigate to the page and extract current values for all fields. Return ONLY valid JSON.`;
          }
        }

        if (!task) {
          send({ type: "error", message: `No learned data for route ${routePath}` });
          controller.close();
          return;
        }

        // 2. Recall previous snapshot from Supermemory
        let previousData: Record<string, unknown> | null = null;
        try {
          const snapshots = await recallSnapshots(hostname, routePath, containerId);
          if (snapshots.length > 0) {
            previousData = parseSnapshotContent(snapshots[0].content);
          }
        } catch {
          // no previous snapshot, first run
        }

        send({ type: "previous_snapshot", data: previousData });

        // 3. Run browser-use scrape
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
          send({ type: "error", message: `Browser-use session failed: ${createRes.status} ${err}` });
          controller.close();
          return;
        }

        const session = await createRes.json();
        send({ type: "session", id: session.id, liveUrl: session.liveUrl });

        // 4. Poll until done
        const terminalStatuses = ["idle", "stopped", "timed_out", "error"];
        let lastStatus = session.status;
        let finalOutput: string | null = null;
        let cost = "0";

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
            send({ type: "status", status: state.status });
            lastStatus = state.status;
          }

          if (terminalStatuses.includes(state.status)) {
            finalOutput = state.output;
            cost = state.totalCostUsd ?? "0";

            // Check session files if output isn't JSON
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

            // Stop the session
            await fetch(`${BU_API}/sessions/${session.id}/stop`, {
              method: "POST",
              headers: { "X-Browser-Use-API-Key": apiKey },
            }).catch(() => {});

            break;
          }
        }

        // 5. Parse scrape output
        let currentData: Record<string, unknown> | null = null;
        if (finalOutput) {
          try {
            const cleaned = finalOutput.trim();
            const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
            currentData = JSON.parse(jsonMatch ? jsonMatch[1].trim() : cleaned);
          } catch {
            // Try to extract JSON object
            const match = finalOutput.match(/\{[\s\S]*\}/);
            if (match) {
              try {
                currentData = JSON.parse(match[0]);
              } catch {
                // not parseable
              }
            }
          }
        }

        if (!currentData) {
          send({ type: "error", message: "Could not parse scrape output as JSON", rawOutput: finalOutput?.slice(0, 300) });
          controller.close();
          return;
        }

        send({ type: "scrape_result", data: currentData, cost });

        // 6. Diff against previous snapshot
        let diff: DiffResult;
        if (previousData) {
          diff = diffSnapshots(previousData, currentData);
        } else {
          // First run — everything is "added"
          diff = {
            changed: {},
            added: { ...currentData },
            removed: [],
            hasChanges: Object.keys(currentData).length > 0,
          };
        }

        send({
          type: "diff",
          diff: {
            changed: diff.changed,
            added: diff.added,
            removed: diff.removed,
          },
          hasChanges: diff.hasChanges,
          isFirstRun: !previousData,
        });

        // 7. Push to Convex if there are changes
        let convexOk = false;
        let fieldsSent = 0;
        if (diff.hasChanges) {
          const fieldsToSend = diffToFieldUpdate(diff);
          fieldsSent = Object.keys(fieldsToSend).length;

          try {
            const convexRes = await fetch(`${CONVEX_URL}/field-update`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                deviceId: deviceMapping.deviceId,
                fields: fieldsToSend,
              }),
            });

            const convexResult = await convexRes.json();
            convexOk = convexResult.ok === true;

            send({
              type: "convex",
              ok: convexOk,
              deviceId: deviceMapping.deviceId,
              deviceName: deviceMapping.name,
              fieldsSent,
              response: convexResult,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            send({
              type: "convex",
              ok: false,
              deviceId: deviceMapping.deviceId,
              deviceName: deviceMapping.name,
              fieldsSent,
              error: msg,
            });
          }
        } else {
          send({
            type: "convex",
            ok: true,
            deviceId: deviceMapping.deviceId,
            deviceName: deviceMapping.name,
            fieldsSent: 0,
            message: "No changes to push",
          });
        }

        // 8. Store snapshot + diff in Supermemory
        const snapshotStored = await storeSnapshot(hostname, routePath, currentData, containerId);
        let diffStored = false;
        if (diff.hasChanges) {
          diffStored = await storeDiff(hostname, routePath, diff, containerId);
        }

        send({
          type: "done",
          cost,
          summary: {
            hasChanges: diff.hasChanges,
            changedFields: Object.keys(diff.changed).length,
            addedFields: Object.keys(diff.added).length,
            removedFields: diff.removed.length,
            convexPushed: convexOk,
            fieldsSent,
            snapshotStored,
            diffStored,
            isFirstRun: !previousData,
          },
        });
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
