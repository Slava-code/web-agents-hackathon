import { NextRequest } from "next/server";
import { readdir, readFile, unlink } from "fs/promises";
import { join } from "path";

const SITES_DIR = join(process.cwd(), "data", "sites");

export async function GET() {
  try {
    const files = await readdir(SITES_DIR);
    const sites = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(SITES_DIR, file), "utf-8");
        const config = JSON.parse(raw);
        sites.push({
          id: config.id,
          hostname: config.hostname,
          baseUrl: config.baseUrl,
          learnedAt: config.learnedAt,
          totalCost: config.totalCost,
          routeCount: config.routes?.length ?? 0,
          fieldCount: config.routes?.reduce(
            (sum: number, r: { fields?: unknown[] }) => sum + (r.fields?.length ?? 0),
            0
          ) ?? 0,
          routes: config.routes?.map((r: { path: string; pagePurpose: string; fields?: unknown[] }) => ({
            path: r.path,
            pagePurpose: r.pagePurpose,
            fieldCount: r.fields?.length ?? 0,
          })) ?? [],
        });
      } catch {
        // skip malformed files
      }
    }

    return Response.json(sites);
  } catch {
    return Response.json([]);
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const files = await readdir(SITES_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await readFile(join(SITES_DIR, file), "utf-8");
      const config = JSON.parse(raw);
      if (config.id === id) {
        await unlink(join(SITES_DIR, file));
        return Response.json({ deleted: true });
      }
    }
    return Response.json({ error: "Site not found" }, { status: 404 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
