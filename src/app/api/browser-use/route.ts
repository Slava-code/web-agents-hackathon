import { NextRequest } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const BU_API = "https://api.browser-use.com/api/v3";
const POLL_INTERVAL_MS = 2000;
const SITES_DIR = join(process.cwd(), "data", "sites");

interface SiteField {
  name: string;
  selector: string;
  sampleValue: string;
  type: string;
}

interface SiteRoute {
  path: string;
  pagePurpose: string;
  fields: SiteField[];
}

interface SiteConfig {
  id: string;
  baseUrl: string;
  routes: SiteRoute[];
}

async function loadSiteConfig(siteId: string): Promise<SiteConfig | null> {
  try {
    const files = await readdir(SITES_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await readFile(join(SITES_DIR, file), "utf-8");
      const config = JSON.parse(raw);
      if (config.id === siteId) return config;
    }
  } catch {
    // no sites dir or read error
  }
  return null;
}

function buildMemoryPrompt(config: SiteConfig, routePath: string): string | null {
  const route = config.routes.find((r) => r.path === routePath);
  if (!route || route.fields.length === 0) return null;

  const selectorLines = route.fields
    .map((f) => `- "${f.name}" (${f.type}): ${f.selector}`)
    .join("\n");

  return `Go to ${config.baseUrl}${route.path}

IMPORTANT: Do NOT create files. Do NOT save anything to disk. Just respond with JSON text.

This page has these data fields with CSS selectors:
${selectorLines}

Read the current value of each field using the selectors. Your response must be EXACTLY a JSON object with field names as keys and current values as values. Nothing else before or after the JSON.`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "BROWSER_USE_API_KEY not set" }, { status: 500 });
  }

  const body = await req.json();
  let task: string = body.task;
  const siteId: string | undefined = body.siteId;
  const routePath: string | undefined = body.route;

  // If siteId + route provided, build a memory-enhanced prompt
  if (siteId && routePath) {
    const config = await loadSiteConfig(siteId);
    if (config) {
      const memoryTask = buildMemoryPrompt(config, routePath);
      if (memoryTask) {
        task = memoryTask;
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

            send({
              type: "done",
              status: state.status,
              output: finalOutput,
              cost: state.totalCostUsd,
              inputTokens: state.totalInputTokens,
              outputTokens: state.totalOutputTokens,
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
