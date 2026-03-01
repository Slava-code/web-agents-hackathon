import { NextRequest } from "next/server";
import { recallRoute, recallSnapshots, getClient } from "@/lib/supermemory";

export async function GET(req: NextRequest) {
  const client = getClient();
  if (!client) {
    return Response.json(
      { error: "SUPERMEMORY_API_KEY not set", configured: false },
      { status: 200 }
    );
  }

  const { searchParams } = new URL(req.url);
  const hostname = searchParams.get("hostname");
  const path = searchParams.get("path");
  const containerId = searchParams.get("containerId") || undefined;
  const type = searchParams.get("type") || "all"; // "route" | "snapshots" | "all"

  if (!hostname) {
    return Response.json({ error: "hostname is required" }, { status: 400 });
  }

  try {
    const result: Record<string, unknown> = { configured: true };

    if (type === "route" || type === "all") {
      result.route = path ? await recallRoute(hostname, path, containerId) : [];
    }

    if (type === "snapshots" || type === "all") {
      result.snapshots = await recallSnapshots(hostname, path || undefined, containerId);
    }

    return Response.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
