import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const SITES_DIR = join(process.cwd(), "data", "sites");

export interface SiteField {
  name: string;
  selector: string;
  sampleValue: string;
  type: string;
}

export interface SiteRoute {
  path: string;
  pagePurpose: string;
  fields: SiteField[];
}

export interface SiteConfig {
  id: string;
  hostname: string;
  containerId?: string;
  baseUrl: string;
  routes: SiteRoute[];
}

export async function loadSiteConfig(siteId: string): Promise<SiteConfig | null> {
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

export function buildMemoryPrompt(config: SiteConfig, routePath: string): string | null {
  const route = config.routes.find((r) => r.path === routePath);
  if (!route || route.fields.length === 0) return null;

  const fieldNames = route.fields.map((f) => f.name);

  // Build sample values hint from learned fields
  const sampleHints = route.fields
    .filter((f) => f.sampleValue)
    .slice(0, 10)
    .map((f) => `  "${f.name}": "${f.sampleValue}"`)
    .join(",\n");

  return `Go to ${config.baseUrl}${route.path}

IMPORTANT: Do NOT create files. Do NOT save anything to disk. Just look at the page and respond with JSON text.

This is a ${route.pagePurpose}. Read ALL visible data on the page and return it as a flat JSON object.

Use these field names as keys: ${fieldNames.join(", ")}

CRITICAL RULES:
- Copy text EXACTLY as shown on screen — do not abbreviate, summarize, or rephrase
- For checkboxes/toggles, use "true" or "false" (not "checked"/"unchecked")
- Do not add label prefixes like "Unit:" or "User:" — just the value itself

Your response must be EXACTLY a JSON object — nothing else before or after. Example format based on previously seen values:
{
${sampleHints}
}`;
}

// ─── Local snapshot storage (reliable, not semantic-search dependent) ──

const SNAPSHOTS_DIR = join(process.cwd(), "data", "snapshots");

function snapshotPath(hostname: string, routePath: string): string {
  const safe = `${hostname}${routePath}`.replace(/[^a-zA-Z0-9.-]/g, "_");
  return join(SNAPSHOTS_DIR, `${safe}.json`);
}

export async function loadLastSnapshot(
  hostname: string,
  routePath: string
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(snapshotPath(hostname, routePath), "utf-8");
    const parsed = JSON.parse(raw);
    return parsed.data || null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(
  hostname: string,
  routePath: string,
  data: Record<string, unknown>
): Promise<void> {
  await mkdir(SNAPSHOTS_DIR, { recursive: true });
  await writeFile(
    snapshotPath(hostname, routePath),
    JSON.stringify({ hostname, path: routePath, timestamp: new Date().toISOString(), data }, null, 2)
  );
}
