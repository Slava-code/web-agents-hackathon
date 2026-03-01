import { readdir, readFile } from "fs/promises";
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

  const selectorLines = route.fields
    .map((f) => `- "${f.name}" (${f.type}): ${f.selector}`)
    .join("\n");

  return `Go to ${config.baseUrl}${route.path}

IMPORTANT: Do NOT create files. Do NOT save anything to disk. Just respond with JSON text.

This page has these data fields with CSS selectors:
${selectorLines}

Read the current value of each field using the selectors. Your response must be EXACTLY a JSON object with field names as keys and current values as values. Nothing else before or after the JSON.`;
}
