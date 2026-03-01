"use client"

import { ConvexDeviceState } from "@/hooks/useConvexDeviceOverlay"

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; pulse: boolean }> = {
  idle: { bg: "rgba(107,114,128,0.1)", text: "#6b7280", dot: "#6b7280", pulse: false },
  configuring: { bg: "rgba(234,179,8,0.15)", text: "#a16207", dot: "#eab308", pulse: true },
  ready: { bg: "rgba(34,197,94,0.15)", text: "#15803d", dot: "#22c55e", pulse: false },
  error: { bg: "rgba(239,68,68,0.15)", text: "#dc2626", dot: "#ef4444", pulse: true },
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

  return (
    <div
      data-testid="convex-status-badge"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9999,
        background: style.bg,
        color: style.text,
        padding: "8px 16px",
        borderRadius: 8,
        fontSize: 13,
        fontFamily: "monospace",
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        animation: style.pulse ? "convex-pulse 2s ease-in-out infinite" : undefined,
      }}
    >
      <style>{`
        @keyframes convex-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: style.dot,
          display: "inline-block",
        }}
      />
      <span style={{ fontWeight: 600, textTransform: "uppercase" }}>{state.status}</span>
      {state.currentAction && (
        <span style={{ opacity: 0.8, marginLeft: 4 }}>— {state.currentAction}</span>
      )}
    </div>
  )
}
