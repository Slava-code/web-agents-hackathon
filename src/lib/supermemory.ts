import Supermemory from "supermemory";
import type { DiffResult } from "./diff";

let _client: Supermemory | null = null;

export function getClient(): Supermemory | null {
  const key = process.env.SUPERMEMORY_API_KEY;
  if (!key) {
    console.log("[supermemory] No API key found");
    return null;
  }
  if (!_client) {
    console.log("[supermemory] Creating client with key:", key.slice(0, 8) + "...");
    _client = new Supermemory({ apiKey: key });
  }
  return _client;
}

// ─── Container tags ──────────────────────────────────────────────────
// Each hospital/site gets its own container for isolated memory.
// Container tags group memories so each site's data is separated.
// Pass a custom containerId (e.g. "memorial-general") or auto-generate from hostname.

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Generate a container tag for a hospital/site.
 * @param hostname - The site's hostname
 * @param containerId - Optional custom ID (e.g. "memorial-general")
 * @returns Sanitized container tag like "hospital_memorial-general"
 */
export function siteTag(hostname: string, containerId?: string): string {
  if (containerId) return `hospital_${sanitize(containerId)}`;
  return `hospital_${sanitize(hostname)}`;
}

export function routeTag(hostname: string, path: string): string {
  return `route_${sanitize(hostname)}${sanitize(path)}`;
}

// ─── Store learned site structure ────────────────────────────────────

interface LearnedField {
  name: string;
  selector: string;
  sampleValue: string;
  type: string;
}

interface LearnedRoute {
  path: string;
  pagePurpose: string;
  pageLayout: string;
  fields: LearnedField[];
}

export async function storeLearnedRoute(
  hostname: string,
  baseUrl: string,
  route: LearnedRoute,
  containerId?: string
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  const tag = siteTag(hostname, containerId);

  const fieldSummary = route.fields
    .map((f) => `${f.name}: ${f.selector} (${f.type}, e.g. "${f.sampleValue}")`)
    .join("\n");

  const content = `Site: ${hostname}
Route: ${route.path}
URL: ${baseUrl}${route.path}
Purpose: ${route.pagePurpose}
Layout: ${route.pageLayout}

Data fields and CSS selectors:
${fieldSummary}`;

  try {
    await client.add({
      content,
      containerTag: tag,
      customId: `learned_${sanitize(hostname)}_${sanitize(route.path)}`,
      metadata: {
        type: "learned_route",
        hostname,
        path: route.path,
        fieldCount: route.fields.length.toString(),
        baseUrl,
        containerId: containerId || "",
      },
    });
    console.log(`[supermemory] Stored learned route [${tag}]:`, hostname, route.path);
    return true;
  } catch (e) {
    console.error("[supermemory] Store error:", e);
    return false;
  }
}

// ─── Store extracted data snapshot ───────────────────────────────────

export async function storeSnapshot(
  hostname: string,
  path: string,
  data: Record<string, unknown>,
  containerId?: string
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  const tag = siteTag(hostname, containerId);
  const timestamp = new Date().toISOString();
  const content = `Dashboard snapshot from ${hostname}${path} at ${timestamp}:
${JSON.stringify(data, null, 2)}`;

  try {
    await client.add({
      content,
      containerTag: tag,
      customId: `snapshot_${sanitize(hostname)}_${sanitize(path)}_${Date.now()}`,
      metadata: {
        type: "snapshot",
        hostname,
        path,
        timestamp,
        containerId: containerId || "",
      },
    });
    console.log(`[supermemory] Stored snapshot [${tag}]:`, hostname, path);
    return true;
  } catch (e) {
    console.error("[supermemory] Snapshot error:", e);
    return false;
  }
}

// ─── Recall site knowledge ───────────────────────────────────────────

export interface MemoryResult {
  content: string;
  metadata?: Record<string, unknown>;
}

export async function recallRoute(
  hostname: string,
  path: string,
  containerId?: string
): Promise<MemoryResult[]> {
  const client = getClient();
  if (!client) return [];

  const tag = siteTag(hostname, containerId);

  try {
    const result = await client.search.documents({
      containerTag: tag,
      q: `selectors and fields for ${path}`,
      filters: {
        AND: [
          { key: "type", value: "learned_route", filterType: "metadata" as const },
          { key: "path", value: path, filterType: "metadata" as const },
        ],
      },
    });

    return (result.results || []).map((r: { chunks?: { content: string }[]; metadata?: Record<string, unknown> }) => ({
      content: (r.chunks || []).map((c) => c.content).join("\n"),
      metadata: r.metadata,
    }));
  } catch (e) {
    console.error("[supermemory] Recall error:", e);
    return [];
  }
}

// ─── Recall recent snapshots ─────────────────────────────────────────

export async function recallSnapshots(
  hostname: string,
  path?: string,
  containerId?: string
): Promise<MemoryResult[]> {
  const client = getClient();
  if (!client) return [];

  const tag = siteTag(hostname, containerId);

  try {
    const q = path
      ? `recent data from ${hostname}${path}`
      : `recent data from ${hostname}`;

    const filters: Record<string, unknown> = {
      AND: [
        { key: "type", value: "snapshot", filterType: "metadata" },
        { key: "hostname", value: hostname, filterType: "metadata" },
      ],
    };

    if (path) {
      (filters.AND as unknown[]).push({ key: "path", value: path, filterType: "metadata" });
    }

    const result = await client.search.documents({
      containerTag: tag,
      q,
      filters,
    });

    return (result.results || []).map((r: { chunks?: { content: string }[]; metadata?: Record<string, unknown> }) => ({
      content: (r.chunks || []).map((c) => c.content).join("\n"),
      metadata: r.metadata,
    }));
  } catch (e) {
    console.error("[supermemory] Snapshots error:", e);
    return [];
  }
}

// ─── Store change diffs ─────────────────────────────────────────────

export async function storeDiff(
  hostname: string,
  path: string,
  diff: DiffResult,
  containerId?: string
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  const tag = siteTag(hostname, containerId);
  const timestamp = new Date().toISOString();

  const changedSummary = Object.entries(diff.changed)
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v.old)} -> ${JSON.stringify(v.new)}`)
    .join("\n");
  const addedSummary = Object.entries(diff.added)
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)} (new)`)
    .join("\n");
  const removedSummary = diff.removed
    .map((k) => `  ${k} (removed)`)
    .join("\n");

  const content = `Diff for ${hostname}${path} at ${timestamp}:
Changed:
${changedSummary || "  (none)"}
Added:
${addedSummary || "  (none)"}
Removed:
${removedSummary || "  (none)"}`;

  try {
    await client.add({
      content,
      containerTag: tag,
      customId: `diff_${sanitize(hostname)}_${sanitize(path)}_${Date.now()}`,
      metadata: {
        type: "diff",
        hostname,
        path,
        timestamp,
        changedCount: Object.keys(diff.changed).length.toString(),
        addedCount: Object.keys(diff.added).length.toString(),
        removedCount: diff.removed.length.toString(),
        containerId: containerId || "",
      },
    });
    console.log(`[supermemory] Stored diff [${tag}]:`, hostname, path);
    return true;
  } catch (e) {
    console.error("[supermemory] Diff store error:", e);
    return false;
  }
}

// ─── Recall recent diffs ────────────────────────────────────────────

export async function recallDiffs(
  hostname: string,
  path?: string,
  containerId?: string
): Promise<MemoryResult[]> {
  const client = getClient();
  if (!client) return [];

  const tag = siteTag(hostname, containerId);

  try {
    const q = path
      ? `recent changes for ${hostname}${path}`
      : `recent changes for ${hostname}`;

    const filters: Record<string, unknown> = {
      AND: [
        { key: "type", value: "diff", filterType: "metadata" },
        { key: "hostname", value: hostname, filterType: "metadata" },
      ],
    };

    if (path) {
      (filters.AND as unknown[]).push({ key: "path", value: path, filterType: "metadata" });
    }

    const result = await client.search.documents({
      containerTag: tag,
      q,
      filters,
    });

    return (result.results || []).map((r: { chunks?: { content: string }[]; metadata?: Record<string, unknown> }) => ({
      content: (r.chunks || []).map((c) => c.content).join("\n"),
      metadata: r.metadata,
    }));
  } catch (e) {
    console.error("[supermemory] Diffs recall error:", e);
    return [];
  }
}
