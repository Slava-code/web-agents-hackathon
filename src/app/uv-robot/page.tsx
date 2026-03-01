'use client'

import { useState, useEffect } from 'react'

export default function UVRobotPortal() {
  const [selectedRoom, setSelectedRoom] = useState('OR-1')
  const [cycleActive, setCycleActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const [cycleHistory, setCycleHistory] = useState([
    { id: 'CYC-2847', room: 'OR-3', duration: '12:34', status: 'Complete', timestamp: '14:22' },
    { id: 'CYC-2846', room: 'OR-1', duration: '11:58', status: 'Complete', timestamp: '13:45' },
    { id: 'CYC-2845', room: 'OR-2', duration: '12:01', status: 'Complete', timestamp: '12:30' },
    { id: 'CYC-2844', room: 'OR-4', duration: '13:22', status: 'Aborted', timestamp: '11:15' },
  ])
  const [batteryLevel, setBatteryLevel] = useState(87)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'weak' | 'disconnected'>('connected')
  const [deviceHealth, setDeviceHealth] = useState<'optimal' | 'warning' | 'critical'>('optimal')
  const [intensity, setIntensity] = useState(85)
  const [mode, setMode] = useState<'standard' | 'high' | 'terminal'>('standard')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lampHours, setLampHours] = useState(1247)

  const rooms = ['OR-1', 'OR-2', 'OR-3', 'OR-4', 'OR-5', 'PACU-1', 'PACU-2', 'Pre-Op-1']

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (cycleActive && progress < 100) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setCycleActive(false)
            setCycleHistory((h) => [
              {
                id: `CYC-${2848 + h.length}`,
                room: selectedRoom,
                duration: '12:00',
                status: 'Complete',
                timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
              },
              ...h,
            ])
            return 0
          }
          return prev + 2
        })
      }, 300)
    }
    return () => clearInterval(interval)
  }, [cycleActive, progress, selectedRoom])

  const handleStartCycle = () => {
    if (!cycleActive && connectionStatus === 'connected') {
      setCycleActive(true)
      setProgress(0)
    }
  }

  const handleAbortCycle = () => {
    setCycleActive(false)
    const currentProgress = progress
    setProgress(0)
    setCycleHistory((h) => [
      {
        id: `CYC-${2848 + h.length}`,
        room: selectedRoom,
        duration: `${Math.floor(currentProgress / 8)}:${(currentProgress % 60).toString().padStart(2, '0')}`,
        status: 'Aborted',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      },
      ...h,
    ])
  }

  const handleEmergencyStop = () => {
    if (cycleActive) {
      handleAbortCycle()
      alert('EMERGENCY STOP ACTIVATED\n\nCycle terminated. Verify room is clear.')
    }
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');

        :root {
          --white: #FEFEFE;
          --off-white: #F8F7F4;
          --cream: #F2F0EB;
          --warm-gray: #E8E6E1;
          --mid-gray: #9A9890;
          --dark-gray: #3D3D3A;
          --black: #1A1A18;
          --accent: #0D9488;
          --accent-light: #CCFBF1;
          --danger: #DC2626;
          --danger-light: #FEE2E2;
        }

        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .font-serif { font-family: 'Instrument Serif', Georgia, serif; }
        .font-mono { font-family: 'DM Mono', 'SF Mono', monospace; }
        .font-sans { font-family: 'DM Sans', system-ui, sans-serif; }

        @keyframes progress-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        @keyframes subtle-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        .glow-active {
          animation: progress-glow 2s ease-in-out infinite;
        }

        .hairline {
          border-width: 0.5px;
        }

        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
          height: 24px;
        }

        input[type="range"]::-webkit-slider-runnable-track {
          height: 6px;
          background: var(--cream);
          border-radius: 3px;
          border: 1px solid var(--warm-gray);
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent);
          margin-top: -6px;
          border: 2px solid var(--white);
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
          transition: transform 0.1s ease;
        }

        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        input[type="range"]::-moz-range-track {
          height: 6px;
          background: var(--cream);
          border-radius: 3px;
          border: 1px solid var(--warm-gray);
        }

        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent);
          border: 2px solid var(--white);
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }

        input[type="range"]::-moz-range-thumb:hover {
          transform: scale(1.1);
        }

        select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239A9890' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 32px;
        }
      `}</style>

      <div className="min-h-screen bg-[var(--white)] font-sans text-[var(--black)]">
        {/* Minimal Header */}
        <header className="border-b hairline border-[var(--warm-gray)] bg-[var(--white)]">
          <div className="max-w-[1600px] mx-auto px-8 py-6 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--mid-gray)] mb-1">UV-C Disinfection System</p>
              <h1 className="font-serif text-3xl text-[var(--black)]">UltraClean</h1>
            </div>
            <div className="flex items-center gap-12">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--mid-gray)]">Device</p>
                <p className="font-mono text-sm">UVC-2019-4721</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--mid-gray)]">Time</p>
                <p className="font-mono text-sm">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-[var(--accent)]' :
                  connectionStatus === 'weak' ? 'bg-amber-400' : 'bg-[var(--danger)]'
                }`} />
                <span className="text-xs text-[var(--mid-gray)]">
                  {connectionStatus === 'connected' ? 'Online' : connectionStatus === 'weak' ? 'Weak' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-8 py-12">
          <div className="grid grid-cols-12 gap-16">

            {/* Left Column — Controls */}
            <div className="col-span-3 space-y-12">

              {/* Room Selection */}
              <section>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-[var(--mid-gray)] mb-3">
                  Target Room
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  disabled={cycleActive}
                  data-testid="room-selector"
                  className="w-full appearance-none bg-[var(--white)] border hairline border-[var(--warm-gray)] px-4 py-3 text-lg font-mono focus:outline-none focus:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {rooms.map((room) => (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </select>
              </section>

              {/* Cycle Mode */}
              <section>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-[var(--mid-gray)] mb-4">
                  Cycle Mode
                </label>
                <div className="space-y-2">
                  {(['standard', 'high', 'terminal'] as const).map((m) => (
                    <label
                      key={m}
                      className={`flex items-center justify-between p-4 border hairline cursor-pointer transition-all ${
                        mode === m
                          ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                          : 'border-[var(--warm-gray)] hover:border-[var(--mid-gray)]'
                      } ${cycleActive ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="cycleMode"
                          value={m}
                          checked={mode === m}
                          onChange={() => setMode(m)}
                          disabled={cycleActive}
                          data-testid={`mode-${m}`}
                          className="sr-only"
                        />
                        <div className={`w-3 h-3 rounded-full border-2 ${
                          mode === m ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--mid-gray)]'
                        }`}>
                          {mode === m && <div className="w-full h-full rounded-full bg-[var(--white)] scale-[0.4]" />}
                        </div>
                        <span className="capitalize text-sm">{m}</span>
                      </div>
                      <span className="font-mono text-xs text-[var(--mid-gray)]">
                        {m === 'standard' ? '12m' : m === 'high' ? '18m' : '25m'}
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              {/* Intensity */}
              <section>
                <div className="flex items-baseline justify-between mb-4">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-[var(--mid-gray)]">
                    UV-C Intensity
                  </label>
                  <span className="font-mono text-2xl" data-testid="intensity-value">{intensity}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={intensity}
                  onChange={(e) => setIntensity(parseInt(e.target.value))}
                  disabled={cycleActive}
                  data-testid="intensity-slider"
                  className="w-full"
                />
                <div className="flex justify-between mt-2 text-[10px] text-[var(--mid-gray)] font-mono">
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </section>

              {/* Device Status */}
              <section className="pt-8 border-t hairline border-[var(--warm-gray)]">
                <label className="block text-[10px] uppercase tracking-[0.2em] text-[var(--mid-gray)] mb-4">
                  Device Status
                </label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--mid-gray)]">Battery</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1 bg-[var(--warm-gray)]">
                        <div
                          className={`h-full transition-all ${
                            batteryLevel > 50 ? 'bg-[var(--accent)]' :
                            batteryLevel > 20 ? 'bg-amber-400' : 'bg-[var(--danger)]'
                          }`}
                          style={{ width: `${batteryLevel}%` }}
                          data-testid="battery-level-bar"
                        />
                      </div>
                      <span className="font-mono text-xs w-8" data-testid="battery-level-text">{batteryLevel}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--mid-gray)]">Health</span>
                    <select
                      value={deviceHealth}
                      onChange={(e) => setDeviceHealth(e.target.value as any)}
                      data-testid="device-health-select"
                      className="appearance-none bg-transparent text-xs font-mono text-right pr-4 focus:outline-none cursor-pointer"
                    >
                      <option value="optimal">Optimal</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--mid-gray)]">Lamp Hours</span>
                    <span className="font-mono text-xs" data-testid="lamp-hours">{lampHours}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--mid-gray)]">Connection</span>
                    <select
                      value={connectionStatus}
                      onChange={(e) => setConnectionStatus(e.target.value as any)}
                      data-testid="connection-status-select"
                      className="appearance-none bg-transparent text-xs font-mono text-right pr-4 focus:outline-none cursor-pointer"
                    >
                      <option value="connected">Connected</option>
                      <option value="weak">Weak Signal</option>
                      <option value="disconnected">Disconnected</option>
                    </select>
                  </div>
                </div>

                {/* Battery Simulation */}
                <div className="mt-6">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={batteryLevel}
                    onChange={(e) => setBatteryLevel(parseInt(e.target.value))}
                    data-testid="battery-slider"
                    className="w-full"
                  />
                  <p className="text-[9px] text-[var(--mid-gray)] mt-1 uppercase tracking-wider">Simulate Battery</p>
                </div>
              </section>
            </div>

            {/* Center Column — Progress Display */}
            <div className="col-span-5 flex flex-col items-center justify-center min-h-[600px]">

              {/* Giant Progress Number */}
              <div className="text-center mb-12">
                <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--mid-gray)] mb-4">
                  {cycleActive ? 'Cycle Progress' : 'Ready'}
                </p>
                <div className={`font-mono text-[180px] leading-none tracking-tighter ${
                  cycleActive ? 'text-[var(--accent)] glow-active' : 'text-[var(--warm-gray)]'
                }`} data-testid="progress-value">
                  {progress.toString().padStart(2, '0')}
                </div>
                <p className="font-serif italic text-2xl text-[var(--mid-gray)] mt-2" data-testid="cycle-status">
                  {cycleActive ? 'disinfecting' : progress === 0 ? 'standby' : 'complete'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md mb-16">
                <div className="h-px bg-[var(--warm-gray)] relative">
                  <div
                    className={`h-px absolute left-0 top-0 transition-all duration-300 ${
                      cycleActive ? 'bg-[var(--accent)]' : 'bg-[var(--mid-gray)]'
                    }`}
                    style={{ width: `${progress}%` }}
                    data-testid="progress-bar"
                  />
                </div>
              </div>

              {/* Current Settings Summary */}
              <div className="flex items-center gap-12 text-center mb-16">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--mid-gray)]">Room</p>
                  <p className="font-mono text-lg" data-testid="display-room">{selectedRoom}</p>
                </div>
                <div className="w-px h-8 bg-[var(--warm-gray)]" />
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--mid-gray)]">Mode</p>
                  <p className="font-mono text-lg capitalize" data-testid="display-mode">{mode}</p>
                </div>
                <div className="w-px h-8 bg-[var(--warm-gray)]" />
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--mid-gray)]">Intensity</p>
                  <p className="font-mono text-lg" data-testid="display-intensity">{intensity}%</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleStartCycle}
                  disabled={cycleActive || connectionStatus !== 'connected'}
                  data-testid="start-cycle-btn"
                  className={`px-12 py-4 text-sm uppercase tracking-[0.15em] transition-all ${
                    cycleActive || connectionStatus !== 'connected'
                      ? 'bg-[var(--warm-gray)] text-[var(--mid-gray)] cursor-not-allowed'
                      : 'bg-[var(--black)] text-[var(--white)] hover:bg-[var(--dark-gray)]'
                  }`}
                >
                  {cycleActive ? 'Running' : 'Start Cycle'}
                </button>
                <button
                  onClick={handleAbortCycle}
                  disabled={!cycleActive}
                  data-testid="abort-cycle-btn"
                  className={`px-8 py-4 text-sm uppercase tracking-[0.15em] border hairline transition-all ${
                    !cycleActive
                      ? 'border-[var(--warm-gray)] text-[var(--mid-gray)] cursor-not-allowed'
                      : 'border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger-light)]'
                  }`}
                >
                  Abort
                </button>
              </div>

              {/* Emergency Stop */}
              <button
                onClick={handleEmergencyStop}
                data-testid="emergency-stop-btn"
                className="mt-8 text-[10px] uppercase tracking-[0.2em] text-[var(--danger)] hover:underline underline-offset-4"
              >
                Emergency Stop
              </button>
            </div>

            {/* Right Column — History */}
            <div className="col-span-4">
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="font-serif text-xl">History</h2>
                <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--mid-gray)]">
                  {cycleHistory.length} cycles
                </span>
              </div>

              <div className="border-t hairline border-[var(--warm-gray)]" data-testid="cycle-history-table">
                {cycleHistory.map((cycle, i) => (
                  <div
                    key={i}
                    className="py-4 border-b hairline border-[var(--warm-gray)] flex items-center justify-between hover:bg-[var(--off-white)] transition-colors cursor-pointer"
                    data-testid={`history-row-${i}`}
                  >
                    <div className="flex items-center gap-6">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        cycle.status === 'Complete' ? 'bg-[var(--accent)]' : 'bg-[var(--danger)]'
                      }`} />
                      <div>
                        <p className="font-mono text-sm">{cycle.room}</p>
                        <p className="text-[10px] text-[var(--mid-gray)]">{cycle.id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm">{cycle.timestamp}</p>
                      <p className="text-[10px] text-[var(--mid-gray)]">{cycle.duration}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  data-testid="export-log-btn"
                  className="text-[10px] uppercase tracking-[0.15em] text-[var(--mid-gray)] hover:text-[var(--black)] transition-colors"
                >
                  Export
                </button>
                <button
                  data-testid="print-log-btn"
                  className="text-[10px] uppercase tracking-[0.15em] text-[var(--mid-gray)] hover:text-[var(--black)] transition-colors"
                >
                  Print
                </button>
                <button
                  data-testid="clear-log-btn"
                  className="text-[10px] uppercase tracking-[0.15em] text-[var(--mid-gray)] hover:text-[var(--black)] transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* Toolbar buttons (hidden but testable) */}
              <div className="sr-only">
                <button data-testid="toolbar-new-cycle">New Cycle</button>
                <button data-testid="toolbar-view-log">View Log</button>
                <button data-testid="toolbar-print">Print</button>
                <button data-testid="toolbar-calibrate">Calibrate</button>
                <button data-testid="reset-lamp-hours-btn" onClick={() => setLampHours(0)}>Reset Lamp</button>
              </div>
            </div>
          </div>
        </main>

        {/* Minimal Footer */}
        <footer className="fixed bottom-0 left-0 right-0 border-t hairline border-[var(--warm-gray)] bg-[var(--white)] px-8 py-3">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between text-[10px] text-[var(--mid-gray)]">
            <span>UltraClean Pro 400 · v3.2.1</span>
            <span data-testid="status-bar-connection">
              {connectionStatus === 'connected' ? 'System Online' :
               connectionStatus === 'weak' ? 'Weak Signal' : 'System Offline'}
            </span>
            <span>Memorial General Hospital</span>
          </div>
        </footer>
      </div>
    </>
  )
}
