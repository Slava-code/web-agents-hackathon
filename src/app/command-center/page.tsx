'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import { ROOM_IDS } from '../../lib/convex-api'
import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'

// ─── Constants ────────────────────────────────────────────────────────

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

const BROWSER_STATUS_COLORS: Record<string, string> = {
  idle: 'bg-slate-500',
  starting: 'bg-yellow-500 animate-pulse',
  created: 'bg-yellow-500 animate-pulse',
  running: 'bg-blue-500 animate-pulse',
  complete: 'bg-green-500',
  stopped: 'bg-orange-500',
  error: 'bg-red-500',
}

// ─── Types ────────────────────────────────────────────────────────────

type BrowserEventData =
  | { type: 'session'; id: string; status: string; liveUrl: string | null }
  | { type: 'status'; status: string; output: string | null; cost: string | null }
  | { type: 'done'; status: string; output: string | null; cost: string | null }
  | { type: 'error'; message: string }

type OrchestrateEvent =
  | { type: 'scenario_start'; commandId: string; roomId: string; tasks: Record<string, string>; taskCount: number }
  | { type: 'anomaly_triggered'; scenario: string }
  | { type: 'phase_start'; phase: number; agentId: string; taskName: string }
  | { type: 'agent_start'; phase: number; sessionId: string; liveUrl: string | null }
  | { type: 'agent_status'; phase: number; status: string; cost?: string }
  | { type: 'phase_complete'; phase: number; agentId: string; output: unknown; cost: string }
  | { type: 'phase_error'; phase: number; agentId: string; error: string }
  | { type: 'scenario_complete'; commandId: string; totalCost: string; elapsedMs: number; allDone: boolean; failed: boolean }
  | { type: 'error'; message: string }

interface BrowserEvent {
  id: number
  timestamp: number
  data: BrowserEventData
}

interface ConvexFeedItem {
  kind: 'convex'
  id: string
  timestamp: number
  deviceName: string
  action: string
  reasoning: string | null
  result: string
}

interface BrowserFeedItem {
  kind: 'browser'
  id: number
  timestamp: number
  message: string
  detail?: string
}

type FeedEntry = ConvexFeedItem | BrowserFeedItem

// ─── Helpers ──────────────────────────────────────────────────────────

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

function formatBrowserEvent(data: BrowserEventData): { message: string; detail?: string } {
  switch (data.type) {
    case 'session':
      return {
        message: 'Browser session started',
        detail: data.liveUrl ? 'Live viewer connected' : 'Waiting for live URL...',
      }
    case 'status':
      return {
        message: `Agent status: ${data.status}`,
        detail: data.output ? data.output.slice(0, 120) : undefined,
      }
    case 'done':
      return {
        message: `Session complete${data.cost ? ` (cost: $${data.cost})` : ''}`,
      }
    case 'error':
      return {
        message: `Error: ${data.message}`,
      }
  }
}

// ─── Component ────────────────────────────────────────────────────────

export default function CommandCenter() {
  // --- Convex state ---
  const [commandText, setCommandText] = useState('')
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

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

  const deviceNameMap: Record<string, string> = {}
  if (roomState?.devices) {
    for (const d of roomState.devices) {
      deviceNameMap[d._id] = d.name
    }
  }

  // --- Browser agent state ---
  const [browserRunning, setBrowserRunning] = useState(false)
  const [liveUrl, setLiveUrl] = useState<string | null>(null)
  const [browserEvents, setBrowserEvents] = useState<BrowserEvent[]>([])
  const [browserStatus, setBrowserStatus] = useState<string>('idle')
  const [browserCost, setBrowserCost] = useState<string | null>(null)
  const [browserError, setBrowserError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  let nextEventId = useRef(0)

  // --- Orchestration state ---
  const [orchestrating, setOrchestrating] = useState(false)
  const [orchestratePhase, setOrchestratePhase] = useState(0)
  const [orchestrateTotalPhases] = useState(4)
  const [orchestrateEvents, setOrchestrateEvents] = useState<OrchestrateEvent[]>([])
  const [orchestrateCost, setOrchestrateCost] = useState<string | null>(null)
  const [orchestrateDone, setOrchestrateDone] = useState(false)
  const [orchestrateFailed, setOrchestrateFailed] = useState(false)
  const orchestrateAbortRef = useRef<AbortController | null>(null)

  // --- SSE stream consumer (simplified from /agent) ---
  async function consumeStream(res: Response) {
    if (!res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6)) as BrowserEventData
          const id = nextEventId.current++
          const timestamp = Date.now()

          setBrowserEvents((prev) => [...prev, { id, timestamp, data }])

          if (data.type === 'session') {
            if (data.liveUrl) setLiveUrl(data.liveUrl)
            setBrowserStatus(data.status)
          } else if (data.type === 'status') {
            setBrowserStatus(data.status)
            if (data.cost) setBrowserCost(data.cost)
          } else if (data.type === 'done') {
            setBrowserStatus('complete')
            if (data.cost) setBrowserCost(data.cost)
            setBrowserRunning(false)
          } else if (data.type === 'error') {
            setBrowserError(data.message)
            setBrowserStatus('error')
            setBrowserRunning(false)
          }
        } catch {
          /* skip malformed lines */
        }
      }
    }
  }

  // --- Start browser session ---
  async function startBrowserSession(task: string) {
    setBrowserRunning(true)
    setBrowserEvents([])
    setLiveUrl(null)
    setBrowserStatus('starting')
    setBrowserCost(null)
    setBrowserError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/browser-use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '')
        setBrowserError(`Browser agent failed: ${res.status} — ${errorBody || res.statusText}`)
        setBrowserStatus('error')
        setBrowserRunning(false)
        return
      }

      await consumeStream(res)
    } catch (e: unknown) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setBrowserError(e instanceof Error ? e.message : String(e))
        setBrowserStatus('error')
      }
      setBrowserRunning(false)
    }
  }

  // --- Handlers ---
  async function handleSubmitCommand(e: React.FormEvent) {
    e.preventDefault()
    if (!commandText.trim()) return
    const text = commandText.trim()
    setCommandText('')
    // Fire both: Convex command + browser session
    await submitCommand({ text, roomId: OR3_ID })
    startBrowserSession(text)
  }

  function handleStop() {
    abortRef.current?.abort()
    setBrowserRunning(false)
    setBrowserStatus('stopped')
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

  // --- Emergency Response Orchestrator ---
  async function handleEmergencyResponse() {
    setOrchestrating(true)
    setOrchestratePhase(0)
    setOrchestrateEvents([])
    setOrchestrateCost(null)
    setOrchestrateDone(false)
    setOrchestrateFailed(false)
    setBrowserStatus('starting')
    setLiveUrl(null)

    const controller = new AbortController()
    orchestrateAbortRef.current = controller

    try {
      const res = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: OR3_ID, scenario: 'ventilation_failure' }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const errorBody = await res.text().catch(() => '')
        setTriggerStatus(`Orchestrator failed: ${res.status} — ${errorBody || res.statusText}`)
        setOrchestrating(false)
        setBrowserStatus('error')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as OrchestrateEvent
            setOrchestrateEvents((prev) => [...prev, event])

            // Also add to browser feed for the unified activity log
            const id = nextEventId.current++
            const timestamp = Date.now()

            switch (event.type) {
              case 'scenario_start':
                setBrowserEvents((prev) => [...prev, { id, timestamp, data: { type: 'session', id: event.commandId, status: 'running', liveUrl: null } }])
                setBrowserStatus('running')
                break
              case 'phase_start':
                setOrchestratePhase(event.phase)
                setBrowserEvents((prev) => [...prev, { id, timestamp, data: { type: 'status', status: `Phase ${event.phase}/4: ${event.taskName}`, output: null, cost: null } }])
                break
              case 'agent_start':
                if (event.liveUrl) setLiveUrl(event.liveUrl)
                break
              case 'agent_status':
                setBrowserStatus(event.status === 'running' ? 'running' : event.status)
                break
              case 'phase_complete':
                setBrowserEvents((prev) => [...prev, { id, timestamp, data: { type: 'status', status: `Phase ${event.phase} complete`, output: null, cost: event.cost } }])
                setBrowserCost(event.cost)
                break
              case 'phase_error':
                setBrowserEvents((prev) => [...prev, { id, timestamp, data: { type: 'error', message: `Phase ${event.phase}: ${event.error}` } }])
                setOrchestrateFailed(true)
                break
              case 'scenario_complete':
                setOrchestrateCost(event.totalCost)
                setOrchestrateDone(true)
                setOrchestrateFailed(event.failed)
                setBrowserCost(event.totalCost)
                setBrowserStatus(event.allDone ? 'complete' : 'stopped')
                setBrowserRunning(false)
                setOrchestrating(false)
                setBrowserEvents((prev) => [...prev, { id, timestamp, data: { type: 'done', status: event.allDone ? 'complete' : 'partial', output: null, cost: event.totalCost } }])
                break
              case 'error':
                setBrowserEvents((prev) => [...prev, { id, timestamp, data: { type: 'error', message: event.message } }])
                setBrowserStatus('error')
                setOrchestrating(false)
                setOrchestrateFailed(true)
                break
            }
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (e: unknown) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setTriggerStatus(e instanceof Error ? e.message : String(e))
        setBrowserStatus('error')
      }
      setOrchestrating(false)
    }
  }

  function handleStopOrchestrate() {
    orchestrateAbortRef.current?.abort()
    setOrchestrating(false)
    setBrowserStatus('stopped')
  }

  // --- Unified feed ---
  const unifiedFeed = useMemo<FeedEntry[]>(() => {
    const entries: FeedEntry[] = []

    // Convex action logs
    if (actionLogs) {
      for (const log of actionLogs) {
        entries.push({
          kind: 'convex',
          id: log._id,
          timestamp: log.timestamp,
          deviceName: deviceNameMap[log.deviceId] ?? log.deviceId,
          action: log.action,
          reasoning: log.reasoning ?? null,
          result: log.result,
        })
      }
    }

    // Browser events
    for (const ev of browserEvents) {
      const { message, detail } = formatBrowserEvent(ev.data)
      entries.push({
        kind: 'browser',
        id: ev.id,
        timestamp: ev.timestamp,
        message,
        detail,
      })
    }

    // Sort ascending (oldest first, newest at bottom)
    entries.sort((a, b) => a.timestamp - b.timestamp)
    return entries
  }, [actionLogs, browserEvents, deviceNameMap])

  // --- Auto-scroll feed ---
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [unifiedFeed])

  // --- Progress ---
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
          <div className="flex items-center gap-4">
            {/* Browser agent status */}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${BROWSER_STATUS_COLORS[browserStatus] || 'bg-slate-500'}`}
              />
              <span className="text-xs text-slate-500 capitalize">
                Agent: {browserStatus}
              </span>
            </div>
            {browserCost && (
              <span className="text-xs text-slate-500">
                Cost: <span className="text-green-400 font-mono">${browserCost}</span>
              </span>
            )}
            <div className="w-px h-4 bg-slate-700" />
            <div className="text-xs text-slate-500">
              OR-3 &middot; {roomState?.room?.status?.toUpperCase() ?? 'LOADING'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ===== LEFT: Live Browser Viewer ===== */}
        <section className="lg:col-span-7">
          <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden relative">
            {liveUrl ? (
              <div className="relative">
                <iframe
                  src={liveUrl}
                  className="w-full bg-black"
                  style={{ height: 'calc(100vh - 340px)', minHeight: '400px' }}
                  allow="clipboard-read; clipboard-write"
                />
                {browserRunning && (
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={handleStop}
                      className="px-3 py-1.5 bg-red-600/90 hover:bg-red-500 text-white text-xs font-medium rounded-md transition-colors backdrop-blur-sm flex items-center gap-1.5"
                    >
                      <div className="w-2 h-2 rounded-sm bg-white" />
                      Stop Agent
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="flex items-center justify-center bg-slate-950"
                style={{ height: 'calc(100vh - 340px)', minHeight: '400px' }}
              >
                <div className="text-center text-slate-600">
                  <div className="text-5xl mb-3 opacity-40">&#127760;</div>
                  <p className="text-sm font-medium">Live browser will appear here</p>
                  <p className="text-xs mt-1 text-slate-700">
                    Submit a command to start the browser agent
                  </p>
                  {browserError && (
                    <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-md text-xs text-red-400 max-w-xs mx-auto">
                      {browserError}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ===== RIGHT: Room Status + Command + Controls ===== */}
        <section className="lg:col-span-5 space-y-4">
          {/* Room Status Panel */}
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
                disabled={browserRunning}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap"
              >
                {browserRunning ? 'Running...' : 'Submit'}
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

          {/* Emergency Response Orchestrator */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-5">
            <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-3">
              Emergency Response
            </h2>
            <div className="flex gap-2 mb-3">
              <button
                onClick={handleEmergencyResponse}
                disabled={orchestrating || browserRunning}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-bold rounded-md transition-colors"
              >
                {orchestrating ? 'Running...' : 'Run Emergency Response'}
              </button>
              {orchestrating && (
                <button
                  onClick={handleStopOrchestrate}
                  className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-md transition-colors"
                >
                  Stop
                </button>
              )}
            </div>

            {/* Phase Progress Pipeline */}
            {(orchestrating || orchestrateDone || orchestrateFailed) && (
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  {[
                    { label: 'ENV', agent: 'env-agent', phase: 1 },
                    { label: 'TUG', agent: 'tug-agent', phase: 2 },
                    { label: 'UV', agent: 'uv-agent', phase: 3 },
                    { label: 'EHR', agent: 'ehr-agent', phase: 4 },
                  ].map((step) => {
                    const isComplete = orchestrateEvents.some(
                      (e) => e.type === 'phase_complete' && e.phase === step.phase
                    )
                    const isError = orchestrateEvents.some(
                      (e) => e.type === 'phase_error' && e.phase === step.phase
                    )
                    const isActive = orchestratePhase === step.phase && orchestrating
                    const isPending = step.phase > orchestratePhase

                    let bg = 'bg-slate-700 text-slate-500'
                    if (isComplete) bg = 'bg-emerald-600/30 text-emerald-400 border-emerald-500/50'
                    else if (isError) bg = 'bg-red-600/30 text-red-400 border-red-500/50'
                    else if (isActive) bg = 'bg-blue-600/30 text-blue-400 border-blue-500/50 animate-pulse'
                    else if (isPending) bg = 'bg-slate-800 text-slate-600'

                    return (
                      <div
                        key={step.phase}
                        className={`flex-1 text-center py-1.5 rounded text-xs font-bold border ${bg}`}
                      >
                        {step.label}
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Phase {orchestratePhase}/{orchestrateTotalPhases}
                    {orchestrating && ' — running'}
                    {orchestrateDone && !orchestrateFailed && ' — complete'}
                    {orchestrateFailed && ' — failed'}
                  </span>
                  {orchestrateCost && (
                    <span>
                      Cost: <span className="text-green-400">${orchestrateCost}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Demo Controls */}
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

        {/* ===== BOTTOM: Unified Live Activity Feed ===== */}
        <section className="lg:col-span-12">
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">
                Live Activity Feed
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                {unifiedFeed.length > 0 && (
                  <span>{unifiedFeed.length} entries</span>
                )}
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>LIVE</span>
              </div>
            </div>

            <div
              ref={feedRef}
              className="max-h-96 overflow-y-auto space-y-1 scrollbar-thin"
            >
              {unifiedFeed.length > 0 ? (
                unifiedFeed.map((entry) =>
                  entry.kind === 'convex' ? (
                    <ConvexFeedEntry key={`c-${entry.id}`} entry={entry} />
                  ) : (
                    <BrowserFeedEntry key={`b-${entry.id}`} entry={entry} />
                  )
                )
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

// ─── Feed Sub-components ──────────────────────────────────────────────

function ConvexFeedEntry({ entry }: { entry: ConvexFeedItem }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-md bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-colors">
      <span className="text-xs text-slate-600 whitespace-nowrap pt-0.5 tabular-nums">
        {formatTimestamp(entry.timestamp)}
      </span>
      <div className="pt-1.5 flex-shrink-0">
        <div
          className={`w-2 h-2 rounded-full ${
            entry.result === 'success'
              ? 'bg-emerald-500'
              : entry.result === 'failure'
                ? 'bg-red-500'
                : 'bg-amber-400 animate-pulse'
          }`}
        />
      </div>
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 uppercase tracking-wider flex-shrink-0 mt-0.5">
        Agent
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-blue-400 truncate">
            {entry.deviceName}
          </span>
          <span className="text-xs text-slate-500">&middot;</span>
          <span className="text-xs text-slate-300 truncate">
            {entry.action}
          </span>
        </div>
        {entry.reasoning && (
          <div className="text-xs text-amber-300/80 italic bg-amber-500/5 border-l-2 border-amber-500/30 pl-2 py-0.5 mt-1 rounded-r">
            &ldquo;{entry.reasoning}&rdquo;
          </div>
        )}
      </div>
    </div>
  )
}

function BrowserFeedEntry({ entry }: { entry: BrowserFeedItem }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-md bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-colors">
      <span className="text-xs text-slate-600 whitespace-nowrap pt-0.5 tabular-nums">
        {formatTimestamp(entry.timestamp)}
      </span>
      <div className="pt-1.5 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-cyan-400" />
      </div>
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider flex-shrink-0 mt-0.5">
        Browser
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-300">{entry.message}</div>
        {entry.detail && (
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            {entry.detail}
          </div>
        )}
      </div>
    </div>
  )
}
