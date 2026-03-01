'use client'

import { useState, useEffect } from 'react'
import { updateDeviceStatus, updateDeviceFields, DEVICE_IDS, ROOM_IDS } from '@/lib/convex-api'
import { useConvexDeviceOverlay } from '@/hooks/useConvexDeviceOverlay'
import ConvexStatusBadge from '@/components/ConvexStatusBadge'

interface Sensor {
  id: string
  name: string
  location: string
  type: string
  status: 'online' | 'offline' | 'warning'
  particulate: number
  temperature: number
  humidity: number
  co2: number
  lastSeen: string
  firmware: string
  riskLevel: 'low' | 'medium' | 'high'
}

interface Alert {
  id: number
  type: 'critical' | 'warning' | 'info'
  message: string
  sensor: string
  time: string
  acknowledged: boolean
}

export default function EnvironmentalMonitoring() {
  const [sensors, setSensors] = useState<Sensor[]>([
    { id: 'ENV-001', name: 'OR-1 Main', location: 'Operating Room 1', type: 'Air Quality', status: 'online', particulate: 42, temperature: 68.5, humidity: 45, co2: 620, lastSeen: '< 1 min', firmware: 'v2.4.1', riskLevel: 'low' },
    { id: 'ENV-002', name: 'OR-2 Main', location: 'Operating Room 2', type: 'Air Quality', status: 'online', particulate: 55, temperature: 69.1, humidity: 48, co2: 580, lastSeen: '< 1 min', firmware: 'v2.4.1', riskLevel: 'low' },
    { id: 'ENV-003', name: 'OR-3 Main', location: 'Operating Room 3', type: 'Air Quality', status: 'warning', particulate: 95, temperature: 71.2, humidity: 52, co2: 750, lastSeen: '2 min', firmware: 'v2.3.0', riskLevel: 'high' },
    { id: 'ENV-004', name: 'PACU Sensor', location: 'Post-Anesthesia Care', type: 'Air Quality', status: 'online', particulate: 35, temperature: 70.0, humidity: 42, co2: 540, lastSeen: '< 1 min', firmware: 'v2.4.1', riskLevel: 'low' },
    { id: 'ENV-005', name: 'Pre-Op Area', location: 'Pre-Operative Hold', type: 'Air Quality', status: 'offline', particulate: 0, temperature: 0, humidity: 0, co2: 0, lastSeen: '15 min', firmware: 'v2.2.0', riskLevel: 'medium' },
    { id: 'ENV-006', name: 'ICU Zone A', location: 'Intensive Care Unit', type: 'Air Quality', status: 'online', particulate: 28, temperature: 69.5, humidity: 44, co2: 510, lastSeen: '< 1 min', firmware: 'v2.4.1', riskLevel: 'low' },
    { id: 'ENV-007', name: 'ICU Zone B', location: 'Intensive Care Unit', type: 'Temperature', status: 'online', particulate: 31, temperature: 68.8, humidity: 43, co2: 525, lastSeen: '< 1 min', firmware: 'v2.4.0', riskLevel: 'low' },
    { id: 'ENV-008', name: 'Pharmacy', location: 'Pharmacy Storage', type: 'Temperature', status: 'online', particulate: 22, temperature: 65.2, humidity: 38, co2: 480, lastSeen: '< 1 min', firmware: 'v2.4.1', riskLevel: 'low' },
  ])

  const [alerts, setAlerts] = useState<Alert[]>([
    { id: 1, type: 'critical', message: 'Particulate count exceeds threshold', sensor: 'ENV-003', time: '2 min ago', acknowledged: false },
    { id: 2, type: 'warning', message: 'CO2 levels elevated', sensor: 'ENV-003', time: '5 min ago', acknowledged: false },
    { id: 3, type: 'info', message: 'Sensor offline - connection lost', sensor: 'ENV-005', time: '15 min ago', acknowledged: true },
    { id: 4, type: 'warning', message: 'Firmware update available', sensor: 'ENV-003', time: '1 hr ago', acknowledged: true },
  ])

  const [selectedSite, setSelectedSite] = useState('all')
  const [timeRange, setTimeRange] = useState('24h')
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'sensors' | 'alerts' | 'settings'>('overview')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [thresholds, setThresholds] = useState({
    particulate: 100,
    co2: 700,
    tempMin: 65,
    tempMax: 72
  })
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Convex real-time overlay
  const convexState = useConvexDeviceOverlay(ROOM_IDS.OR_3, "Environmental Monitoring")

  // Sync Convex fields → local sensor state for ENV-003 (OR-3 Main)
  useEffect(() => {
    if (convexState.isLoading || convexState.status === 'idle') return
    const f = convexState.fields
    if (!f.co2 && !f.particulate && !f.temperature) return

    setSensors(prev => prev.map(sensor => {
      if (sensor.id !== 'ENV-003') return sensor
      return {
        ...sensor,
        co2: typeof f.co2 === 'number' ? f.co2 : sensor.co2,
        particulate: typeof f.particulate === 'number' ? f.particulate : sensor.particulate,
        temperature: typeof f.temperature === 'number' ? f.temperature : sensor.temperature,
        humidity: typeof f.humidity === 'number' ? f.humidity : sensor.humidity,
        riskLevel: (f.riskLevel === 'critical' || f.riskLevel === 'high') ? 'high' : f.riskLevel === 'medium' ? 'medium' : sensor.riskLevel,
        status: convexState.status === 'error' ? 'warning' : sensor.status,
      }
    }))

    // Inject a critical alert when Convex reports anomaly
    if (convexState.status === 'error' && convexState.currentAction) {
      setAlerts(prev => {
        const exists = prev.some(a => a.message === convexState.currentAction)
        if (exists) return prev
        return [
          {
            id: Date.now(),
            type: 'critical' as const,
            message: convexState.currentAction!,
            sensor: 'ENV-003',
            time: 'just now',
            acknowledged: false,
          },
          ...prev,
        ]
      })
    }
  }, [convexState.status, convexState.fields, convexState.isLoading, convexState.currentAction])

  // Stats
  const totalSensors = sensors.length
  const onlineSensors = sensors.filter(s => s.status === 'online').length
  const offlineSensors = sensors.filter(s => s.status === 'offline').length
  const warningSensors = sensors.filter(s => s.status === 'warning').length
  const highRiskSensors = sensors.filter(s => s.riskLevel === 'high').length
  const activeAlerts = alerts.filter(a => !a.acknowledged).length

  // Sensor categories
  const sensorsByType = sensors.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Utilization data
  const utilizationData = [
    { category: 'Air Quality', inUse: 75, online: 20, offline: 5 },
    { category: 'Temperature', inUse: 85, online: 15, offline: 0 },
    { category: 'Humidity', inUse: 60, online: 30, offline: 10 },
    { category: 'CO2 Monitor', inUse: 70, online: 25, offline: 5 },
  ]

  useEffect(() => {
    setCurrentTime(new Date())
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Simulate sensor updates (skip ENV-003 when Convex is actively controlling it)
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      setSensors(prev => prev.map(sensor => {
        if (sensor.status === 'offline') return sensor
        // Guard: don't jitter ENV-003 when Convex has an active anomaly state
        if (sensor.id === 'ENV-003' && convexState.status !== 'idle') return sensor
        return {
          ...sensor,
          particulate: Math.max(0, Math.min(150, sensor.particulate + Math.floor((Math.random() - 0.5) * 10))),
          temperature: Math.round((sensor.temperature + (Math.random() - 0.5) * 0.5) * 10) / 10,
          humidity: Math.max(20, Math.min(80, sensor.humidity + Math.floor((Math.random() - 0.5) * 3))),
          co2: Math.max(400, Math.min(1000, sensor.co2 + Math.floor((Math.random() - 0.5) * 30))),
        }
      }))
    }, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, convexState.status])

  const acknowledgeAlert = (id: number) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a))
    // Report to Convex backend
    updateDeviceFields({
      deviceId: DEVICE_IDS.ENV_MONITORING,
      fields: {
        lastAcknowledgedAlert: id,
        lastAction: 'acknowledge_alert'
      }
    })
  }

  const dismissAlert = (id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
    // Report to Convex backend
    updateDeviceFields({
      deviceId: DEVICE_IDS.ENV_MONITORING,
      fields: {
        lastDismissedAlert: id,
        lastAction: 'dismiss_alert'
      }
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-emerald-500'
      case 'warning': return 'bg-amber-500'
      case 'offline': return 'bg-red-500'
      default: return 'bg-gray-400'
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-emerald-600 bg-emerald-50'
      case 'medium': return 'text-amber-600 bg-amber-50'
      case 'high': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f6fa]" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <ConvexStatusBadge state={convexState} />
      {/* Top Navigation Bar */}
      <header className="bg-[#1a1f36] text-white">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded flex items-center justify-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">EnviroSense</h1>
                <p className="text-[10px] text-cyan-300 uppercase tracking-wider">IoT Security</p>
              </div>
            </div>
            <nav className="flex items-center gap-1 ml-8">
              {(['overview', 'sensors', 'alerts', 'settings'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  data-testid={`tab-${tab}`}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
                    activeTab === tab
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/60">Auto-refresh</span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                data-testid="auto-refresh-toggle"
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  autoRefresh ? 'bg-cyan-500' : 'bg-white/20'
                }`}
              >
                <span className={`absolute w-4 h-4 bg-white rounded-full top-0.5 transition-transform shadow ${
                  autoRefresh ? 'left-5' : 'left-0.5'
                }`} />
              </button>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <span className="text-sm text-white/80 font-mono">
              {currentTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) ?? '--:--'}
            </span>
          </div>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Site</label>
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                data-testid="site-filter"
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="all">All Sites</option>
                <option value="main">Main Building</option>
                <option value="east">East Wing</option>
                <option value="west">West Wing</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Time Range</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                data-testid="time-range-filter"
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="1h">Last 1 Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const data = JSON.stringify({ sensors, alerts, thresholds }, null, 2)
                const blob = new Blob([data], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `envirosense-export-${new Date().toISOString().split('T')[0]}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
              data-testid="export-btn"
              className="px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Export
            </button>
            <button
              onClick={() => {
                setSensors(prev => prev.map(sensor => {
                  if (sensor.status === 'offline') return sensor
                  return {
                    ...sensor,
                    particulate: Math.max(0, Math.min(150, sensor.particulate + Math.floor((Math.random() - 0.5) * 10))),
                    temperature: Math.round((sensor.temperature + (Math.random() - 0.5) * 0.5) * 10) / 10,
                    humidity: Math.max(20, Math.min(80, sensor.humidity + Math.floor((Math.random() - 0.5) * 3))),
                    co2: Math.max(400, Math.min(1000, sensor.co2 + Math.floor((Math.random() - 0.5) * 30))),
                  }
                }))
              }}
              data-testid="refresh-btn"
              className="px-4 py-1.5 text-sm font-medium text-white bg-cyan-600 rounded-md hover:bg-cyan-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {alerts.filter(a => !a.acknowledged && a.type === 'critical').length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2" data-testid="alert-banner">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-red-800">
                {alerts.filter(a => !a.acknowledged && a.type === 'critical').length} critical alert(s) require attention
              </span>
            </div>
            <button
              onClick={() => alerts.filter(a => a.type === 'critical').forEach(a => acknowledgeAlert(a.id))}
              data-testid="acknowledge-all-btn"
              className="text-xs font-medium text-red-700 hover:text-red-900 underline"
            >
              Acknowledge All
            </button>
          </div>
        </div>
      )}

      <main className="p-6">
        {/* Summary Stats Cards */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm" data-testid="stat-total-sensors">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Sensors</p>
            <p className="text-3xl font-semibold text-gray-900">{totalSensors}</p>
            <p className="text-xs text-gray-400 mt-1">Monitored devices</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm" data-testid="stat-online">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Online</p>
            <p className="text-3xl font-semibold text-emerald-600">{onlineSensors}</p>
            <p className="text-xs text-emerald-500 mt-1">Active & reporting</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm" data-testid="stat-warning">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Warning</p>
            <p className="text-3xl font-semibold text-amber-600">{warningSensors}</p>
            <p className="text-xs text-amber-500 mt-1">Needs attention</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm" data-testid="stat-offline">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Offline</p>
            <p className="text-3xl font-semibold text-red-600">{offlineSensors}</p>
            <p className="text-xs text-red-500 mt-1">Not responding</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm" data-testid="stat-high-risk">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">High Risk</p>
            <p className="text-3xl font-semibold text-red-600">{highRiskSensors}</p>
            <p className="text-xs text-red-500 mt-1">Elevated readings</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm" data-testid="stat-active-alerts">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Active Alerts</p>
            <p className="text-3xl font-semibold text-cyan-600">{activeAlerts}</p>
            <p className="text-xs text-cyan-500 mt-1">Unacknowledged</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Categories & Utilization */}
          <div className="col-span-4 space-y-6">
            {/* Top Sensor Categories */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Top Sensor Categories</h3>
              </div>
              <div className="p-4" data-testid="sensor-categories">
                {Object.entries(sensorsByType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count], i) => (
                    <div key={type} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-gray-400 w-4">{i + 1}</span>
                        <span className="text-sm text-gray-700">{type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${(count / totalSensors) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Sensor Utilization */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Sensor Utilization</h3>
              </div>
              <div className="p-4 space-y-4" data-testid="sensor-utilization">
                {utilizationData.map((item) => (
                  <div key={item.category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{item.category}</span>
                      <span className="text-xs text-gray-500">{item.inUse}% active</span>
                    </div>
                    <div className="h-4 flex rounded overflow-hidden">
                      <div
                        className="bg-cyan-500 transition-all"
                        style={{ width: `${item.inUse}%` }}
                        title={`In Use: ${item.inUse}%`}
                      />
                      <div
                        className="bg-cyan-200 transition-all"
                        style={{ width: `${item.online}%` }}
                        title={`Online: ${item.online}%`}
                      />
                      <div
                        className="bg-gray-200 transition-all"
                        style={{ width: `${item.offline}%` }}
                        title={`Offline: ${item.offline}%`}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 pt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-cyan-500 rounded" />
                    <span className="text-gray-600">In Use</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-cyan-200 rounded" />
                    <span className="text-gray-600">Online</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-gray-200 rounded" />
                    <span className="text-gray-600">Offline</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Summary */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Risk Assessment</h3>
              </div>
              <div className="p-4" data-testid="risk-assessment">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Outdated Firmware</span>
                    <span className="text-sm font-medium text-amber-600">2 sensors</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Threshold Violations</span>
                    <span className="text-sm font-medium text-red-600">1 sensor</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Connection Issues</span>
                    <span className="text-sm font-medium text-amber-600">1 sensor</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Sensor List & Alerts */}
          <div className="col-span-8 space-y-6">
            {/* Sensor Inventory */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Sensor Inventory</h3>
                <span className="text-xs text-gray-500">{sensors.length} devices</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="sensor-table">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Sensor ID</th>
                      <th className="px-4 py-3 text-left font-medium">Location</th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-right font-medium">PM2.5</th>
                      <th className="px-4 py-3 text-right font-medium">Temp</th>
                      <th className="px-4 py-3 text-right font-medium">CO2</th>
                      <th className="px-4 py-3 text-left font-medium">Risk</th>
                      <th className="px-4 py-3 text-left font-medium">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sensors.map((sensor) => (
                      <tr
                        key={sensor.id}
                        onClick={() => setSelectedSensor(selectedSensor === sensor.id ? null : sensor.id)}
                        data-testid={`sensor-row-${sensor.id}`}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          selectedSensor === sensor.id ? 'bg-cyan-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className={`w-2.5 h-2.5 rounded-full inline-block ${getStatusColor(sensor.status)}`} />
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-900">{sensor.id}</td>
                        <td className="px-4 py-3 text-gray-600">{sensor.location}</td>
                        <td className="px-4 py-3 text-gray-600">{sensor.type}</td>
                        <td className={`px-4 py-3 text-right font-mono ${
                          sensor.particulate > 80 ? 'text-red-600 font-medium' :
                          sensor.particulate > 50 ? 'text-amber-600' : 'text-gray-900'
                        }`}>
                          {sensor.status === 'offline' ? '—' : sensor.particulate}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${
                          sensor.temperature > 72 ? 'text-red-600 font-medium' : 'text-gray-900'
                        }`}>
                          {sensor.status === 'offline' ? '—' : `${sensor.temperature}°F`}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${
                          sensor.co2 > 700 ? 'text-red-600 font-medium' :
                          sensor.co2 > 600 ? 'text-amber-600' : 'text-gray-900'
                        }`}>
                          {sensor.status === 'offline' ? '—' : sensor.co2}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getRiskColor(sensor.riskLevel)}`}>
                            {sensor.riskLevel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{sensor.lastSeen}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Alerts */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Active Alerts</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })))}
                    data-testid="ack-all-alerts-btn"
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Acknowledge All
                  </button>
                  <button
                    onClick={() => setAlerts(prev => prev.filter(a => !a.acknowledged))}
                    data-testid="clear-ack-alerts-btn"
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear Acknowledged
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-100" data-testid="alerts-list">
                {alerts.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">No active alerts</div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      data-testid={`alert-${alert.id}`}
                      className={`px-4 py-3 flex items-center justify-between ${
                        alert.acknowledged ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${
                          alert.type === 'critical' ? 'bg-red-500' :
                          alert.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        <div>
                          <p className="text-sm text-gray-900">{alert.message}</p>
                          <p className="text-xs text-gray-500">{alert.sensor} · {alert.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!alert.acknowledged && (
                          <button
                            onClick={() => acknowledgeAlert(alert.id)}
                            data-testid={`ack-alert-${alert.id}`}
                            className="px-3 py-1 text-xs font-medium text-cyan-700 bg-cyan-50 rounded hover:bg-cyan-100 transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => dismissAlert(alert.id)}
                          data-testid={`dismiss-alert-${alert.id}`}
                          className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Threshold Settings */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Threshold Configuration</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Particulate (PM2.5)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={thresholds.particulate}
                        onChange={(e) => setThresholds(prev => ({ ...prev, particulate: Number(e.target.value) }))}
                        data-testid="threshold-particulate"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                      <span className="text-xs text-gray-400">μg/m³</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      CO2 Level
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={thresholds.co2}
                        onChange={(e) => setThresholds(prev => ({ ...prev, co2: Number(e.target.value) }))}
                        data-testid="threshold-co2"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                      <span className="text-xs text-gray-400">ppm</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Temperature Min
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={thresholds.tempMin}
                        onChange={(e) => setThresholds(prev => ({ ...prev, tempMin: Number(e.target.value) }))}
                        data-testid="threshold-temp-min"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                      <span className="text-xs text-gray-400">°F</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Temperature Max
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={thresholds.tempMax}
                        onChange={(e) => setThresholds(prev => ({ ...prev, tempMax: Number(e.target.value) }))}
                        data-testid="threshold-temp-max"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                      <span className="text-xs text-gray-400">°F</span>
                    </div>
                  </div>
                </div>
                {lastSaved && (
                  <p className="text-xs text-emerald-600 mt-2" data-testid="save-confirmation">
                    Settings saved at {lastSaved.toLocaleTimeString()}
                  </p>
                )}
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setThresholds({ particulate: 100, co2: 700, tempMin: 65, tempMax: 72 })}
                    data-testid="reset-thresholds-btn"
                    className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Reset Defaults
                  </button>
                  <button
                    onClick={() => {
                      setLastSaved(new Date())
                      // Report to Convex backend
                      updateDeviceStatus({
                        deviceId: DEVICE_IDS.ENV_MONITORING,
                        status: 'ready',
                        currentAction: 'Thresholds updated'
                      })
                      updateDeviceFields({
                        deviceId: DEVICE_IDS.ENV_MONITORING,
                        fields: {
                          thresholds: thresholds,
                          lastAction: 'save_thresholds'
                        }
                      })
                    }}
                    data-testid="save-thresholds-btn"
                    className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-md hover:bg-cyan-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3 mt-6">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>EnviroSense IoT Security v2.4.1</span>
          <span>Last sync: {currentTime?.toLocaleTimeString() ?? '--:--:--'}</span>
          <span>Memorial General Hospital</span>
        </div>
      </footer>
    </div>
  )
}
