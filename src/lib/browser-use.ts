/**
 * Shared browser-use v3 API helpers.
 * Extracts the duplicated session management from learn/monitor/browser-use routes.
 */

const BU_API = "https://api.browser-use.com/api/v3";
const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = ["idle", "stopped", "timed_out", "error"];

export interface SessionResult {
  output: unknown;
  cost: string;
  status: string;
  sessionId: string;
}

/**
 * Poll a browser-use session until it reaches a terminal status.
 */
export async function pollSession(
  sessionId: string,
  apiKey: string,
  onStatus?: (status: string) => void
): Promise<SessionResult> {
  let lastStatus = "";

  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${BU_API}/sessions/${sessionId}`, {
      headers: { "X-Browser-Use-API-Key": apiKey },
    });

    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);

    const state = await res.json();

    if (state.status !== lastStatus) {
      lastStatus = state.status;
      onStatus?.(state.status);
    }

    if (TERMINAL_STATUSES.includes(state.status)) {
      return {
        output: state.output,
        cost: state.totalCostUsd ?? "0",
        status: state.status,
        sessionId,
      };
    }
  }
}

/**
 * Run a browser-use task end-to-end: create session → poll → stop → return output.
 * Returns the raw output (may be string or object).
 */
const MAX_CREATE_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

export async function runBrowserUseTask(
  task: string,
  apiKey: string,
  options?: { model?: string; keepAlive?: boolean; onStatus?: (status: string) => void }
): Promise<SessionResult> {
  let createRes: Response | null = null;

  for (let attempt = 1; attempt <= MAX_CREATE_RETRIES; attempt++) {
    createRes = await fetch(`${BU_API}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Browser-Use-API-Key": apiKey,
      },
      body: JSON.stringify({
        task,
        model: options?.model ?? "bu-mini",
        keepAlive: options?.keepAlive ?? false,
      }),
    });

    if (createRes.ok) break;

    const err = await createRes.text();
    if (attempt < MAX_CREATE_RETRIES && (err.includes("sandbox") || createRes.status >= 500)) {
      options?.onStatus?.(`Retrying session create (attempt ${attempt + 1}/${MAX_CREATE_RETRIES})...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } else {
      throw new Error(`Browser-use session create failed: ${createRes.status} ${err}`);
    }
  }

  const session = await createRes!.json();
  const result = await pollSession(session.id, apiKey, options?.onStatus);

  // Stop the session
  await fetch(`${BU_API}/sessions/${session.id}/stop`, {
    method: "POST",
    headers: { "X-Browser-Use-API-Key": apiKey },
  }).catch(() => {});

  return result;
}

/**
 * Parse browser-use output into a string.
 * Handles the case where output may be a string, object, or wrapped in markdown code fences.
 */
export function parseOutputAsString(output: unknown): string {
  if (!output) return "";
  if (typeof output === "string") return output.trim();
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

/**
 * Parse browser-use output into a JSON object.
 * Handles markdown code fences, raw JSON, and object returns.
 */
export function parseOutputAsJSON(output: unknown): Record<string, unknown> | null {
  if (!output) return null;

  if (typeof output === "object" && output !== null) {
    return output as Record<string, unknown>;
  }

  if (typeof output === "string") {
    const cleaned = output.trim();
    // Strip markdown code fences
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : cleaned;
    try {
      return JSON.parse(jsonStr);
    } catch {
      // Try to extract JSON object from surrounding text
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}
