"use client"

import { ConvexDeviceState } from "@/hooks/useConvexDeviceOverlay"

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; glowColor: string; pulse: boolean }> = {
  idle: { bg: "rgba(107,114,128,0.1)", text: "#6b7280", dot: "#6b7280", glowColor: "107,114,128", pulse: false },
  configuring: { bg: "rgba(234,179,8,0.15)", text: "#a16207", dot: "#eab308", glowColor: "234,179,8", pulse: true },
  ready: { bg: "rgba(34,197,94,0.15)", text: "#15803d", dot: "#22c55e", glowColor: "34,197,94", pulse: false },
  error: { bg: "rgba(239,68,68,0.15)", text: "#dc2626", dot: "#ef4444", glowColor: "239,68,68", pulse: true },
}

export default function ConvexStatusBadge({ state }: { state: ConvexDeviceState }) {
  if (state.isLoading) {
    return (
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 9999,
          background: "rgba(0,0,0,0.8)",
          color: "#fff",
          padding: "8px 16px",
          borderRadius: 8,
          fontSize: 12,
          fontFamily: "monospace",
        }}
      >
        Connecting to Convex...
      </div>
    )
  }

  const style = STATUS_STYLES[state.status] ?? STATUS_STYLES.idle
  const c = style.glowColor
  const isActive = state.status !== "idle"

  return (
    <>
      <style>{`
        @keyframes convex-badge-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes convex-glow-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>

      {/* Full-page edge glow — 4 gradient overlays on each edge */}
      {isActive && (
        <>
          {/* Top edge */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: 80,
              zIndex: 9997,
              pointerEvents: "none",
              background: `linear-gradient(to bottom, rgba(${c},0.4) 0%, rgba(${c},0.08) 40%, transparent 100%)`,
              animation: style.pulse ? "convex-glow-pulse 2s ease-in-out infinite" : undefined,
            }}
          />
          {/* Bottom edge */}
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              height: 80,
              zIndex: 9997,
              pointerEvents: "none",
              background: `linear-gradient(to top, rgba(${c},0.4) 0%, rgba(${c},0.08) 40%, transparent 100%)`,
              animation: style.pulse ? "convex-glow-pulse 2s ease-in-out infinite" : undefined,
            }}
          />
          {/* Left edge */}
          <div
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              left: 0,
              width: 80,
              zIndex: 9997,
              pointerEvents: "none",
              background: `linear-gradient(to right, rgba(${c},0.4) 0%, rgba(${c},0.08) 40%, transparent 100%)`,
              animation: style.pulse ? "convex-glow-pulse 2s ease-in-out infinite" : undefined,
            }}
          />
          {/* Right edge */}
          <div
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              right: 0,
              width: 80,
              zIndex: 9997,
              pointerEvents: "none",
              background: `linear-gradient(to left, rgba(${c},0.4) 0%, rgba(${c},0.08) 40%, transparent 100%)`,
              animation: style.pulse ? "convex-glow-pulse 2s ease-in-out infinite" : undefined,
            }}
          />
          {/* Corner intensifiers (top-left, top-right, bottom-left, bottom-right) */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: 120,
              height: 120,
              zIndex: 9997,
              pointerEvents: "none",
              background: `radial-gradient(ellipse at top left, rgba(${c},0.5) 0%, transparent 70%)`,
              animation: style.pulse ? "convex-glow-pulse 2s ease-in-out infinite" : undefined,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              width: 120,
              height: 120,
              zIndex: 9997,
              pointerEvents: "none",
              background: `radial-gradient(ellipse at top right, rgba(${c},0.5) 0%, transparent 70%)`,
              animation: style.pulse ? "convex-glow-pulse 2s ease-in-out infinite" : undefined,
            }}
          />
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              width: 120,
              height: 120,
              zIndex: 9997,
              pointerEvents: "none",
              background: `radial-gradient(ellipse at bottom left, rgba(${c},0.5) 0%, transparent 70%)`,
              animation: style.pulse ? "convex-glow-pulse 2s ease-in-out infinite" : undefined,
            }}
          />
          <div
            style={{
              position: "fixed",
              bottom: 0,
              right: 0,
              width: 120,
              height: 120,
              zIndex: 9997,
              pointerEvents: "none",
              background: `radial-gradient(ellipse at bottom right, rgba(${c},0.5) 0%, transparent 70%)`,
              animation: style.pulse ? "convex-glow-pulse 2s ease-in-out infinite" : undefined,
            }}
          />
        </>
      )}

      {/* Status badge */}
      <div
        data-testid="convex-status-badge"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 9999,
          background: style.bg,
          color: style.text,
          padding: "10px 20px",
          borderRadius: 10,
          fontSize: 14,
          fontFamily: "monospace",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: isActive
            ? `0 2px 12px rgba(0,0,0,0.15), 0 0 24px rgba(${c},0.4)`
            : "0 2px 8px rgba(0,0,0,0.1)",
          backdropFilter: "blur(8px)",
          animation: style.pulse ? "convex-badge-pulse 2s ease-in-out infinite" : undefined,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: style.dot,
            display: "inline-block",
            boxShadow: isActive ? `0 0 10px ${style.dot}` : undefined,
          }}
        />
        <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{state.status}</span>
        {state.currentAction && (
          <span style={{ opacity: 0.85, marginLeft: 2 }}>— {state.currentAction}</span>
        )}
      </div>
    </>
  )
}
