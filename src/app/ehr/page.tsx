'use client'

import { useState, useEffect, useMemo } from 'react'
import { updateDeviceStatus, updateDeviceFields, DEVICE_IDS, ROOM_IDS } from '@/lib/convex-api'
import { useConvexDeviceOverlay } from '@/hooks/useConvexDeviceOverlay'
import { useConvexSync } from '@/hooks/useConvexSync'
import ConvexStatusBadge from '@/components/ConvexStatusBadge'

interface Patient {
  mrn: string
  name: string
  dob: string
  procedure: string
  surgeon: string
  scheduledTime: string
  estimatedDuration: string
  anesthesia: string
  allergies: string[]
  notes: string
}

interface Room {
  id: string
  name: string
  status: 'Ready' | 'Occupied' | 'Turnover' | 'Cleaning' | 'Blocked'
  currentPatient: Patient | null
  nextPatient: Patient | null
  turnoverStarted: string | null
  equipment: string[]
}

export default function EHRSystem() {
  const [activeTab, setActiveTab] = useState('schedule')
  const [selectedRoom, setSelectedRoom] = useState('OR-1')
  const [expandedMenu, setExpandedMenu] = useState<string | null>('surgery')

  const [rooms, setRooms] = useState<Room[]>([
    {
      id: 'OR-1',
      name: 'Operating Room 1',
      status: 'Turnover',
      currentPatient: null,
      nextPatient: {
        mrn: 'MRN-2024-00847',
        name: 'Johnson, Robert M.',
        dob: '03/15/1962',
        procedure: 'Total Knee Arthroplasty, Left',
        surgeon: 'Dr. Sarah Mitchell',
        scheduledTime: '14:30',
        estimatedDuration: '2h 30m',
        anesthesia: 'Spinal w/ Sedation',
        allergies: ['Penicillin', 'Latex'],
        notes: 'Diabetic - insulin protocol required. MRSA precautions.'
      },
      turnoverStarted: '14:02',
      equipment: ['Zimmer Total Knee System', 'Tourniquet', 'C-Arm Available']
    },
    {
      id: 'OR-2',
      name: 'Operating Room 2',
      status: 'Occupied',
      currentPatient: {
        mrn: 'MRN-2024-00832',
        name: 'Williams, Patricia A.',
        dob: '07/22/1978',
        procedure: 'Laparoscopic Cholecystectomy',
        surgeon: 'Dr. James Chen',
        scheduledTime: '13:00',
        estimatedDuration: '1h 15m',
        anesthesia: 'General',
        allergies: [],
        notes: ''
      },
      nextPatient: {
        mrn: 'MRN-2024-00851',
        name: 'Davis, Michael T.',
        dob: '11/08/1985',
        procedure: 'Appendectomy',
        surgeon: 'Dr. James Chen',
        scheduledTime: '15:00',
        estimatedDuration: '45m',
        anesthesia: 'General',
        allergies: ['Sulfa'],
        notes: 'Acute presentation'
      },
      turnoverStarted: null,
      equipment: ['Laparoscopic Tower', 'Bovie']
    },
    {
      id: 'OR-3',
      name: 'Operating Room 3',
      status: 'Ready',
      currentPatient: null,
      nextPatient: {
        mrn: 'MRN-2024-00855',
        name: 'Brown, Elizabeth K.',
        dob: '09/30/1971',
        procedure: 'Rotator Cuff Repair',
        surgeon: 'Dr. Mark Thompson',
        scheduledTime: '14:45',
        estimatedDuration: '2h',
        anesthesia: 'Interscalene Block + Sedation',
        allergies: [],
        notes: 'Beach chair position'
      },
      turnoverStarted: null,
      equipment: ['Arthroscopy Tower', 'Shoulder Positioning Device']
    },
    {
      id: 'OR-4',
      name: 'Operating Room 4',
      status: 'Cleaning',
      currentPatient: null,
      nextPatient: null,
      turnoverStarted: '13:45',
      equipment: []
    },
    {
      id: 'PACU',
      name: 'Post-Anesthesia Care Unit',
      status: 'Occupied',
      currentPatient: {
        mrn: 'MRN-2024-00829',
        name: 'Anderson, Thomas J.',
        dob: '02/14/1955',
        procedure: 'Hip Replacement, Right (Recovery)',
        surgeon: 'Dr. Sarah Mitchell',
        scheduledTime: '-',
        estimatedDuration: '-',
        anesthesia: 'Recovering',
        allergies: ['Morphine'],
        notes: 'Vitals stable, pain controlled'
      },
      nextPatient: null,
      turnoverStarted: null,
      equipment: []
    }
  ])

  // Convex real-time overlay
  const convexState = useConvexDeviceOverlay(ROOM_IDS.OR_3, "Room Scheduling")

  // Sync Convex fields → local room state for OR-3
  useEffect(() => {
    if (convexState.isLoading || convexState.status === 'idle') return
    const f = convexState.fields

    setRooms(prev => prev.map(room => {
      if (room.id !== 'OR-3') return room
      return {
        ...room,
        status: typeof f.roomStatus === 'string' ? f.roomStatus as Room['status'] : room.status,
      }
    }))
  }, [convexState.status, convexState.fields, convexState.isLoading])

  // Auto-sync room state to Convex
  const or1 = rooms.find(r => r.id === 'OR-1')
  const or2 = rooms.find(r => r.id === 'OR-2')
  const or3 = rooms.find(r => r.id === 'OR-3')
  const or4 = rooms.find(r => r.id === 'OR-4')
  const activeRoom = rooms.find(r => r.id === selectedRoom)
  const nextPatient = activeRoom?.nextPatient || activeRoom?.currentPatient
  const ehrSyncFields = useMemo(() => ({
    hospitalName: 'Memorial General Hospital',
    unitName: 'Main OR',
    activeRoomTitle: activeRoom?.name ?? '',
    activeRoomStatus: activeRoom?.status ?? '',
    turnoverTime: activeRoom?.turnoverStarted ?? '',
    patientName: nextPatient?.name ?? '',
    mrn: nextPatient?.mrn ?? '',
    procedure: nextPatient?.procedure ?? '',
    surgeon: nextPatient?.surgeon ?? '',
    duration: nextPatient?.estimatedDuration ?? '',
    anesthesia: nextPatient?.anesthesia ?? '',
    allergies: nextPatient?.allergies?.join(', ') ?? '',
    roomStatus_OR1: or1?.status ?? '',
    roomStatus_OR2: or2?.status ?? '',
    roomStatus_OR3: or3?.status ?? '',
    roomStatus_OR4: or4?.status ?? '',
  }), [rooms, selectedRoom, activeRoom, nextPatient, or1, or2, or3, or4])
  useConvexSync(DEVICE_IDS.SCHEDULING, ehrSyncFields)

  const currentRoom = rooms.find(r => r.id === selectedRoom)!

  const handleStatusChange = (roomId: string, newStatus: Room['status']) => {
    setRooms(prev => prev.map(r =>
      r.id === roomId
        ? {
            ...r,
            status: newStatus,
            turnoverStarted: newStatus === 'Turnover' ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : null
          }
        : r
    ))
    // Report to Convex backend
    updateDeviceStatus({
      deviceId: DEVICE_IDS.SCHEDULING,
      status: newStatus === 'Ready' ? 'ready' : newStatus === 'Blocked' ? 'error' : 'configuring',
      currentAction: `${roomId} set to ${newStatus}`
    })
    updateDeviceFields({
      deviceId: DEVICE_IDS.SCHEDULING,
      fields: {
        lastUpdatedRoom: roomId,
        lastRoomStatus: newStatus,
        lastAction: 'status_change'
      }
    })
  }

  const menuItems = [
    {
      id: 'surgery',
      label: 'Surgical Services',
      items: ['OR Schedule', 'Room Status', 'Case Tracking', 'Block Schedule']
    },
    {
      id: 'patient',
      label: 'Patient Care',
      items: ['Patient List', 'Assessments', 'Orders', 'Medications']
    },
    {
      id: 'reports',
      label: 'Reports',
      items: ['Daily Summary', 'Turnover Times', 'Utilization', 'Delays']
    },
    {
      id: 'admin',
      label: 'Administration',
      items: ['Staff Schedule', 'Equipment', 'Preferences', 'Setup']
    }
  ]

  const getStatusColor = (status: Room['status']) => {
    switch (status) {
      case 'Ready': return 'bg-green-600'
      case 'Occupied': return 'bg-blue-600'
      case 'Turnover': return 'bg-yellow-500'
      case 'Cleaning': return 'bg-orange-500'
      case 'Blocked': return 'bg-red-600'
    }
  }

  const getStatusBg = (status: Room['status']) => {
    switch (status) {
      case 'Ready': return 'bg-green-50 border-green-200'
      case 'Occupied': return 'bg-blue-50 border-blue-200'
      case 'Turnover': return 'bg-yellow-50 border-yellow-200'
      case 'Cleaning': return 'bg-orange-50 border-orange-200'
      case 'Blocked': return 'bg-red-50 border-red-200'
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-gray-800" style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif' }}>
      <ConvexStatusBadge state={convexState} />
      {/* Epic-style header */}
      <header className="bg-gradient-to-r from-[#1a4480] to-[#2c5aa0] text-white">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <div className="text-xl font-bold tracking-tight">
              <span className="text-orange-400">Care</span>Connect
            </div>
            <div className="h-6 w-px bg-white/30" />
            <span className="text-sm">Surgical Services</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span>Memorial General Hospital</span>
            <span>|</span>
            <span>Unit: Main OR</span>
            <span>|</span>
            <span>User: ADMIN, Charge RN</span>
            <button className="ml-4 bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs">
              Switch Unit
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-[#0d2847] px-4">
          {['Schedule', 'Room Board', 'Patient List', 'Case Entry', 'Staff', 'Reports'].map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase().replace(' ', '-'))}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                (activeTab === 'schedule' && i === 0) || (activeTab === 'room-board' && i === 1)
                  ? 'bg-[#f5f5f5] text-gray-800 rounded-t'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <div className="flex">
        {/* Left sidebar - nested navigation */}
        <aside className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-88px)]">
          <div className="p-2">
            {menuItems.map((menu) => (
              <div key={menu.id} className="mb-1">
                <button
                  onClick={() => setExpandedMenu(expandedMenu === menu.id ? null : menu.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
                >
                  <span>{menu.label}</span>
                  <span className="text-xs">{expandedMenu === menu.id ? '▼' : '▶'}</span>
                </button>
                {expandedMenu === menu.id && (
                  <div className="ml-4 mt-1 space-y-1">
                    {menu.items.map((item) => (
                      <button
                        key={item}
                        className="w-full text-left px-3 py-1.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick filters */}
          <div className="border-t border-gray-200 p-3 mt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Quick Filters</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked className="rounded" />
                <span>Show Ready Rooms</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked className="rounded" />
                <span>Show Turnover</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked className="rounded" />
                <span>Show Occupied</span>
              </label>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4">
          {/* Room Status Strip */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 transition-all ${
                  selectedRoom === room.id
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-transparent hover:border-gray-300'
                } ${getStatusBg(room.status)}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${getStatusColor(room.status)}`} />
                  <span className="font-medium text-sm">{room.id}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{room.status}</div>
              </button>
            ))}
          </div>

          {/* Room Detail Panel */}
          <div className="grid grid-cols-3 gap-4">
            {/* Left - Room Status & Controls */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{currentRoom.name}</h2>
                  <span className={`px-3 py-1 rounded-full text-white text-xs font-medium ${getStatusColor(currentRoom.status)}`}>
                    {currentRoom.status}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Status Controls */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Room Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Ready', 'Turnover', 'Cleaning', 'Blocked'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(currentRoom.id, status)}
                        className={`px-3 py-2 rounded text-sm font-medium transition-all ${
                          currentRoom.status === status
                            ? `${getStatusColor(status)} text-white`
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {currentRoom.status === 'Turnover' && currentRoom.turnoverStarted && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-xs text-yellow-800 font-medium">Turnover in Progress</p>
                    <p className="text-lg font-bold text-yellow-700">Started: {currentRoom.turnoverStarted}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleStatusChange(currentRoom.id, 'Ready')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded font-medium"
                      >
                        Mark Ready
                      </button>
                      <button className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-sm rounded">
                        Add Note
                      </button>
                    </div>
                  </div>
                )}

                {/* Checklist */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Turnover Checklist</label>
                  <div className="space-y-2">
                    {['Room cleaned', 'Equipment staged', 'Instruments verified', 'Anesthesia setup', 'Patient ready'].map((item, i) => (
                      <label key={item} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" defaultChecked={i < 2} className="rounded" />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Equipment */}
                {currentRoom.equipment.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Required Equipment</label>
                    <ul className="text-sm space-y-1">
                      {currentRoom.equipment.map((eq) => (
                        <li key={eq} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                          {eq}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Center - Next Case Info */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-200 bg-blue-50">
                <h2 className="font-semibold text-blue-900">Next Case</h2>
              </div>

              {currentRoom.nextPatient ? (
                <div className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg">{currentRoom.nextPatient.name}</h3>
                      <p className="text-sm text-gray-500">MRN: {currentRoom.nextPatient.mrn}</p>
                      <p className="text-sm text-gray-500">DOB: {currentRoom.nextPatient.dob}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{currentRoom.nextPatient.scheduledTime}</p>
                      <p className="text-xs text-gray-500">Scheduled</p>
                    </div>
                  </div>

                  {currentRoom.nextPatient.allergies.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-2 mb-4">
                      <p className="text-xs font-bold text-red-700">ALLERGIES:</p>
                      <p className="text-sm text-red-800">{currentRoom.nextPatient.allergies.join(', ')}</p>
                    </div>
                  )}

                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-gray-500">Procedure:</span>
                      <p className="font-medium">{currentRoom.nextPatient.procedure}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-500">Surgeon:</span>
                        <p className="font-medium">{currentRoom.nextPatient.surgeon}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <p className="font-medium">{currentRoom.nextPatient.estimatedDuration}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Anesthesia:</span>
                      <p className="font-medium">{currentRoom.nextPatient.anesthesia}</p>
                    </div>
                    {currentRoom.nextPatient.notes && (
                      <div>
                        <span className="text-gray-500">Notes:</span>
                        <p className="font-medium text-orange-700">{currentRoom.nextPatient.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded font-medium">
                      View Full Chart
                    </button>
                    <button className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-sm rounded">
                      Print
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p>No case scheduled</p>
                </div>
              )}
            </div>

            {/* Right - Schedule List */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold">Today's Schedule</h2>
                <select className="text-sm border border-gray-300 rounded px-2 py-1">
                  <option>All Rooms</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.id}</option>
                  ))}
                </select>
              </div>

              <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                {[
                  { time: '07:30', room: 'OR-2', procedure: 'Hernia Repair', surgeon: 'Chen', status: 'Complete' },
                  { time: '09:00', room: 'OR-1', procedure: 'Hip Replacement', surgeon: 'Mitchell', status: 'Complete' },
                  { time: '10:30', room: 'OR-3', procedure: 'Knee Scope', surgeon: 'Thompson', status: 'Complete' },
                  { time: '13:00', room: 'OR-2', procedure: 'Lap Chole', surgeon: 'Chen', status: 'In Progress' },
                  { time: '14:30', room: 'OR-1', procedure: 'TKA Left', surgeon: 'Mitchell', status: 'Next' },
                  { time: '14:45', room: 'OR-3', procedure: 'Rotator Cuff', surgeon: 'Thompson', status: 'Scheduled' },
                  { time: '15:00', room: 'OR-2', procedure: 'Appendectomy', surgeon: 'Chen', status: 'Scheduled' },
                  { time: '16:30', room: 'OR-1', procedure: 'Carpal Tunnel', surgeon: 'Lee', status: 'Scheduled' },
                ].map((item, i) => (
                  <div key={i} className="p-3 hover:bg-gray-50 flex items-center gap-3">
                    <div className="w-14 text-right">
                      <span className="font-mono text-sm font-medium">{item.time}</span>
                    </div>
                    <div className="w-12">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{item.room}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.procedure}</p>
                      <p className="text-xs text-gray-500">{item.surgeon}</p>
                    </div>
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        item.status === 'Complete' ? 'bg-gray-200 text-gray-600' :
                        item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                        item.status === 'Next' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Footer status bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-1 flex justify-between text-xs text-gray-500">
        <span>CareConnect v12.4.2 | Surgical Module</span>
        <span suppressHydrationWarning>Last sync: {new Date().toLocaleTimeString()}</span>
        <span>Session expires in 58 minutes</span>
      </footer>
    </div>
  )
}
