'use client'

import { useState, useEffect } from 'react'

export default function CameraSystem() {
  const [panValue, setPanValue] = useState(180)
  const [tiltValue, setTiltValue] = useState(45)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isRecording, setIsRecording] = useState(true)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [activeCamera, setActiveCamera] = useState('CAM-01')
  const [isPTZMoving, setIsPTZMoving] = useState(false)
  const [ptzDirection, setPtzDirection] = useState<string | null>(null)
  const [brightness, setBrightness] = useState(50)
  const [contrast, setContrast] = useState(50)
  const [irMode, setIrMode] = useState<'auto' | 'on' | 'off'>('auto')
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [motionDetection, setMotionDetection] = useState(true)
  const [streamQuality, setStreamQuality] = useState<'high' | 'medium' | 'low'>('high')

  const cameras = [
    { id: 'CAM-01', name: 'OR-1 Overview', ip: '192.168.1.101', status: 'online', model: 'Axis P5655-E' },
    { id: 'CAM-02', name: 'OR-1 Surgical Field', ip: '192.168.1.102', status: 'online', model: 'Axis V5915' },
    { id: 'CAM-03', name: 'OR-2 Overview', ip: '192.168.1.103', status: 'online', model: 'Axis P5655-E' },
    { id: 'CAM-04', name: 'OR-2 Surgical Field', ip: '192.168.1.104', status: 'warning', model: 'Axis V5915' },
    { id: 'CAM-05', name: 'Corridor A', ip: '192.168.1.105', status: 'offline', model: 'Axis P3245-V' },
  ]

  const presets = [
    { id: 1, name: 'Wide View', pan: 180, tilt: 30, zoom: 1 },
    { id: 2, name: 'Table Center', pan: 175, tilt: 60, zoom: 2.5 },
    { id: 3, name: 'Entry Door', pan: 90, tilt: 45, zoom: 1.5 },
    { id: 4, name: 'Equipment Bay', pan: 270, tilt: 40, zoom: 1.8 },
  ]

  const currentCamera = cameras.find(c => c.id === activeCamera)!

  // Simulate PTZ movement
  const handlePTZControl = (direction: string) => {
    setIsPTZMoving(true)
    setPtzDirection(direction)

    const interval = setInterval(() => {
      switch (direction) {
        case 'up':
          setTiltValue(v => Math.min(90, v + 2))
          break
        case 'down':
          setTiltValue(v => Math.max(0, v - 2))
          break
        case 'left':
          setPanValue(v => (v - 3 + 360) % 360)
          break
        case 'right':
          setPanValue(v => (v + 3) % 360)
          break
      }
    }, 50)

    const handleMouseUp = () => {
      clearInterval(interval)
      setIsPTZMoving(false)
      setPtzDirection(null)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleZoom = (direction: 'in' | 'out') => {
    setZoomLevel(v => {
      if (direction === 'in') return Math.min(10, v + 0.5)
      return Math.max(1, v - 0.5)
    })
  }

  const handlePreset = (preset: typeof presets[0]) => {
    setSelectedPreset(preset.id)
    setPanValue(preset.pan)
    setTiltValue(preset.tilt)
    setZoomLevel(preset.zoom)

    setTimeout(() => setSelectedPreset(null), 1000)
  }

  const handleSnapshot = () => {
    alert('Snapshot saved to: /recordings/snapshots/CAM01_' + Date.now() + '.jpg')
  }

  // Simulate time display
  const [currentTime, setCurrentTime] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-gray-200">
      {/* Header */}
      <header className="bg-[#2a2a2a] border-b border-[#444] px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <div>
                <h1 className="text-lg font-semibold">SurgView Pro</h1>
                <p className="text-xs text-gray-400">PTZ Camera Management</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">Memorial General Hospital</span>
            <span className="font-mono">{currentTime.toLocaleTimeString()}</span>
            <button className="px-3 py-1 bg-[#333] hover:bg-[#444] rounded border border-[#555]">
              Settings
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Camera List Sidebar */}
        <aside className="w-64 bg-[#222] border-r border-[#444] min-h-[calc(100vh-56px)]">
          <div className="p-3 border-b border-[#444]">
            <h2 className="text-sm font-semibold text-gray-400 uppercase">Cameras</h2>
          </div>
          <div className="space-y-1 p-2">
            {cameras.map((camera) => (
              <button
                key={camera.id}
                onClick={() => setActiveCamera(camera.id)}
                className={`w-full text-left p-3 rounded transition-colors ${
                  activeCamera === camera.id
                    ? 'bg-blue-600'
                    : 'hover:bg-[#333]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{camera.name}</span>
                  <span className={`w-2 h-2 rounded-full ${
                    camera.status === 'online' ? 'bg-green-500' :
                    camera.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                </div>
                <div className="text-xs text-gray-400 mt-1">{camera.id}</div>
              </button>
            ))}
          </div>

          {/* Recording Status */}
          <div className="p-3 border-t border-[#444] mt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm">Recording</span>
              <button
                onClick={() => setIsRecording(!isRecording)}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  isRecording ? 'bg-red-600' : 'bg-gray-600'
                }`}
              >
                <span className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                  isRecording ? 'left-6' : 'left-0.5'
                }`} />
              </button>
            </div>
            {isRecording && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <span className="w-2 h-2 bg-red-500 rounded-full rec-pulse" />
                <span>Recording to NVR-01</span>
              </div>
            )}
          </div>

          {/* Camera Info */}
          <div className="p-3 border-t border-[#444]">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Camera Info</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Model:</span>
                <span>{currentCamera.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">IP:</span>
                <span className="font-mono">{currentCamera.ip}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={currentCamera.status === 'online' ? 'text-green-400' : 'text-yellow-400'}>
                  {currentCamera.status.charAt(0).toUpperCase() + currentCamera.status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4">
          <div className="grid grid-cols-12 gap-4">
            {/* Video Feed */}
            <div className="col-span-8">
              <div className="bg-black rounded-lg overflow-hidden relative aspect-video">
                {/* Simulated video feed - gradient background */}
                <div
                  className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative"
                  style={{
                    filter: `brightness(${brightness / 50}) contrast(${contrast / 50})`
                  }}
                >
                  {/* Grid overlay */}
                  <div className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                      backgroundSize: '50px 50px'
                    }}
                  />

                  {/* Simulated OR view */}
                  <div className="text-center">
                    <div className="w-32 h-20 border-2 border-gray-600 rounded-lg mb-2 mx-auto flex items-center justify-center">
                      <span className="text-xs text-gray-500">Operating Table</span>
                    </div>
                    <p className="text-gray-500 text-sm">Live Feed - {currentCamera.name}</p>
                  </div>

                  {/* PTZ indicator */}
                  {isPTZMoving && (
                    <div className="absolute top-4 left-4 bg-yellow-500/80 text-black px-3 py-1 rounded text-sm font-medium">
                      PTZ Moving: {ptzDirection?.toUpperCase()}
                    </div>
                  )}

                  {/* Recording indicator */}
                  {isRecording && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600/80 px-3 py-1 rounded">
                      <span className="w-2 h-2 bg-white rounded-full rec-pulse" />
                      <span className="text-xs font-medium">REC</span>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="absolute bottom-4 left-4 font-mono text-sm bg-black/50 px-2 py-1 rounded">
                    {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()}
                  </div>

                  {/* Camera ID */}
                  <div className="absolute bottom-4 right-4 font-mono text-sm bg-black/50 px-2 py-1 rounded">
                    {activeCamera} | Zoom: {zoomLevel.toFixed(1)}x
                  </div>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="mt-4 bg-[#222] rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-[#333] rounded">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                    </svg>
                  </button>
                  <button className="p-2 hover:bg-[#333] rounded">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                  <button className="p-2 hover:bg-[#333] rounded">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  </button>
                  <button className="p-2 hover:bg-[#333] rounded">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.5 6l8.5 6-8.5 6V6zm-4 0v12l-8.5-6 8.5-6z"/>
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleSnapshot}
                    className="px-4 py-2 bg-[#333] hover:bg-[#444] rounded flex items-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 3L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-3.17L15 3H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                    </svg>
                    Snapshot
                  </button>
                  <button className="px-4 py-2 bg-[#333] hover:bg-[#444] rounded flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                    </svg>
                    Event Log
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Quality:</span>
                  <select
                    value={streamQuality}
                    onChange={(e) => setStreamQuality(e.target.value as any)}
                    className="bg-[#333] border border-[#555] rounded px-2 py-1 text-sm"
                  >
                    <option value="high">1080p</option>
                    <option value="medium">720p</option>
                    <option value="low">480p</option>
                  </select>
                </div>
              </div>
            </div>

            {/* PTZ Controls */}
            <div className="col-span-4 space-y-4">
              {/* D-Pad */}
              <div className="bg-[#222] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">PTZ Control</h3>

                <div className="flex justify-center mb-4">
                  <div className="relative w-36 h-36">
                    {/* Center circle */}
                    <div className="absolute inset-6 bg-[#333] rounded-full border-2 border-[#444]" />

                    {/* Direction buttons */}
                    <button
                      onMouseDown={() => handlePTZControl('up')}
                      className={`absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        ptzDirection === 'up' ? 'bg-blue-600' : 'bg-[#333] hover:bg-[#444]'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 14l5-5 5 5H7z"/>
                      </svg>
                    </button>
                    <button
                      onMouseDown={() => handlePTZControl('down')}
                      className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        ptzDirection === 'down' ? 'bg-blue-600' : 'bg-[#333] hover:bg-[#444]'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 10l5 5 5-5H7z"/>
                      </svg>
                    </button>
                    <button
                      onMouseDown={() => handlePTZControl('left')}
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        ptzDirection === 'left' ? 'bg-blue-600' : 'bg-[#333] hover:bg-[#444]'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 7l-5 5 5 5V7z"/>
                      </svg>
                    </button>
                    <button
                      onMouseDown={() => handlePTZControl('right')}
                      className={`absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        ptzDirection === 'right' ? 'bg-blue-600' : 'bg-[#333] hover:bg-[#444]'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10 17l5-5-5-5v10z"/>
                      </svg>
                    </button>

                    {/* Home button */}
                    <button
                      onClick={() => { setPanValue(180); setTiltValue(45); }}
                      className="absolute inset-1/4 bg-[#444] hover:bg-[#555] rounded-full flex items-center justify-center text-xs"
                    >
                      HOME
                    </button>
                  </div>
                </div>

                {/* Position indicators */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Pan:</span>
                    <span className="ml-2 font-mono">{panValue}°</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Tilt:</span>
                    <span className="ml-2 font-mono">{tiltValue}°</span>
                  </div>
                </div>
              </div>

              {/* Zoom Control */}
              <div className="bg-[#222] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Zoom</h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleZoom('out')}
                    className="w-10 h-10 bg-[#333] hover:bg-[#444] rounded flex items-center justify-center text-xl"
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.1"
                    value={zoomLevel}
                    onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-500"
                  />
                  <button
                    onClick={() => handleZoom('in')}
                    className="w-10 h-10 bg-[#333] hover:bg-[#444] rounded flex items-center justify-center text-xl"
                  >
                    +
                  </button>
                </div>
                <div className="text-center mt-2 font-mono text-sm">{zoomLevel.toFixed(1)}x</div>
              </div>

              {/* Presets */}
              <div className="bg-[#222] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Presets</h3>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePreset(preset)}
                      className={`px-3 py-2 rounded text-sm transition-colors ${
                        selectedPreset === preset.id
                          ? 'bg-blue-600'
                          : 'bg-[#333] hover:bg-[#444]'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                <button className="w-full mt-3 px-3 py-2 bg-[#333] hover:bg-[#444] rounded text-sm border border-dashed border-[#555]">
                  + Save Current Position
                </button>
              </div>

              {/* Image Settings */}
              <div className="bg-[#222] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Image Settings</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Brightness</span>
                      <span>{brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={brightness}
                      onChange={(e) => setBrightness(parseInt(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Contrast</span>
                      <span>{contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={contrast}
                      onChange={(e) => setContrast(parseInt(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">IR Mode</span>
                    <select
                      value={irMode}
                      onChange={(e) => setIrMode(e.target.value as any)}
                      className="bg-[#333] border border-[#555] rounded px-2 py-1 text-sm"
                    >
                      <option value="auto">Auto</option>
                      <option value="on">On</option>
                      <option value="off">Off</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Audio</span>
                    <button
                      onClick={() => setAudioEnabled(!audioEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        audioEnabled ? 'bg-blue-600' : 'bg-gray-600'
                      }`}
                    >
                      <span className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                        audioEnabled ? 'left-6' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Motion Detection</span>
                    <button
                      onClick={() => setMotionDetection(!motionDetection)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        motionDetection ? 'bg-blue-600' : 'bg-gray-600'
                      }`}
                    >
                      <span className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                        motionDetection ? 'left-6' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
