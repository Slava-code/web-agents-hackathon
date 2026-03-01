export interface DiffResult {
  changed: Record<string, { old: unknown; new: unknown }>;
  added: Record<string, unknown>;
  removed: string[];
  hasChanges: boolean;
}

/** Normalize a value for comparison — handles LLM scraping inconsistencies */
function normalize(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val).trim().toLowerCase();
  // Normalize boolean-like values
  if (s === "true" || s === "checked" || s === "yes") return "true";
  if (s === "false" || s === "unchecked" || s === "no") return "false";
  // Strip common label prefixes the LLM sometimes includes
  return s.replace(/^(unit|user|surgeon|procedure|status):\s*/i, "");
}

export function diffSnapshots(
  previous: Record<string, unknown>,
  current: Record<string, unknown>
): DiffResult {
  const changed: Record<string, { old: unknown; new: unknown }> = {};
  const added: Record<string, unknown> = {};
  const removed: string[] = [];

  for (const key of Object.keys(current)) {
    if (!(key in previous)) {
      added[key] = current[key];
    } else if (normalize(previous[key]) !== normalize(current[key])) {
      changed[key] = { old: previous[key], new: current[key] };
    }
  }

  for (const key of Object.keys(previous)) {
    if (!(key in current)) {
      removed.push(key);
    }
  }

  const hasChanges =
    Object.keys(changed).length > 0 ||
    Object.keys(added).length > 0 ||
    removed.length > 0;

  return { changed, added, removed, hasChanges };
}

/** Flatten diff into the shape Convex /field-update expects */
export function diffToFieldUpdate(diff: DiffResult): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, { new: val }] of Object.entries(diff.changed)) {
    fields[key] = val;
  }
  for (const [key, val] of Object.entries(diff.added)) {
    fields[key] = val;
  }
  return fields;
}

/** Parse Supermemory snapshot content back into a JSON object */
export function parseSnapshotContent(
  content: string
): Record<string, unknown> | null {
  // Format: "Dashboard snapshot from host/path at timestamp:\n{JSON}"
  const newlineIdx = content.indexOf("\n");
  if (newlineIdx === -1) return null;
  const jsonPart = content.slice(newlineIdx + 1).trim();
  try {
    return JSON.parse(jsonPart);
  } catch {
    return null;
  }
}
