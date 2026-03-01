export interface DiffResult {
  changed: Record<string, { old: unknown; new: unknown }>;
  added: Record<string, unknown>;
  removed: string[];
  hasChanges: boolean;
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
    } else if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
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
