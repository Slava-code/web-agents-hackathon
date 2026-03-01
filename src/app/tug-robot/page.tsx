'use client'

import { useState, useEffect } from 'react'
import { updateDeviceStatus, updateDeviceFields, DEVICE_IDS, ROOM_IDS } from '@/lib/convex-api'
import { useConvexDeviceOverlay } from '@/hooks/useConvexDeviceOverlay'
import ConvexStatusBadge from '@/components/ConvexStatusBadge'

type BotStatus = 'IDLE' | 'EN_ROUTE' | 'ARRIVED' | 'RETURNING'

interface TugBot {
  id: string
  name: string
  status: BotStatus
  progress: number
  source: string
  destination: string
  battery: number
  freezeAt?: number
}

const DESTINATIONS = ['Sterilization']
const SOURCES = ['OR-1', 'OR-2', 'OR-3', 'OR-4', 'OR-5', 'OR-6']

export default function TUGDashboard() {
  const [bots, setBots] = useState<TugBot[]>([
    { id: 'TUG-01', name: 'Alpha', status: 'IDLE', progress: 0, source: 'OR-1', destination: 'Sterilization', battery: 94 },
    { id: 'TUG-02', name: 'Beta', status: 'EN_ROUTE', progress: 12, source: 'OR-3', destination: 'Sterilization', battery: 78, freezeAt: 67 },
    { id: 'TUG-03', name: 'Gamma', status: 'IDLE', progress: 0, source: 'OR-2', destination: 'Sterilization', battery: 62 },
    { id: 'TUG-04', name: 'Delta', status: 'RETURNING', progress: 35, source: 'OR-4', destination: 'Sterilization', battery: 55, freezeAt: 83 },
  ])

  const convexState = useConvexDeviceOverlay(ROOM_IDS.OR_3, "TUG Fleet Monitor")
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Simulate bot movement — bots with freezeAt slow down and stop at their cap
  useEffect(() => {
    const interval = setInterval(() => {
      setBots(prev => prev.map(bot => {
        if (bot.status !== 'EN_ROUTE' && bot.status !== 'RETURNING') return bot
        const baseIncrement = bot.status === 'EN_ROUTE' ? 2 : 3

        if (bot.freezeAt != null) {
          if (bot.progress >= bot.freezeAt) return bot
          const ratio = bot.progress / bot.freezeAt
          const increment = baseIncrement * (1 - ratio)
          if (increment < 0.1) return bot
          const newProgress = Math.min(
            parseFloat((bot.progress + increment).toFixed(1)),
            bot.freezeAt
          )
          return { ...bot, progress: newProgress }
        }

        // Normal progression (deployed bots without a freeze cap)
        const newProgress = bot.progress + baseIncrement
        if (bot.status === 'EN_ROUTE' && newProgress >= 100) {
          // Report completion to Convex (yellow border → green border)
          if (bot.id === 'TUG-01') {
            updateDeviceStatus({
              deviceId: DEVICE_IDS.TUG_ROBOT,
              status: 'ready',
              currentAction: 'Bot TUG-01 arrived at Sterilization'
            })
          }
          return { ...bot, progress: 100, status: 'ARRIVED' }
        }
        if (bot.status === 'RETURNING' && newProgress >= 100) {
          return { ...bot, progress: 0, status: 'IDLE' }
        }
        return { ...bot, progress: newProgress }
      }))
    }, 400)
    return () => clearInterval(interval)
  }, [])

  // Press Enter to deploy TUG-01 (Alpha) if it's IDLE
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const alpha = bots.find(b => b.id === 'TUG-01')
        if (alpha && alpha.status === 'IDLE') {
          deployBot('TUG-01', alpha.source)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bots])

  const deployBot = (botId: string, source: string) => {
    setBots(prev => prev.map(bot => {
      if (bot.id === botId && bot.status === 'IDLE') {
        return { ...bot, status: 'EN_ROUTE', progress: 0, source }
      }
      return bot
    }))
    // Report to Convex backend
    updateDeviceStatus({
      deviceId: DEVICE_IDS.TUG_ROBOT,
      status: 'configuring',
      currentAction: `Bot ${botId} deployed from ${source} to Sterilization`
    })
    updateDeviceFields({
      deviceId: DEVICE_IDS.TUG_ROBOT,
      fields: {
        lastDeployedBot: botId,
        lastSource: source,
        lastAction: 'deploy'
      }
    })
  }

  const returnBot = (botId: string) => {
    setBots(prev => prev.map(bot => {
      if (bot.id === botId && bot.status === 'ARRIVED') {
        return { ...bot, status: 'RETURNING', progress: 0 }
      }
      return bot
    }))
    // Report to Convex backend
    updateDeviceStatus({
      deviceId: DEVICE_IDS.TUG_ROBOT,
      status: 'configuring',
      currentAction: `Bot ${botId} returning to base`
    })
    updateDeviceFields({
      deviceId: DEVICE_IDS.TUG_ROBOT,
      fields: {
        lastReturnedBot: botId,
        lastAction: 'return'
      }
    })
  }

  const getStatusColor = (status: BotStatus) => {
    switch (status) {
      case 'IDLE': return '#6b7280'
      case 'EN_ROUTE': return '#059669'
      case 'ARRIVED': return '#2563eb'
      case 'RETURNING': return '#d97706'
    }
  }

  const getStatusBg = (status: BotStatus) => {
    switch (status) {
      case 'IDLE': return '#f3f4f6'
      case 'EN_ROUTE': return '#d1fae5'
      case 'ARRIVED': return '#dbeafe'
      case 'RETURNING': return '#fef3c7'
    }
  }

  const activeBots = bots.filter(b => b.status !== 'IDLE').length
  const totalTripsToday = 47

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>
      <ConvexStatusBadge state={convexState} />
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">TUG Fleet Monitor</h1>
                <p className="text-xs text-slate-500">OR → Sterilization Transport</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-right">
                <p className="text-slate-400 text-xs">Current Time</p>
                <p className="font-mono text-slate-700" suppressHydrationWarning>{currentTime.toLocaleTimeString()}</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-right">
                <p className="text-slate-400 text-xs">Active Units</p>
                <p className="font-semibold text-emerald-600" data-testid="active-count">{activeBots} / {bots.length}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex items-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-600">EN_ROUTE: {bots.filter(b => b.status === 'EN_ROUTE').length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-slate-600">ARRIVED: {bots.filter(b => b.status === 'ARRIVED').length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-slate-600">RETURNING: {bots.filter(b => b.status === 'RETURNING').length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-slate-600">IDLE: {bots.filter(b => b.status === 'IDLE').length}</span>
            </div>
            <div className="ml-auto text-slate-500">
              Today's Trips: <span className="font-semibold text-slate-700" data-testid="trip-count">{totalTripsToday}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <div className="col-span-1">Unit</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Source</div>
            <div className="col-span-4">Progress</div>
            <div className="col-span-1">Battery</div>
            <div className="col-span-2">Action</div>
          </div>

          {/* Bot Rows */}
          <div data-testid="bot-list">
            {bots.map((bot) => (
              <div
                key={bot.id}
                data-testid={`bot-row-${bot.id}`}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-100 last:border-0 items-center hover:bg-slate-50 transition-colors"
              >
                {/* Unit */}
                <div className="col-span-1">
                  <p className="font-semibold text-slate-900" data-testid={`bot-id-${bot.id}`}>{bot.id}</p>
                  <p className="text-xs text-slate-400">{bot.name}</p>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                    style={{ background: getStatusBg(bot.status), color: getStatusColor(bot.status) }}
                    data-testid={`bot-status-${bot.id}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: getStatusColor(bot.status) }}
                    />
                    {bot.status === 'EN_ROUTE' ? 'EN ROUTE' : bot.status}
                  </span>
                </div>

                {/* Source */}
                <div className="col-span-2">
                  <span className="font-medium text-slate-700" data-testid={`bot-source-${bot.id}`}>{bot.source}</span>
                </div>

                {/* Progress */}
                <div className="col-span-4">
                  {bot.status === 'IDLE' ? (
                    <span className="text-sm text-slate-400">—</span>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${bot.progress}%`,
                            background: getStatusColor(bot.status)
                          }}
                          data-testid={`bot-progress-${bot.id}`}
                        />
                      </div>
                      <span className="text-sm font-mono text-slate-600 w-10 text-right">{Math.round(bot.progress)}%</span>
                    </div>
                  )}
                </div>

                {/* Battery */}
                <div className="col-span-1">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span
                      className={`text-sm font-medium ${bot.battery > 50 ? 'text-emerald-600' : bot.battery > 20 ? 'text-amber-600' : 'text-red-600'}`}
                      data-testid={`bot-battery-${bot.id}`}
                    >
                      {bot.battery}%
                    </span>
                  </div>
                </div>

                {/* Action */}
                <div className="col-span-2">
                  {bot.status === 'IDLE' && (
                    <button
                      onClick={() => deployBot(bot.id, bot.source)}
                      data-testid={`deploy-btn-${bot.id}`}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
                    >
                      Deploy to Sterilization
                    </button>
                  )}
                  {bot.status === 'EN_ROUTE' && (
                    <span className="text-sm text-emerald-600 font-medium">In Transit...</span>
                  )}
                  {bot.status === 'ARRIVED' && (
                    <button
                      onClick={() => returnBot(bot.id)}
                      data-testid={`return-btn-${bot.id}`}
                      className="px-4 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                    >
                      Return
                    </button>
                  )}
                  {bot.status === 'RETURNING' && (
                    <span className="text-sm text-amber-600 font-medium">Returning...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Avg Transit Time</p>
            <p className="text-2xl font-semibold text-slate-900">3:42</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">On-Time Rate</p>
            <p className="text-2xl font-semibold text-emerald-600">98.2%</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Items Transported</p>
            <p className="text-2xl font-semibold text-slate-900">156</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Fleet Uptime</p>
            <p className="text-2xl font-semibold text-slate-900">99.9%</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <span>Aethon TUG Fleet Manager v4.1.2</span>
          <span>Memorial General Hospital • Central Sterile Services</span>
        </div>
      </footer>
    </div>
  )
}
