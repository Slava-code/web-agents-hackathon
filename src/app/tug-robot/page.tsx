'use client'

import { useState, useEffect } from 'react'

type TaskType = 'medication' | 'meals' | 'linens' | 'supplies' | 'lab'
type RobotStatus = 'idle' | 'en-route' | 'loading' | 'unloading' | 'charging' | 'error'

interface Delivery {
  id: string
  type: TaskType
  from: string
  to: string
  priority: 'stat' | 'routine' | 'scheduled'
  status: 'pending' | 'in-progress' | 'completed'
  requestedAt: string
}

export default function TUGRobotDashboard() {
  const [robotStatus, setRobotStatus] = useState<RobotStatus>('idle')
  const [battery, setBattery] = useState(78)
  const [currentLocation, setCurrentLocation] = useState('Pharmacy')
  const [destination, setDestination] = useState<string | null>(null)
  const [speed, setSpeed] = useState(0)
  const [loadWeight, setLoadWeight] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'weak' | 'offline'>('online')
  const [obstacleDetected, setObstacleDetected] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [tripCount, setTripCount] = useState(24)
  const [totalDistance, setTotalDistance] = useState(3.2)

  const [deliveryQueue, setDeliveryQueue] = useState<Delivery[]>([
    { id: 'DEL-001', type: 'medication', from: 'Pharmacy', to: 'ICU-3', priority: 'stat', status: 'pending', requestedAt: '2 min ago' },
    { id: 'DEL-002', type: 'meals', from: 'Kitchen', to: 'Floor 4 East', priority: 'scheduled', status: 'pending', requestedAt: '5 min ago' },
    { id: 'DEL-003', type: 'linens', from: 'Laundry', to: 'OR Suite', priority: 'routine', status: 'pending', requestedAt: '8 min ago' },
    { id: 'DEL-004', type: 'lab', from: 'ER-2', to: 'Laboratory', priority: 'stat', status: 'pending', requestedAt: '12 min ago' },
  ])

  const [completedTrips] = useState([
    { id: 'TRP-120', type: 'medication', from: 'Pharmacy', to: 'NICU', duration: '4:32', time: '10:45 AM' },
    { id: 'TRP-119', type: 'supplies', from: 'Central Supply', to: 'OR-2', duration: '6:15', time: '10:22 AM' },
    { id: 'TRP-118', type: 'meals', from: 'Kitchen', to: 'Floor 3 West', duration: '5:48', time: '9:58 AM' },
    { id: 'TRP-117', type: 'linens', from: 'Laundry', to: 'ICU-1', duration: '3:22', time: '9:41 AM' },
  ])

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Simulate movement when en-route
  useEffect(() => {
    if (robotStatus === 'en-route') {
      const interval = setInterval(() => {
        setSpeed(Math.random() * 0.5 + 0.8) // 0.8-1.3 m/s
        setBattery(prev => Math.max(0, prev - 0.1))
      }, 1000)
      return () => clearInterval(interval)
    } else {
      setSpeed(0)
    }
  }, [robotStatus])

  const startDelivery = (delivery: Delivery) => {
    if (robotStatus !== 'idle' || connectionStatus === 'offline') return

    setRobotStatus('loading')
    setLoadWeight(Math.floor(Math.random() * 15) + 5)

    setTimeout(() => {
      setRobotStatus('en-route')
      setDestination(delivery.to)
      setDeliveryQueue(prev => prev.map(d =>
        d.id === delivery.id ? { ...d, status: 'in-progress' } : d
      ))
    }, 2000)
  }

  const completeDelivery = () => {
    if (robotStatus !== 'en-route') return

    setRobotStatus('unloading')

    setTimeout(() => {
      const completed = deliveryQueue.find(d => d.status === 'in-progress')
      if (completed) {
        setCurrentLocation(completed.to)
        setDeliveryQueue(prev => prev.filter(d => d.id !== completed.id))
        setTripCount(prev => prev + 1)
        setTotalDistance(prev => Math.round((prev + Math.random() * 0.3 + 0.1) * 10) / 10)
      }
      setRobotStatus('idle')
      setDestination(null)
      setLoadWeight(0)
    }, 1500)
  }

  const abortDelivery = () => {
    setRobotStatus('idle')
    setDestination(null)
    setSpeed(0)
    setLoadWeight(0)
    setDeliveryQueue(prev => prev.map(d =>
      d.status === 'in-progress' ? { ...d, status: 'pending' } : d
    ))
  }

  const getStatusColor = (status: RobotStatus) => {
    switch (status) {
      case 'idle': return 'bg-slate-400'
      case 'en-route': return 'bg-blue-500 animate-pulse'
      case 'loading': return 'bg-amber-500'
      case 'unloading': return 'bg-amber-500'
      case 'charging': return 'bg-green-500'
      case 'error': return 'bg-red-500'
    }
  }

  const getTypeIcon = (type: TaskType) => {
    switch (type) {
      case 'medication': return '💊'
      case 'meals': return '🍽️'
      case 'linens': return '🛏️'
      case 'supplies': return '📦'
      case 'lab': return '🧪'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'stat': return 'bg-red-100 text-red-700 border-red-200'
      case 'routine': return 'bg-slate-100 text-slate-700 border-slate-200'
      case 'scheduled': return 'bg-blue-100 text-blue-700 border-blue-200'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-white" style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Header */}
      <header className="bg-[#1a2332] border-b border-slate-700/50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Aethon TUG</h1>
              <p className="text-xs text-slate-400">Autonomous Mobile Robot • Unit T-4721</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connectionStatus === 'online' ? 'bg-green-400' : connectionStatus === 'weak' ? 'bg-amber-400' : 'bg-red-400'}`} />
              <select
                value={connectionStatus}
                onChange={(e) => setConnectionStatus(e.target.value as typeof connectionStatus)}
                data-testid="connection-select"
                className="bg-transparent text-sm text-slate-300 border-none focus:outline-none cursor-pointer"
              >
                <option value="online" className="bg-slate-800">Online</option>
                <option value="weak" className="bg-slate-800">Weak Signal</option>
                <option value="offline" className="bg-slate-800">Offline</option>
              </select>
            </div>
            <div className="text-sm text-slate-400 font-mono">
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Robot Status */}
          <div className="col-span-4 space-y-6">
            {/* Status Card */}
            <div className="bg-[#1a2332] rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700/50">
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Robot Status</h2>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-4 h-4 rounded-full ${getStatusColor(robotStatus)}`} />
                  <span className="text-2xl font-semibold capitalize" data-testid="robot-status">{robotStatus.replace('-', ' ')}</span>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Current Location</span>
                    <span className="font-medium" data-testid="current-location">{currentLocation}</span>
                  </div>
                  {destination && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Destination</span>
                      <span className="font-medium text-blue-400" data-testid="destination">{destination}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Speed</span>
                    <span className="font-mono" data-testid="speed">{speed.toFixed(1)} m/s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Load Weight</span>
                    <span className="font-mono" data-testid="load-weight">{loadWeight} kg</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Battery Card */}
            <div className="bg-[#1a2332] rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700/50">
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Battery</h2>
              </div>
              <div className="p-5">
                <div className="flex items-end gap-3 mb-4">
                  <span className="text-4xl font-bold" data-testid="battery-level">{Math.round(battery)}</span>
                  <span className="text-slate-400 text-xl mb-1">%</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${battery > 50 ? 'bg-green-500' : battery > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${battery}%` }}
                    data-testid="battery-bar"
                  />
                </div>
                <div className="flex justify-between mt-3 text-xs text-slate-500">
                  <span>Est. Range: {Math.round(battery * 0.15)} trips</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={battery}
                    onChange={(e) => setBattery(Number(e.target.value))}
                    data-testid="battery-slider"
                    className="w-24 accent-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Today's Stats */}
            <div className="bg-[#1a2332] rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700/50">
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Today's Stats</h2>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-3xl font-bold text-blue-400" data-testid="trip-count">{tripCount}</p>
                  <p className="text-xs text-slate-500 mt-1">Trips Completed</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-400" data-testid="total-distance">{totalDistance}</p>
                  <p className="text-xs text-slate-500 mt-1">km Traveled</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-amber-400">4:12</p>
                  <p className="text-xs text-slate-500 mt-1">Avg Trip Time</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-purple-400">98%</p>
                  <p className="text-xs text-slate-500 mt-1">On-Time Rate</p>
                </div>
              </div>
            </div>

            {/* Obstacle Detection */}
            <div className="bg-[#1a2332] rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Sensors</h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-slate-500">Simulate Obstacle</span>
                  <input
                    type="checkbox"
                    checked={obstacleDetected}
                    onChange={(e) => setObstacleDetected(e.target.checked)}
                    data-testid="obstacle-toggle"
                    className="w-4 h-4 accent-red-500"
                  />
                </label>
              </div>
              <div className="p-5">
                <div className={`flex items-center gap-3 p-3 rounded-lg ${obstacleDetected ? 'bg-red-500/10 border border-red-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                  <span className={`w-3 h-3 rounded-full ${obstacleDetected ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                  <span className={obstacleDetected ? 'text-red-400' : 'text-green-400'} data-testid="obstacle-status">
                    {obstacleDetected ? 'Obstacle Detected - Stopped' : 'Path Clear'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Delivery Queue & Controls */}
          <div className="col-span-8 space-y-6">
            {/* Controls */}
            <div className="bg-[#1a2332] rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700/50">
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Controls</h2>
              </div>
              <div className="p-5 flex gap-4">
                <button
                  onClick={completeDelivery}
                  disabled={robotStatus !== 'en-route'}
                  data-testid="complete-btn"
                  className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
                >
                  Complete Delivery
                </button>
                <button
                  onClick={abortDelivery}
                  disabled={robotStatus === 'idle'}
                  data-testid="abort-btn"
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
                >
                  Abort & Return
                </button>
                <button
                  onClick={() => setRobotStatus('charging')}
                  disabled={robotStatus !== 'idle'}
                  data-testid="charge-btn"
                  className="flex-1 py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
                >
                  Send to Charger
                </button>
              </div>
            </div>

            {/* Delivery Queue */}
            <div className="bg-[#1a2332] rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Delivery Queue</h2>
                <span className="text-xs text-slate-500">{deliveryQueue.length} pending</span>
              </div>
              <div className="divide-y divide-slate-700/50" data-testid="delivery-queue">
                {deliveryQueue.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No pending deliveries</div>
                ) : (
                  deliveryQueue.map((delivery) => (
                    <div
                      key={delivery.id}
                      data-testid={`delivery-${delivery.id}`}
                      className={`p-4 flex items-center justify-between ${delivery.status === 'in-progress' ? 'bg-blue-500/5' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{getTypeIcon(delivery.type)}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{delivery.from}</span>
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                            <span className="font-medium">{delivery.to}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">{delivery.id}</span>
                            <span className={`text-xs px-2 py-0.5 rounded border ${getPriorityColor(delivery.priority)}`}>
                              {delivery.priority.toUpperCase()}
                            </span>
                            <span className="text-xs text-slate-500">{delivery.requestedAt}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {delivery.status === 'in-progress' ? (
                          <span className="text-blue-400 text-sm flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                            In Transit
                          </span>
                        ) : (
                          <button
                            onClick={() => startDelivery(delivery)}
                            disabled={robotStatus !== 'idle' || connectionStatus === 'offline'}
                            data-testid={`start-${delivery.id}`}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors"
                          >
                            Start
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Trips */}
            <div className="bg-[#1a2332] rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700/50">
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Recent Trips</h2>
              </div>
              <table className="w-full text-sm" data-testid="trips-table">
                <thead className="bg-slate-800/50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left">Trip ID</th>
                    <th className="px-5 py-3 text-left">Type</th>
                    <th className="px-5 py-3 text-left">Route</th>
                    <th className="px-5 py-3 text-right">Duration</th>
                    <th className="px-5 py-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {completedTrips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-slate-800/30" data-testid={`trip-${trip.id}`}>
                      <td className="px-5 py-3 font-mono text-slate-400">{trip.id}</td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2">
                          {getTypeIcon(trip.type as TaskType)}
                          <span className="capitalize">{trip.type}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-300">{trip.from} → {trip.to}</td>
                      <td className="px-5 py-3 text-right font-mono">{trip.duration}</td>
                      <td className="px-5 py-3 text-right text-slate-400">{trip.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a2332] border-t border-slate-700/50 px-6 py-3 mt-6">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Aethon TUG Fleet Manager v3.2.1</span>
          <span>Last sync: {currentTime.toLocaleTimeString()}</span>
          <span>Memorial General Hospital</span>
        </div>
      </footer>
    </div>
  )
}
