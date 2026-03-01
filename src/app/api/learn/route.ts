import { NextRequest } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { storeLearnedRoute } from "@/lib/supermemory";

const BU_API = "https://api.browser-use.com/api/v3";
const POLL_INTERVAL_MS = 2000;
const SITES_DIR = join(process.cwd(), "data", "sites");

function makeLearnPrompt(url: string): string {
  return `Go to ${url}

IMPORTANT INSTRUCTIONS:
- Do NOT create any files
- Do NOT save anything to disk
- Your ONLY job is to look at the page and respond with JSON text

Look at every piece of data shown on this page. For each data point, note the field name, CSS selector, current value, and type.

Your response must be EXACTLY this JSON format (nothing else before or after):

{"pagePurpose":"what this page does","pageLayout":"layout description","fields":[{"name":"fieldName","selector":"css selector or [data-testid=value]","sampleValue":"current value","type":"string"}]}

Include ALL visible data: IDs, statuses, percentages, readings, labels, table data. Prefer data-testid selectors when available.`;
}

interface LearnedRoute {
  path: string;
  pagePurpose: string;
  pageLayout: string;
  fields: { name: string; selector: string; sampleValue: string; type: string }[];
  cost: string;
}

async function pollSession(
  sessionId: string,
  apiKey: string
): Promise<{ output: string | null; cost: string; status: string }> {
  const terminalStatuses = ["idle", "stopped", "timed_out", "error"];

  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${BU_API}/sessions/${sessionId}`, {
      headers: { "X-Browser-Use-API-Key": apiKey },
    });

    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);

    const state = await res.json();
    if (terminalStatuses.includes(state.status)) {
      return {
        output: state.output,
        cost: state.totalCostUsd ?? "0",
        status: state.status,
      };
    }
  }
}

function parseAgentOutput(raw: unknown): {
  pagePurpose: string;
  pageLayout: string;
  fields: { name: string; selector: string; sampleValue: string; type: string }[];
} | null {
  if (!raw) return null;
  // Ensure raw is a string
  let rawStr: string;
  if (typeof raw === "string") {
    rawStr = raw;
  } else {
    try {
      rawStr = JSON.stringify(raw);
    } catch {
      return null;
    }
  }
  try {
    // Try to find JSON in the output
    let cleaned = rawStr.trim();
    // Strip markdown code fences
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) cleaned = jsonMatch[1].trim();
    // Try direct parse
    const data = JSON.parse(cleaned);
    return {
      pagePurpose: data.pagePurpose || "Unknown",
      pageLayout: data.pageLayout || "",
      fields: Array.isArray(data.fields) ? data.fields : [],
    };
  } catch {
    // Try to extract JSON object from the text
    const rawStr = typeof raw === "string" ? raw : "";
    const match = rawStr.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const data = JSON.parse(match[0]);
        return {
          pagePurpose: data.pagePurpose || "Unknown",
          pageLayout: data.pageLayout || "",
          fields: Array.isArray(data.fields) ? data.fields : [],
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "BROWSER_USE_API_KEY not set" }, { status: 500 });
  }

  const { baseUrl, routes, containerId } = await req.json();
  if (!baseUrl || !Array.isArray(routes) || routes.length === 0) {
    return Response.json(
      { error: "baseUrl and routes[] are required" },
      { status: 400 }
    );
  }

  try {
    new URL(baseUrl);
  } catch {
    return Response.json(
      { error: `Invalid baseUrl: "${baseUrl}". Must be a full URL like https://example.com` },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const hostname = new URL(baseUrl).hostname;
      const siteId = randomUUID();
      const learnedRoutes: LearnedRoute[] = [];
      let totalCost = 0;

      for (const route of routes) {
        const url = baseUrl.replace(/\/$/, "") + route;
        send({ type: "learning", route, status: "started" });

        try {
          // Create browser-use session for this route
          const createRes = await fetch(`${BU_API}/sessions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Browser-Use-API-Key": apiKey,
            },
            body: JSON.stringify({
              task: makeLearnPrompt(url),
              model: "bu-mini",
            }),
          });

          if (!createRes.ok) {
            const err = await createRes.text();
            send({ type: "learning", route, status: "error", error: `API ${createRes.status}: ${err}` });
            continue;
          }

          const session = await createRes.json();
          send({ type: "session", id: session.id, liveUrl: session.liveUrl, route });

          // Poll until done
          const result = await pollSession(session.id, apiKey);
          const routeCost = parseFloat(result.cost) || 0;
          totalCost += routeCost;

          // Parse the agent's output — try direct output first, then check session files
          let parsed = parseAgentOutput(result.output);

          if (!parsed) {
            // Agent may have saved JSON to a file — try to retrieve it
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
                    parsed = parseAgentOutput(fileContent);
                    if (parsed) break;
                  }
                }
              }
            } catch {
              // ignore file retrieval errors
            }
          }

          if (parsed) {
            const learned: LearnedRoute = {
              path: route,
              pagePurpose: parsed.pagePurpose,
              pageLayout: parsed.pageLayout,
              fields: parsed.fields,
              cost: result.cost,
            };
            learnedRoutes.push(learned);

            // Store in Supermemory for fast recall
            const stored = await storeLearnedRoute(hostname, baseUrl.replace(/\/$/, ""), learned, containerId);

            send({
              type: "learned",
              route,
              pagePurpose: parsed.pagePurpose,
              fieldCount: parsed.fields.length,
              fields: parsed.fields.slice(0, 5), // preview first 5
              cost: result.cost,
              supermemory: stored,
            });
          } else {
            send({
              type: "learning",
              route,
              status: "parse_error",
              rawOutput: result.output?.slice(0, 200),
            });
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          send({ type: "learning", route, status: "error", error: msg });
        }
      }

      // Save site config
      if (learnedRoutes.length > 0) {
        const config = {
          id: siteId,
          hostname,
          containerId: containerId || null,
          baseUrl: baseUrl.replace(/\/$/, ""),
          learnedAt: new Date().toISOString(),
          totalCost: totalCost.toFixed(6),
          routes: learnedRoutes,
        };

        const filename = `${hostname.replace(/[^a-zA-Z0-9.-]/g, "_")}.json`;
        await writeFile(join(SITES_DIR, filename), JSON.stringify(config, null, 2));

        send({
          type: "done",
          siteId,
          hostname,
          totalRoutes: learnedRoutes.length,
          totalFields: learnedRoutes.reduce((s, r) => s + r.fields.length, 0),
          totalCost: totalCost.toFixed(6),
        });
      } else {
        send({ type: "error", message: "No routes were successfully learned" });
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
