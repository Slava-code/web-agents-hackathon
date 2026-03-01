"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

type PageStatus =
  | "pending"
  | "visiting"
  | "analyzing"
  | "schema_created"
  | "extracting"
  | "complete"
  | "error";

interface LogEntry {
  level: string;
  message: string;
  pageUrl?: string;
  detail?: string;
  timestamp: number;
}

interface PageState {
  pageUrl: string;
  pageName: string;
  status: PageStatus;
  fieldCount: number;
  schema?: Record<string, unknown>;
  script?: string;
  data?: Record<string, unknown>;
  error?: string;
}

const STATUS_COLORS: Record<PageStatus, string> = {
  pending: "#6b7280",
  visiting: "#f59e0b",
  analyzing: "#3b82f6",
  schema_created: "#8b5cf6",
  extracting: "#06b6d4",
  complete: "#10b981",
  error: "#ef4444",
};

const STATUS_LABELS: Record<PageStatus, string> = {
  pending: "Pending",
  visiting: "Visiting...",
  analyzing: "Analyzing...",
  schema_created: "Schema Created",
  extracting: "Extracting...",
  complete: "Complete",
  error: "Error",
};

const DEFAULT_PAGES: PageState[] = [
  { pageUrl: "/uv-robot", pageName: "UV Robot", status: "pending", fieldCount: 0 },
  { pageUrl: "/tug-robot", pageName: "TUG Fleet Monitor", status: "pending", fieldCount: 0 },
  { pageUrl: "/environmental", pageName: "Environmental", status: "pending", fieldCount: 0 },
  { pageUrl: "/ehr", pageName: "Room Scheduling", status: "pending", fieldCount: 0 },
  { pageUrl: "/agent", pageName: "Agent Dashboard", status: "pending", fieldCount: 0 },
];

const LOG_COLORS: Record<string, string> = {
  info: "#9ca3af",
  agent_thought: "#c084fc",
  success: "#10b981",
  error: "#ef4444",
  schema: "#60a5fa",
  script: "#f59e0b",
  data: "#34d399",
};

export default function DiscoveryDashboard() {
  const [mode, setMode] = useState<"mock" | "live">("mock");
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pages, setPages] = useState<PageState[]>(DEFAULT_PAGES);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null);
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Convex subscriptions for persistent state
  const latestSession = useQuery(api.discovery.getLatestSession);
  const convexPages = useQuery(
    api.discovery.getSessionPages,
    latestSession ? { sessionId: latestSession._id } : "skip",
  );
  const convexLogs = useQuery(
    api.discovery.getSessionLogs,
    latestSession ? { sessionId: latestSession._id } : "skip",
  );

  // Hydrate from Convex on load (if no active SSE stream)
  useEffect(() => {
    if (running) return;
    if (latestSession && convexPages && convexLogs) {
      setSessionId(latestSession._id);
      setPages(
        convexPages.map((p) => ({
          pageUrl: p.pageUrl,
          pageName: p.pageName,
          status: p.status as PageStatus,
          fieldCount: Array.isArray(p.discoveredFields)
            ? p.discoveredFields.length
            : 0,
          schema: p.inferredSchema as Record<string, unknown> | undefined,
          script: p.extractionScript ?? undefined,
          data: p.extractedData as Record<string, unknown> | undefined,
          error: p.error ?? undefined,
        })),
      );
      setLogs(
        convexLogs.map((l) => ({
          level: l.level,
          message: l.message,
          pageUrl: l.pageUrl ?? undefined,
          detail: l.detail ?? undefined,
          timestamp: l.timestamp,
        })),
      );
      if (latestSession.completedAt) {
        setElapsed(latestSession.elapsedMs ?? 0);
      }
    }
  }, [running, latestSession, convexPages, convexLogs]);

  // Timer
  useEffect(() => {
    if (!startTime || !running) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [startTime, running]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  const startDiscovery = async () => {
    setRunning(true);
    setLogs([]);
    setPages(DEFAULT_PAGES);
    setStartTime(Date.now());
    setElapsed(0);
    setExpandedSchema(null);
    setExpandedScript(null);
    setExpandedData(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            handleSSEEvent(event);
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        addLog({
          level: "error",
          message: `Discovery failed: ${(e as Error).message}`,
          timestamp: Date.now(),
        });
      }
    }

    setRunning(false);
  };

  const handleSSEEvent = (event: Record<string, unknown>) => {
    const now = Date.now();

    switch (event.type) {
      case "session_created":
        setSessionId(event.sessionId as string);
        addLog({
          level: "info",
          message: `Session created (${event.mode} mode, ${event.totalPages} pages)`,
          timestamp: now,
        });
        break;

      case "visiting":
        setPages((prev) =>
          prev.map((p) =>
            p.pageUrl === event.pageUrl ? { ...p, status: "visiting" } : p,
          ),
        );
        addLog({
          level: "info",
          message: `Navigating to ${event.pageUrl}...`,
          pageUrl: event.pageUrl as string,
          timestamp: now,
        });
        break;

      case "agent_thought":
        addLog({
          level: "agent_thought",
          message: event.thought as string,
          pageUrl: event.pageUrl as string,
          timestamp: now,
        });
        break;

      case "fields_discovered": {
        const fields = event.fields as unknown[];
        setPages((prev) =>
          prev.map((p) =>
            p.pageUrl === event.pageUrl
              ? { ...p, status: "analyzing", fieldCount: fields.length }
              : p,
          ),
        );
        addLog({
          level: "success",
          message: `Discovered ${fields.length} fields on ${event.pageUrl}`,
          pageUrl: event.pageUrl as string,
          detail: event.pagePurpose as string,
          timestamp: now,
        });
        break;
      }

      case "schema_inferred":
        setPages((prev) =>
          prev.map((p) =>
            p.pageUrl === event.pageUrl
              ? {
                  ...p,
                  status: "schema_created",
                  schema: event.schema as Record<string, unknown>,
                }
              : p,
          ),
        );
        addLog({
          level: "schema",
          message: `Schema inferred for ${event.pageUrl}`,
          pageUrl: event.pageUrl as string,
          timestamp: now,
        });
        break;

      case "script_generated":
        setPages((prev) =>
          prev.map((p) =>
            p.pageUrl === event.pageUrl
              ? { ...p, status: "extracting", script: event.script as string }
              : p,
          ),
        );
        addLog({
          level: "script",
          message: `Extraction script generated for ${event.pageUrl}`,
          pageUrl: event.pageUrl as string,
          timestamp: now,
        });
        break;

      case "data_extracted":
        setPages((prev) =>
          prev.map((p) =>
            p.pageUrl === event.pageUrl
              ? {
                  ...p,
                  status: "complete",
                  data: event.data as Record<string, unknown>,
                }
              : p,
          ),
        );
        addLog({
          level: "data",
          message: `Data extracted from ${event.pageUrl}`,
          pageUrl: event.pageUrl as string,
          timestamp: now,
        });
        break;

      case "page_complete":
        addLog({
          level: "success",
          message: `Page ${event.pageUrl} discovery complete`,
          pageUrl: event.pageUrl as string,
          timestamp: now,
        });
        break;

      case "discovery_complete":
        addLog({
          level: "success",
          message: `Discovery complete! Analyzed ${event.totalPages} pages.`,
          timestamp: now,
        });
        break;

      case "error":
        addLog({
          level: "error",
          message: (event.error as string) || "Unknown error",
          pageUrl: event.pageUrl as string | undefined,
          timestamp: now,
        });
        break;
    }
  };

  const resetDiscovery = async () => {
    if (running && abortRef.current) {
      abortRef.current.abort();
    }
    setRunning(false);
    setSessionId(null);
    setPages(DEFAULT_PAGES);
    setLogs([]);
    setStartTime(null);
    setElapsed(0);
    setExpandedSchema(null);
    setExpandedScript(null);
    setExpandedData(null);

    await fetch("/api/discovery-reset", { method: "POST" });
  };

  const formatElapsed = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${mins}:${remainSecs.toString().padStart(2, "0")}`;
  };

  const completedCount = pages.filter((p) => p.status === "complete").length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "20px 32px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0, color: "#f1f5f9" }}>
            Dynamic Schema Discovery
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>
            AI agents explore dashboards and create database tables in real-time
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Timer */}
          {startTime && (
            <div style={{ fontFamily: "monospace", fontSize: "20px", color: running ? "#10b981" : "#64748b", fontWeight: 600 }}>
              {formatElapsed(elapsed)}
            </div>
          )}
          {/* Mode toggle */}
          <div style={{ display: "flex", gap: "4px", background: "#1e293b", borderRadius: "8px", padding: "4px" }}>
            <button
              onClick={() => !running && setMode("mock")}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                border: "none",
                cursor: running ? "not-allowed" : "pointer",
                fontSize: "13px",
                fontWeight: 500,
                background: mode === "mock" ? "#3b82f6" : "transparent",
                color: mode === "mock" ? "#fff" : "#94a3b8",
              }}
            >
              Mock
            </button>
            <button
              onClick={() => !running && setMode("live")}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                border: "none",
                cursor: running ? "not-allowed" : "pointer",
                fontSize: "13px",
                fontWeight: 500,
                background: mode === "live" ? "#3b82f6" : "transparent",
                color: mode === "live" ? "#fff" : "#94a3b8",
              }}
            >
              Live
            </button>
          </div>
          {/* Convex link */}
          <a
            href="https://dashboard.convex.dev"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "13px", color: "#60a5fa", textDecoration: "none" }}
          >
            Convex Dashboard &rarr;
          </a>
        </div>
      </div>

      {/* Control bar */}
      <div style={{ padding: "16px 32px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          onClick={startDiscovery}
          disabled={running}
          style={{
            padding: "10px 28px",
            borderRadius: "8px",
            border: "none",
            cursor: running ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: 600,
            background: running ? "#1e293b" : "#10b981",
            color: running ? "#64748b" : "#fff",
          }}
        >
          {running ? "Running..." : "Start Discovery"}
        </button>
        <button
          onClick={resetDiscovery}
          style={{
            padding: "10px 28px",
            borderRadius: "8px",
            border: "1px solid #374151",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            background: "transparent",
            color: "#94a3b8",
          }}
        >
          Reset
        </button>
        <div style={{ marginLeft: "auto", fontSize: "14px", color: "#64748b" }}>
          Progress:{" "}
          <span style={{ color: "#10b981", fontWeight: 600 }}>
            {completedCount}
          </span>{" "}
          / {pages.length} pages
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", minHeight: "calc(100vh - 140px)" }}>
        {/* Left column: Pages + Schema/Script/Data */}
        <div style={{ borderRight: "1px solid #1e293b", overflow: "auto" }}>
          {/* Pages grid */}
          <div style={{ padding: "20px 24px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
              Pages
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pages.map((page) => (
                <div
                  key={page.pageUrl}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: "#111827",
                    border: `1px solid ${page.status === "complete" ? "#065f46" : "#1e293b"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "#e2e8f0" }}>
                      {page.pageName}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", fontFamily: "monospace" }}>
                      {page.pageUrl}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {page.fieldCount > 0 && (
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                        {page.fieldCount} fields
                      </span>
                    )}
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background: `${STATUS_COLORS[page.status]}22`,
                        color: STATUS_COLORS[page.status],
                        border: `1px solid ${STATUS_COLORS[page.status]}44`,
                      }}
                    >
                      {STATUS_LABELS[page.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Schema panel */}
          {pages.some((p) => p.schema) && (
            <div style={{ padding: "0 24px 20px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                Inferred Schemas
              </h2>
              {pages
                .filter((p) => p.schema)
                .map((page) => (
                  <div key={page.pageUrl} style={{ marginBottom: "8px" }}>
                    <button
                      onClick={() =>
                        setExpandedSchema(
                          expandedSchema === page.pageUrl ? null : page.pageUrl,
                        )
                      }
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 14px",
                        borderRadius: "6px",
                        border: "1px solid #1e293b",
                        background: "#111827",
                        color: "#60a5fa",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 500,
                      }}
                    >
                      {expandedSchema === page.pageUrl ? "▼" : "▶"}{" "}
                      {page.pageName} — {Object.keys(page.schema!).length} fields
                    </button>
                    {expandedSchema === page.pageUrl && (
                      <div
                        style={{
                          margin: "4px 0 0",
                          padding: "12px",
                          background: "#0f172a",
                          borderRadius: "6px",
                          border: "1px solid #1e293b",
                          fontSize: "12px",
                          fontFamily: "monospace",
                          overflow: "auto",
                        }}
                      >
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ color: "#64748b", textAlign: "left" }}>
                              <th style={{ padding: "4px 8px" }}>Field</th>
                              <th style={{ padding: "4px 8px" }}>Type</th>
                              <th style={{ padding: "4px 8px" }}>Label</th>
                              <th style={{ padding: "4px 8px" }}>Unit</th>
                              <th style={{ padding: "4px 8px" }}>ReadOnly</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(
                              page.schema as Record<
                                string,
                                { type: string; label: string; unit?: string; readOnly?: boolean }
                              >,
                            ).map(([key, val]) => (
                              <tr key={key} style={{ borderTop: "1px solid #1e293b" }}>
                                <td style={{ padding: "4px 8px", color: "#e2e8f0" }}>{key}</td>
                                <td style={{ padding: "4px 8px", color: "#8b5cf6" }}>{val.type}</td>
                                <td style={{ padding: "4px 8px", color: "#94a3b8" }}>{val.label}</td>
                                <td style={{ padding: "4px 8px", color: "#f59e0b" }}>{val.unit || "—"}</td>
                                <td style={{ padding: "4px 8px", color: val.readOnly ? "#ef4444" : "#10b981" }}>
                                  {val.readOnly ? "yes" : "no"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Script panel */}
          {pages.some((p) => p.script) && (
            <div style={{ padding: "0 24px 20px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                Extraction Scripts
              </h2>
              {pages
                .filter((p) => p.script)
                .map((page) => (
                  <div key={page.pageUrl} style={{ marginBottom: "8px" }}>
                    <button
                      onClick={() =>
                        setExpandedScript(
                          expandedScript === page.pageUrl ? null : page.pageUrl,
                        )
                      }
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 14px",
                        borderRadius: "6px",
                        border: "1px solid #1e293b",
                        background: "#111827",
                        color: "#f59e0b",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 500,
                      }}
                    >
                      {expandedScript === page.pageUrl ? "▼" : "▶"}{" "}
                      {page.pageName}
                    </button>
                    {expandedScript === page.pageUrl && (
                      <pre
                        style={{
                          margin: "4px 0 0",
                          padding: "12px",
                          background: "#0f172a",
                          borderRadius: "6px",
                          border: "1px solid #1e293b",
                          fontSize: "12px",
                          color: "#a5f3fc",
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {page.script}
                      </pre>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Data preview */}
          {pages.some((p) => p.data) && (
            <div style={{ padding: "0 24px 20px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                Extracted Data
              </h2>
              {pages
                .filter((p) => p.data)
                .map((page) => (
                  <div key={page.pageUrl} style={{ marginBottom: "8px" }}>
                    <button
                      onClick={() =>
                        setExpandedData(
                          expandedData === page.pageUrl ? null : page.pageUrl,
                        )
                      }
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 14px",
                        borderRadius: "6px",
                        border: "1px solid #1e293b",
                        background: "#111827",
                        color: "#34d399",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 500,
                      }}
                    >
                      {expandedData === page.pageUrl ? "▼" : "▶"}{" "}
                      {page.pageName} — {Object.keys(page.data!).length} values
                    </button>
                    {expandedData === page.pageUrl && (
                      <pre
                        style={{
                          margin: "4px 0 0",
                          padding: "12px",
                          background: "#0f172a",
                          borderRadius: "6px",
                          border: "1px solid #1e293b",
                          fontSize: "12px",
                          color: "#a5f3fc",
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {JSON.stringify(page.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Right column: Activity log */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 24px 8px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
              Live Activity Log
            </h2>
          </div>
          <div
            ref={logRef}
            style={{
              flex: 1,
              overflow: "auto",
              padding: "8px 24px",
              fontFamily: "monospace",
              fontSize: "12px",
              lineHeight: "1.7",
            }}
          >
            {logs.length === 0 && (
              <div style={{ color: "#475569", padding: "20px 0", textAlign: "center" }}>
                Click &quot;Start Discovery&quot; to begin...
              </div>
            )}
            {logs.map((log, i) => (
              <div key={i} style={{ color: LOG_COLORS[log.level] || "#9ca3af", marginBottom: "2px" }}>
                {log.pageUrl && (
                  <span style={{ color: "#475569" }}>[{log.pageUrl}] </span>
                )}
                {log.level === "agent_thought" ? (
                  <em>{log.message}</em>
                ) : (
                  log.message
                )}
              </div>
            ))}
            {running && (
              <div style={{ color: "#10b981", marginTop: "4px" }}>
                <span className="pulse">●</span> Processing...
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
