'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────

interface SiteRoute {
  path: string
  pagePurpose: string
  fieldCount: number
}

interface SavedSite {
  id: string
  hostname: string
  baseUrl: string
  learnedAt: string
  totalCost: string
  routeCount: number
  fieldCount: number
  routes: SiteRoute[]
}

interface DiffData {
  changed: Record<string, { old: unknown; new: unknown }>
  added: Record<string, unknown>
  removed: string[]
  hasChanges?: boolean
}

type EventData =
  | { type: 'session'; id: string; status: string; liveUrl: string | null; route?: string }
  | { type: 'status'; status: string; output: string | null; cost: string | null }
  | { type: 'done'; status: string; output: string | null; cost: string | null; inputTokens?: number; outputTokens?: number; summary?: Record<string, unknown> }
  | { type: 'error'; message: string }
  | { type: 'learning'; route: string; status: string; error?: string; rawOutput?: string }
  | { type: 'learned'; route: string; pagePurpose: string; fieldCount: number; fields: unknown[]; cost: string }
  | { type: 'previous_snapshot'; data: Record<string, unknown> | null }
  | { type: 'scrape_result'; data: Record<string, unknown>; cost: string }
  | { type: 'diff'; diff: DiffData; hasChanges: boolean; isFirstRun?: boolean }
  | { type: 'convex'; ok: boolean; deviceId: string; deviceName: string; fieldsSent: number; error?: string; message?: string }

type Tab = 'learn' | 'scrape' | 'monitor' | 'custom'

// ─── Component ───────────────────────────────────────────────────────

export default function AgentPage() {
  const [tab, setTab] = useState<Tab>('learn')

  // Shared state
  const [isRunning, setIsRunning] = useState(false)
  const [liveUrl, setLiveUrl] = useState<string | null>(null)
  const [events, setEvents] = useState<EventData[]>([])
  const [output, setOutput] = useState<string | null>(null)
  const [cost, setCost] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Learn state
  const [learnBaseUrl, setLearnBaseUrl] = useState('')
  const [learnRoutes, setLearnRoutes] = useState('/uv-robot\n/environmental\n/sterilizer\n/ehr\n/camera')

  // Scrape + Monitor state (shared site/route selectors)
  const [savedSites, setSavedSites] = useState<SavedSite[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [selectedRoute, setSelectedRoute] = useState('')

  // Monitor-specific state
  const [monitorDiff, setMonitorDiff] = useState<DiffData | null>(null)
  const [monitorConvex, setMonitorConvex] = useState<{ ok: boolean; deviceName: string; fieldsSent: number; error?: string; message?: string } | null>(null)
  const [monitorPrevSnapshot, setMonitorPrevSnapshot] = useState<Record<string, unknown> | null | undefined>(undefined)
  const [monitorIsFirstRun, setMonitorIsFirstRun] = useState(false)

  // Custom state
  const [customTask, setCustomTask] = useState('')

  // Load saved sites
  const loadSites = useCallback(async () => {
    try {
      const res = await fetch('/api/sites')
      if (res.ok) {
        const sites = await res.json()
        setSavedSites(sites)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadSites() }, [loadSites])

  const selectedSite = savedSites.find((s) => s.id === selectedSiteId)

  // ─── Reset state ──────────────────────────────────────────────────

  const resetState = () => {
    setIsRunning(false)
    setLiveUrl(null)
    setEvents([])
    setOutput(null)
    setCost(null)
    setStatus('idle')
    setError(null)
    setMonitorDiff(null)
    setMonitorConvex(null)
    setMonitorPrevSnapshot(undefined)
    setMonitorIsFirstRun(false)
  }

  // ─── SSE stream consumer ──────────────────────────────────────────

  const consumeStream = async (res: Response) => {
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
          const data: EventData = JSON.parse(line.slice(6))
          setEvents((prev) => [...prev, data])

          if (data.type === 'session') {
            if (data.liveUrl) setLiveUrl(data.liveUrl)
            setStatus(data.status)
          } else if (data.type === 'status') {
            setStatus(data.status)
            if (data.output) setOutput(data.output)
            if (data.cost) setCost(data.cost)
          } else if (data.type === 'done') {
            setStatus('complete')
            if (data.output) setOutput(data.output)
            if (data.cost) setCost(data.cost)
            setIsRunning(false)
          } else if (data.type === 'error') {
            setError(data.message)
            setIsRunning(false)
          } else if (data.type === 'learned') {
            setCost((prev) => {
              const prevNum = parseFloat(prev || '0')
              return (prevNum + parseFloat(data.cost || '0')).toFixed(6)
            })
          } else if (data.type === 'previous_snapshot') {
            setMonitorPrevSnapshot(data.data)
          } else if (data.type === 'scrape_result') {
            setOutput(JSON.stringify(data.data, null, 2))
            if (data.cost) setCost(data.cost)
          } else if (data.type === 'diff') {
            setMonitorDiff(data.diff)
            setMonitorIsFirstRun(data.isFirstRun || false)
          } else if (data.type === 'convex') {
            setMonitorConvex({
              ok: data.ok,
              deviceName: data.deviceName,
              fieldsSent: data.fieldsSent,
              error: data.error,
              message: data.message,
            })
          }
        } catch { /* skip */ }
      }
    }
  }

  // ─── Learn handler ────────────────────────────────────────────────

  const handleLearn = async () => {
    if (!learnBaseUrl.trim()) {
      setError('Enter a base URL first')
      return
    }

    const routes = learnRoutes
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.startsWith('/'))

    if (routes.length === 0) {
      setError('Enter at least one route (e.g. /uv-robot)')
      return
    }

    resetState()
    setIsRunning(true)
    setStatus('learning')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: learnBaseUrl.replace(/\/$/, ''), routes }),
        signal: controller.signal,
      })

      if (!res.ok) {
        setError(`Request failed: ${res.status}`)
        setIsRunning(false)
        return
      }

      await consumeStream(res)
      await loadSites()
    } catch (e: unknown) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
      setIsRunning(false)
    }
  }

  // ─── Scrape handler ───────────────────────────────────────────────

  const handleScrape = async () => {
    if (!selectedSiteId || !selectedRoute) {
      setError('Select a saved site and route')
      return
    }

    resetState()
    setIsRunning(true)
    setStatus('starting')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/browser-use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: selectedSiteId, route: selectedRoute }),
        signal: controller.signal,
      })

      if (!res.ok) {
        setError(`Request failed: ${res.status}`)
        setIsRunning(false)
        return
      }

      await consumeStream(res)
    } catch (e: unknown) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
      setIsRunning(false)
    }
  }

  // ─── Monitor handler ──────────────────────────────────────────────

  const handleMonitor = async () => {
    if (!selectedSiteId || !selectedRoute) {
      setError('Select a saved site and route')
      return
    }

    resetState()
    setIsRunning(true)
    setStatus('monitoring')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: selectedSiteId, route: selectedRoute }),
        signal: controller.signal,
      })

      if (!res.ok) {
        setError(`Request failed: ${res.status}`)
        setIsRunning(false)
        return
      }

      await consumeStream(res)
    } catch (e: unknown) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
      setIsRunning(false)
    }
  }

  // ─── Custom handler ───────────────────────────────────────────────

  const handleCustom = async () => {
    if (!customTask.trim()) {
      setError('Enter a task description')
      return
    }

    resetState()
    setIsRunning(true)
    setStatus('starting')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/browser-use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: customTask }),
        signal: controller.signal,
      })

      if (!res.ok) {
        setError(`Request failed: ${res.status}`)
        setIsRunning(false)
        return
      }

      await consumeStream(res)
    } catch (e: unknown) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
      setIsRunning(false)
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setIsRunning(false)
    setStatus('stopped')
  }

  const handleDeleteSite = async (id: string) => {
    await fetch(`/api/sites?id=${id}`, { method: 'DELETE' })
    await loadSites()
    if (selectedSiteId === id) {
      setSelectedSiteId('')
      setSelectedRoute('')
    }
  }

  // ─── Status indicator ─────────────────────────────────────────────

  const statusColor: Record<string, string> = {
    idle: 'bg-slate-500',
    starting: 'bg-yellow-500 animate-pulse',
    learning: 'bg-purple-500 animate-pulse',
    monitoring: 'bg-amber-500 animate-pulse',
    created: 'bg-yellow-500 animate-pulse',
    running: 'bg-blue-500 animate-pulse',
    complete: 'bg-green-500',
    stopped: 'bg-orange-500',
    error: 'bg-red-500',
  }

  // ─── Shared site/route selector ────────────────────────────────────

  const SiteRouteSelector = ({ actionLabel, onAction, buttonColor = 'bg-blue-600 hover:bg-blue-500' }: {
    actionLabel: string
    onAction: () => void
    buttonColor?: string
  }) => (
    <div className="p-4 space-y-3">
      {savedSites.length === 0 ? (
        <div className="text-center text-slate-500 py-8">
          <p className="text-sm">No saved sites yet.</p>
          <p className="text-xs mt-1">Switch to the Learn tab to teach the agent about a site.</p>
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Saved Site
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => {
                setSelectedSiteId(e.target.value)
                setSelectedRoute('')
              }}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Select a site...</option>
              {savedSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.hostname} ({s.routeCount} routes)
                </option>
              ))}
            </select>
          </div>

          {selectedSite && (
            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Route
              </label>
              <select
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select a route...</option>
                {selectedSite.routes.map((r) => (
                  <option key={r.path} value={r.path}>
                    {r.path} — {r.pagePurpose} ({r.fieldCount} fields)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onAction}
              disabled={isRunning || !selectedSiteId || !selectedRoute}
              className={`flex-1 px-4 py-2 ${buttonColor} disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors`}
            >
              {isRunning ? 'Running...' : actionLabel}
            </button>
            {isRunning && (
              <button onClick={handleStop} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors">
                Stop
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors text-sm">
            ← Dashboards
          </Link>
          <h1 className="text-xl font-bold">Browser Agent</h1>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${statusColor[status] || 'bg-slate-500'}`} />
            <span className="text-sm text-slate-400 capitalize">{status}</span>
          </div>
        </div>
        {cost && (
          <span className="text-sm text-slate-400">
            Cost: <span className="text-green-400 font-mono">${cost}</span>
          </span>
        )}
      </div>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Left: Live Browser Viewer */}
        <div className="flex-1 flex flex-col">
          {liveUrl ? (
            <iframe
              src={liveUrl}
              className="flex-1 w-full bg-black"
              allow="clipboard-read; clipboard-write"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-950">
              <div className="text-center text-slate-500">
                <div className="text-6xl mb-4">&#127760;</div>
                <p className="text-lg">Live browser will appear here</p>
                <p className="text-sm mt-1">Learn a site or run a task to start</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Controls Panel */}
        <div className="w-[420px] border-l border-slate-700 flex flex-col overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex border-b border-slate-700">
            {(['learn', 'scrape', 'monitor', 'custom'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); resetState() }}
                className={`flex-1 px-3 py-3 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? 'text-white border-b-2 border-blue-500 bg-slate-800/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto">
            {/* ── Learn Tab ───────────────────────────────────── */}
            {tab === 'learn' && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Base URL (your tunnel)
                  </label>
                  <input
                    type="text"
                    value={learnBaseUrl}
                    onChange={(e) => setLearnBaseUrl(e.target.value)}
                    placeholder="https://your-tunnel.trycloudflare.com"
                    className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Routes (one per line)
                  </label>
                  <textarea
                    value={learnRoutes}
                    onChange={(e) => setLearnRoutes(e.target.value)}
                    rows={5}
                    className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleLearn}
                    disabled={isRunning}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                  >
                    {isRunning ? 'Learning...' : 'Learn Site'}
                  </button>
                  {isRunning && (
                    <button onClick={handleStop} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors">
                      Stop
                    </button>
                  )}
                </div>

                {/* Saved Sites */}
                {savedSites.length > 0 && (
                  <div className="pt-3 border-t border-slate-700">
                    <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                      Saved Sites
                    </h3>
                    <div className="space-y-2">
                      {savedSites.map((site) => (
                        <div key={site.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white truncate">{site.hostname}</span>
                            <button
                              onClick={() => handleDeleteSite(site.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {site.routeCount} routes, {site.fieldCount} fields
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {site.routes.map((r) => r.path).join(', ')}
                          </div>
                          <div className="text-xs text-slate-500">
                            Cost: ${site.totalCost} | {new Date(site.learnedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Scrape Tab ──────────────────────────────────── */}
            {tab === 'scrape' && (
              <SiteRouteSelector
                actionLabel="Extract Data"
                onAction={handleScrape}
              />
            )}

            {/* ── Monitor Tab ─────────────────────────────────── */}
            {tab === 'monitor' && (
              <div>
                <SiteRouteSelector
                  actionLabel="Monitor & Diff"
                  onAction={handleMonitor}
                  buttonColor="bg-amber-600 hover:bg-amber-500"
                />

                {/* Diff Results */}
                {monitorDiff && (
                  <div className="px-4 pb-3 space-y-2">
                    <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {monitorIsFirstRun ? 'Initial Scan (no previous data)' : 'Changes Detected'}
                    </h3>

                    {!monitorDiff.hasChanges && !monitorIsFirstRun && (
                      <div className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-400">
                        No changes detected
                      </div>
                    )}

                    {/* Changed fields */}
                    {Object.entries(monitorDiff.changed).length > 0 && (
                      <div className="space-y-1">
                        {Object.entries(monitorDiff.changed).map(([key, val]) => (
                          <div key={key} className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs font-mono">
                            <span className="text-yellow-400">{key}</span>
                            <div className="text-slate-500 mt-0.5">
                              <span className="text-red-400 line-through">{JSON.stringify(val.old)}</span>
                              {' → '}
                              <span className="text-green-400">{JSON.stringify(val.new)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Added fields */}
                    {Object.entries(monitorDiff.added).length > 0 && (
                      <div className="space-y-1">
                        {Object.entries(monitorDiff.added).map(([key, val]) => (
                          <div key={key} className="px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs font-mono">
                            <span className="text-green-400">+ {key}</span>
                            <span className="text-slate-400 ml-2">{JSON.stringify(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Removed fields */}
                    {monitorDiff.removed.length > 0 && (
                      <div className="space-y-1">
                        {monitorDiff.removed.map((key) => (
                          <div key={key} className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-mono">
                            <span className="text-red-400">- {key}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Convex Push Status */}
                {monitorConvex && (
                  <div className="px-4 pb-3">
                    <div className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                      monitorConvex.ok
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}>
                      <span>{monitorConvex.ok ? '\u2713' : '\u2717'}</span>
                      <span>
                        {monitorConvex.fieldsSent > 0
                          ? `Pushed ${monitorConvex.fieldsSent} fields to Convex (${monitorConvex.deviceName})`
                          : monitorConvex.message || (monitorConvex.ok ? 'No changes to push' : monitorConvex.error)
                        }
                      </span>
                    </div>
                  </div>
                )}

                {/* Previous Snapshot (collapsible) */}
                {monitorPrevSnapshot !== undefined && (
                  <details className="px-4 pb-3">
                    <summary className="text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300">
                      Previous Snapshot {monitorPrevSnapshot === null ? '(none)' : ''}
                    </summary>
                    {monitorPrevSnapshot && (
                      <pre className="mt-2 text-xs bg-slate-800 border border-slate-600 rounded-lg p-3 overflow-auto max-h-[200px] whitespace-pre-wrap text-slate-400 font-mono">
                        {JSON.stringify(monitorPrevSnapshot, null, 2)}
                      </pre>
                    )}
                  </details>
                )}
              </div>
            )}

            {/* ── Custom Tab ──────────────────────────────────── */}
            {tab === 'custom' && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Task
                  </label>
                  <textarea
                    value={customTask}
                    onChange={(e) => setCustomTask(e.target.value)}
                    placeholder="Navigate to https://... and extract all data from the page. Return as JSON."
                    rows={6}
                    className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCustom}
                    disabled={isRunning}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                  >
                    {isRunning ? 'Running...' : 'Run Agent'}
                  </button>
                  {isRunning && (
                    <button onClick={handleStop} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors">
                      Stop
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Shared: Error + Events + Output ─────────────── */}
            <div className="p-4 space-y-3 border-t border-slate-700">
              {error && (
                <div className="px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-300">
                  {error}
                </div>
              )}

              {events.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Events</h3>
                  <div className="max-h-[200px] overflow-auto space-y-1">
                    {events.map((ev, i) => (
                      <div key={i} className="text-xs font-mono px-2 py-1 rounded bg-slate-800 text-slate-300">
                        <span className="text-blue-400">[{ev.type}]</span>{' '}
                        {ev.type === 'session' && `id=${ev.id.slice(0, 8)}...`}
                        {ev.type === 'status' && `status=${ev.status}`}
                        {ev.type === 'done' && (
                          <span>
                            cost=${ev.cost}
                            {ev.summary && ` | ${(ev.summary as Record<string, unknown>).fieldsSent ?? 0} fields pushed`}
                          </span>
                        )}
                        {ev.type === 'error' && <span className="text-red-400">{ev.message}</span>}
                        {ev.type === 'learning' && (
                          <span>
                            {ev.route} — <span className={ev.status === 'error' ? 'text-red-400' : 'text-yellow-400'}>{ev.status}</span>
                            {ev.error && `: ${ev.error}`}
                          </span>
                        )}
                        {ev.type === 'learned' && (
                          <span className="text-green-400">
                            {ev.route} — {ev.fieldCount} fields (${ev.cost})
                          </span>
                        )}
                        {ev.type === 'diff' && (
                          <span className={ev.hasChanges ? 'text-yellow-400' : 'text-slate-400'}>
                            {ev.hasChanges
                              ? `${Object.keys(ev.diff.changed).length} changed, ${Object.keys(ev.diff.added).length} added, ${ev.diff.removed.length} removed`
                              : 'No changes'
                            }
                          </span>
                        )}
                        {ev.type === 'convex' && (
                          <span className={ev.ok ? 'text-green-400' : 'text-red-400'}>
                            {ev.ok ? `Pushed ${ev.fieldsSent} fields` : `Failed: ${ev.error || 'unknown'}`}
                          </span>
                        )}
                        {ev.type === 'previous_snapshot' && (
                          <span className="text-slate-400">
                            {ev.data ? `${Object.keys(ev.data).length} fields from last scan` : 'No previous data (first run)'}
                          </span>
                        )}
                        {ev.type === 'scrape_result' && (
                          <span className="text-green-400">
                            {Object.keys(ev.data).length} fields extracted
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {output && (
                <div>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                    Output
                  </h3>
                  <pre className="text-sm bg-slate-800 border border-slate-600 rounded-lg p-3 overflow-auto max-h-[300px] whitespace-pre-wrap text-slate-200 font-mono">
                    {formatOutput(output)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function formatOutput(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}
