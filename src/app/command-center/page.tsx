'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import { ROOM_IDS } from '../../lib/convex-api'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
  'https://impartial-whale-32.convex.site'

const OR3_ID = ROOM_IDS.OR_3 as Id<'rooms'>

const CATEGORY_ICONS: Record<string, string> = {
  sterilization: '\u2622',
  transport: '\u{1F69A}',
  monitoring: '\u{1F321}',
  scheduling: '\u{1F4C5}',
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-slate-500',
  preparing: 'bg-amber-500',
  ready: 'bg-emerald-500',
  in_use: 'bg-blue-500',
  needs_attention: 'bg-red-500',
  configuring: 'bg-amber-400',
  error: 'bg-red-500',
  pending: 'bg-slate-400',
  running: 'bg-amber-500',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  idle: 'border-slate-500/50 text-slate-400 bg-slate-500/10',
  preparing: 'border-amber-500/50 text-amber-400 bg-amber-500/10',
  ready: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10',
  in_use: 'border-blue-500/50 text-blue-400 bg-blue-500/10',
  needs_attention: 'border-red-500/50 text-red-400 bg-red-500/10',
}

function formatTimestamp(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function timeSince(ts: number) {
  const diff = Date.now() - ts
  if (diff < 1000) return 'just now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

export default function CommandCenter() {
  const [commandText, setCommandText] = useState('')
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  // --- Convex subscriptions ---
  const roomState = useQuery(api.roomQueries.getRoomStatePublic, {
    roomId: OR3_ID,
  })

  const latestCommand = useQuery(api.commands.getLatest, {
    roomId: OR3_ID,
  })

  const actionLogs = useQuery(
    api.actionLogs.byCommand,
    latestCommand?._id ? { commandId: latestCommand._id } : 'skip'
  )

  const submitCommand = useMutation(api.commands.submit)

  // Build device name lookup from room state
  const deviceNameMap: Record<string, string> = {}
  if (roomState?.devices) {
    for (const d of roomState.devices) {
      deviceNameMap[d._id] = d.name
    }
  }

  // --- Handlers ---
  async function handleSubmitCommand(e: React.FormEvent) {
    e.preventDefault()
    if (!commandText.trim()) return
    await submitCommand({ text: commandText.trim(), roomId: OR3_ID })
    setCommandText('')
  }

  async function handleTriggerAnomaly(scenario: string) {
    setTriggerStatus(`Triggering ${scenario}...`)
    try {
      const resp = await fetch(`${CONVEX_SITE_URL}/trigger-anomaly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: OR3_ID, scenario }),
      })
      const data = await resp.json()
      if (data.ok) {
        setTriggerStatus(`${scenario} triggered`)
      } else {
        setTriggerStatus(`Error: ${data.error}`)
      }
    } catch (err: any) {
      setTriggerStatus(`Error: ${err.message}`)
    }
    setTimeout(() => setTriggerStatus(null), 3000)
  }

  async function handleResetAll() {
    setTriggerStatus('Resetting all devices...')
    if (roomState?.devices) {
      for (const device of roomState.devices) {
        await fetch(`${CONVEX_SITE_URL}/device-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: device._id, status: 'idle' }),
        })
      }
    }
    setTriggerStatus('All devices reset to idle')
    setTimeout(() => setTriggerStatus(null), 2000)
  }

  // Progress calculation
  const deviceCount = roomState?.room?.deviceCount ?? 0
  const devicesReady = latestCommand?.devicesReady ?? 0
  const progressPct = deviceCount > 0 ? (devicesReady / deviceCount) * 100 : 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-mono">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-slate-500 hover:text-slate-300 transition-colors text-sm"
            >
              &larr; Back
            </Link>
            <div className="w-px h-5 bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-lg font-bold tracking-wide text-slate-100">
                COMMAND CENTER
              </h1>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            OR-3 &middot; {roomState?.room?.status?.toUpperCase() ?? 'LOADING'}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ===== LEFT: Room Status Panel ===== */}
        <section className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">
                Room Status
              </h2>
              {roomState?.room && (
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                    STATUS_BADGE_STYLES[roomState.room.status] ??
                    'border-slate-600 text-slate-400'
                  }`}
                >
                  {roomState.room.status.replace('_', ' ').toUpperCase()}
                </span>
              )}
            </div>

            <div className="text-2xl font-bold text-white mb-1">
              {roomState?.room?.name ?? '...'}
            </div>
            <div className="text-xs text-slate-500 mb-5">
              {roomState?.room
                ? `${roomState.room.deviceCount} devices \u00B7 ${roomState.room.devicesReady} ready \u00B7 updated ${timeSince(roomState.room.updatedAt)}`
                : 'Loading...'}
            </div>

            {/* Device cards */}
            <div className="space-y-2">
              {roomState?.devices?.map((device) => (
                <div
                  key={device._id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-slate-800/60 border border-slate-700/50"
                >
                  <span className="text-lg w-7 text-center">
                    {CATEGORY_ICONS[device.category] ?? '\u2699'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200 truncate">
                      {device.name}
                    </div>
                    {device.currentAction && (
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {device.currentAction}
                      </div>
                    )}
                  </div>
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      STATUS_COLORS[device.status] ?? 'bg-slate-500'
                    } ${device.status === 'configuring' ? 'animate-pulse' : ''}`}
                    title={device.status}
                  />
                </div>
              ))}

              {!roomState?.devices && (
                <div className="text-sm text-slate-600 text-center py-4">
                  Loading devices...
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===== RIGHT: Command & Controls ===== */}
        <section className="lg:col-span-7 space-y-4">
          {/* Command Input */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-5">
            <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-3">
              Issue Command
            </h2>
            <form onSubmit={handleSubmitCommand} className="flex gap-2">
              <input
                type="text"
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                placeholder="e.g. Prepare OR-3 for surgery"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap"
              >
                Submit
              </button>
            </form>

            {/* Active command status */}
            {latestCommand && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-300">
                    <span className="text-slate-500">CMD:</span>{' '}
                    {latestCommand.text}
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                      STATUS_BADGE_STYLES[latestCommand.status] ??
                      'border-slate-600 text-slate-400'
                    }`}
                  >
                    {latestCommand.status.toUpperCase()}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      latestCommand.status === 'completed'
                        ? 'bg-emerald-500'
                        : latestCommand.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500">
                  {devicesReady} / {latestCommand.deviceCount} devices ready
                  {latestCommand.elapsedMs != null &&
                    ` \u00B7 ${(latestCommand.elapsedMs / 1000).toFixed(1)}s elapsed`}
                </div>
              </div>
            )}
          </div>

          {/* Anomaly Triggers */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-5">
            <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-3">
              Demo Controls
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleTriggerAnomaly('ventilation_failure')}
                className="px-3 py-1.5 bg-red-900/40 border border-red-700/50 text-red-400 text-xs font-medium rounded-md hover:bg-red-900/60 transition-colors"
              >
                Trigger: Ventilation Failure
              </button>
              <button
                onClick={() => handleTriggerAnomaly('battery_failure')}
                className="px-3 py-1.5 bg-orange-900/40 border border-orange-700/50 text-orange-400 text-xs font-medium rounded-md hover:bg-orange-900/60 transition-colors"
              >
                Trigger: Battery Failure
              </button>
              <button
                onClick={() => handleTriggerAnomaly('co2_spike')}
                className="px-3 py-1.5 bg-yellow-900/40 border border-yellow-700/50 text-yellow-400 text-xs font-medium rounded-md hover:bg-yellow-900/60 transition-colors"
              >
                Trigger: CO2 Spike
              </button>
              <button
                onClick={handleResetAll}
                className="px-3 py-1.5 bg-slate-800 border border-slate-600 text-slate-400 text-xs font-medium rounded-md hover:bg-slate-700 transition-colors"
              >
                Reset All Devices
              </button>
            </div>
            {triggerStatus && (
              <div className="mt-2 text-xs text-slate-500">{triggerStatus}</div>
            )}
          </div>
        </section>

        {/* ===== BOTTOM: Live Reasoning Feed ===== */}
        <section className="lg:col-span-12">
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">
                Live Agent Feed
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                {actionLogs && actionLogs.length > 0 && (
                  <span>{actionLogs.length} entries</span>
                )}
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>LIVE</span>
              </div>
            </div>

            <div
              ref={feedRef}
              className="max-h-96 overflow-y-auto space-y-1 scrollbar-thin"
            >
              {actionLogs && actionLogs.length > 0 ? (
                actionLogs.map((log) => (
                  <div
                    key={log._id}
                    className="flex items-start gap-3 px-3 py-2 rounded-md bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    {/* Timestamp */}
                    <span className="text-xs text-slate-600 whitespace-nowrap pt-0.5 tabular-nums">
                      {formatTimestamp(log.timestamp)}
                    </span>

                    {/* Result indicator */}
                    <div className="pt-1.5 flex-shrink-0">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          log.result === 'success'
                            ? 'bg-emerald-500'
                            : log.result === 'failure'
                              ? 'bg-red-500'
                              : 'bg-amber-400 animate-pulse'
                        }`}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-blue-400 truncate">
                          {deviceNameMap[log.deviceId] ?? log.deviceId}
                        </span>
                        <span className="text-xs text-slate-500">&middot;</span>
                        <span className="text-xs text-slate-300 truncate">
                          {log.action}
                        </span>
                      </div>
                      {log.reasoning && (
                        <div className="text-xs text-amber-300/80 italic bg-amber-500/5 border-l-2 border-amber-500/30 pl-2 py-0.5 mt-1 rounded-r">
                          {log.reasoning}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-600 text-sm">
                  {latestCommand
                    ? 'Waiting for agent activity...'
                    : 'No active command. Submit a command above to begin.'}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
