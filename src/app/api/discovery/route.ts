import { NextRequest } from "next/server";
import {
  runDiscoveryForPage,
  DEFAULT_PAGES,
} from "@/lib/discovery-service";

const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
  "https://impartial-whale-32.convex.site";

async function postConvex(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_SITE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Convex ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const mode = body.mode || "mock";
  const baseUrl =
    body.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const pages = body.pages || DEFAULT_PAGES;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        // Create session in Convex
        const { sessionId } = await postConvex("/discovery-start", {
          mode,
          baseUrl,
          pages: pages.map((p: { pageUrl: string; pageName: string }) => ({
            pageUrl: p.pageUrl,
            pageName: p.pageName,
          })),
        });

        send({ type: "session_created", sessionId, mode, totalPages: pages.length });

        // Process each page sequentially
        for (const page of pages) {
          const generator = runDiscoveryForPage(page.pageUrl, mode, baseUrl);

          for await (const event of generator) {
            // Stream every event to the client
            send(event);

            // At key milestones, persist to Convex
            switch (event.type) {
              case "visiting":
                await postConvex("/discovery-update", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  status: "visiting",
                });
                await postConvex("/discovery-log", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  level: "info",
                  message: `Navigating to ${event.pageUrl}...`,
                });
                break;

              case "agent_thought":
                await postConvex("/discovery-log", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  level: "agent_thought",
                  message: event.thought,
                });
                break;

              case "fields_discovered":
                await postConvex("/discovery-update", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  status: "analyzing",
                  discoveredFields: event.fields,
                });
                await postConvex("/discovery-log", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  level: "success",
                  message: `Discovered ${event.fields.length} fields`,
                  detail: event.pagePurpose,
                });
                break;

              case "schema_inferred":
                await postConvex("/discovery-update", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  status: "schema_created",
                  inferredSchema: event.schema,
                });
                await postConvex("/discovery-log", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  level: "schema",
                  message: `Schema inferred with ${Object.keys(event.schema).length} fields`,
                  detail: JSON.stringify(event.schema),
                });
                break;

              case "script_generated":
                await postConvex("/discovery-update", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  status: "extracting",
                  extractionScript: event.script,
                });
                await postConvex("/discovery-log", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  level: "script",
                  message: "Extraction script generated",
                  detail: event.script,
                });
                break;

              case "data_extracted":
                await postConvex("/discovery-update", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  status: "complete",
                  extractedData: event.data,
                });
                await postConvex("/discovery-log", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  level: "data",
                  message: `Extracted ${Object.keys(event.data).length} data points`,
                  detail: JSON.stringify(event.data),
                });
                break;

              case "page_complete":
                await postConvex("/discovery-log", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  level: "success",
                  message: `Page ${event.pageUrl} discovery complete`,
                });
                break;

              case "error":
                await postConvex("/discovery-update", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  status: "error",
                  error: event.error,
                });
                await postConvex("/discovery-log", {
                  sessionId,
                  pageUrl: event.pageUrl,
                  level: "error",
                  message: event.error,
                });
                break;
            }
          }
        }

        // Complete the session
        await postConvex("/discovery-complete", { sessionId });
        await postConvex("/discovery-log", {
          sessionId,
          level: "success",
          message: `Discovery complete! Analyzed ${pages.length} pages.`,
        });

        send({
          type: "discovery_complete",
          sessionId,
          totalPages: pages.length,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: "error", error: msg });
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
