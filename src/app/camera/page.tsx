'use client'

import { useState, useEffect } from 'react'
import { updateDeviceStatus, updateDeviceFields, DEVICE_IDS } from '@/lib/convex-api'

interface MetricData {
  id: string
  category: string
  name: string
  value: string | number
  unit: string
  status: 'normal' | 'warning' | 'critical'
  lastUpdated: string
}

export default function VariableTrackerDashboard() {
  const [activeTab, setActiveTab] = useState<'all' | 'uv' | 'tug'>('all')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  const [metrics, setMetrics] = useState<MetricData[]>([
    // UV Robot Metrics
    { id: 'UV-001', category: 'UV', name: 'Cycle Progress', value: 0, unit: '%', status: 'normal', lastUpdated: '10:45:32' },
    { id: 'UV-002', category: 'UV', name: 'Battery Level', value: 87, unit: '%', status: 'normal', lastUpdated: '10:45:30' },
    { id: 'UV-003', category: 'UV', name: 'UV Intensity', value: 85, unit: '%', status: 'normal', lastUpdated: '10:45:28' },
    { id: 'UV-004', category: 'UV', name: 'Connection Status', value: 'Online', unit: '', status: 'normal', lastUpdated: '10:45:32' },
    { id: 'UV-005', category: 'UV', name: 'Current Room', value: 'OR-1', unit: '', status: 'normal', lastUpdated: '10:45:32' },
    { id: 'UV-006', category: 'UV', name: 'Cycles Today', value: 12, unit: 'cycles', status: 'normal', lastUpdated: '10:45:32' },
    { id: 'UV-007', category: 'UV', name: 'Lamp Hours', value: 1247, unit: 'hrs', status: 'warning', lastUpdated: '10:45:32' },
    { id: 'UV-008', category: 'UV', name: 'Device Health', value: 'Good', unit: '', status: 'normal', lastUpdated: '10:45:32' },
    // TUG Robot Metrics
    { id: 'TUG-001', category: 'TUG', name: 'Active Units', value: 2, unit: 'of 4', status: 'normal', lastUpdated: '10:45:31' },
    { id: 'TUG-002', category: 'TUG', name: 'Units EN_ROUTE', value: 1, unit: 'units', status: 'normal', lastUpdated: '10:45:31' },
    { id: 'TUG-003', category: 'TUG', name: 'Units IDLE', value: 2, unit: 'units', status: 'normal', lastUpdated: '10:45:31' },
    { id: 'TUG-004', category: 'TUG', name: 'Trips Today', value: 47, unit: 'trips', status: 'normal', lastUpdated: '10:45:31' },
    { id: 'TUG-005', category: 'TUG', name: 'Avg Transit Time', value: '3:42', unit: 'min', status: 'normal', lastUpdated: '10:45:31' },
    { id: 'TUG-006', category: 'TUG', name: 'On-Time Rate', value: 98.2, unit: '%', status: 'normal', lastUpdated: '10:45:31' },
    { id: 'TUG-007', category: 'TUG', name: 'Fleet Battery Avg', value: 72, unit: '%', status: 'normal', lastUpdated: '10:45:31' },
    { id: 'TUG-008', category: 'TUG', name: 'Pending Deliveries', value: 3, unit: 'items', status: 'warning', lastUpdated: '10:45:31' },
  ])

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Simulate metric updates
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      setMetrics(prev => prev.map(metric => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false })
        if (metric.id === 'UV-002') {
          const newVal = Math.max(0, Math.min(100, (metric.value as number) + Math.floor((Math.random() - 0.5) * 3)))
          return { ...metric, value: newVal, lastUpdated: time, status: newVal < 20 ? 'critical' : newVal < 50 ? 'warning' : 'normal' }
        }
        if (metric.id === 'TUG-007') {
          const newVal = Math.max(0, Math.min(100, (metric.value as number) + Math.floor((Math.random() - 0.5) * 5)))
          return { ...metric, value: newVal, lastUpdated: time, status: newVal < 30 ? 'critical' : newVal < 50 ? 'warning' : 'normal' }
        }
        return { ...metric, lastUpdated: time }
      }))
    }, 3000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const filteredMetrics = activeTab === 'all' ? metrics : metrics.filter(m => m.category === activeTab.toUpperCase())

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'normal': return { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' }
      case 'warning': return { bg: '#fff8e1', color: '#f57f17', border: '#ffe082' }
      case 'critical': return { bg: '#ffebee', color: '#c62828', border: '#ef9a9a' }
      default: return { bg: '#f5f5f5', color: '#616161', border: '#e0e0e0' }
    }
  }

  const refreshMetrics = () => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setMetrics(prev => prev.map(m => ({ ...m, lastUpdated: time })))
    // Report to Convex backend
    const normalCount = metrics.filter(m => m.status === 'normal').length
    const warningCount = metrics.filter(m => m.status === 'warning').length
    const criticalCount = metrics.filter(m => m.status === 'critical').length
    updateDeviceStatus({
      deviceId: DEVICE_IDS.VARIABLE_TRACKER,
      status: criticalCount > 0 ? 'error' : warningCount > 0 ? 'configuring' : 'ready',
      currentAction: `Monitoring ${metrics.length} variables`
    })
    updateDeviceFields({
      deviceId: DEVICE_IDS.VARIABLE_TRACKER,
      fields: {
        totalVariables: metrics.length,
        normalCount,
        warningCount,
        criticalCount,
        lastRefresh: time
      }
    })
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: '#e4e4e4',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
      }}
    >
      {/* Title Bar */}
      <div
        style={{
          background: 'linear-gradient(180deg, #4a7ab0 0%, #3d6a9f 50%, #2d5a8f 100%)',
          borderBottom: '1px solid #1e4a7f',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              background: '#fff',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span style={{ color: '#3d6a9f', fontWeight: 'bold', fontSize: '14px' }}>V</span>
          </div>
          <span style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>
            Variable Tracker - Equipment Monitoring System
          </span>
        </div>
        <div style={{ color: '#d0e0f0', fontSize: '12px' }}>
          Memorial General Hospital
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          background: 'linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 100%)',
          borderBottom: '1px solid #c0c0c0',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={refreshMetrics}
            data-testid="refresh-btn"
            style={{
              padding: '4px 12px',
              background: 'linear-gradient(180deg, #fff 0%, #e8e8e8 100%)',
              border: '1px solid #a0a0a0',
              borderRadius: '3px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ↻ Refresh
          </button>
          <div style={{ width: '1px', height: '20px', background: '#c0c0c0', margin: '0 4px' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#444' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              data-testid="auto-refresh-toggle"
            />
            Auto-Refresh
          </label>
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          Last Updated: <span style={{ fontFamily: 'Consolas, monospace' }} data-testid="last-update-time">{currentTime.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div
        style={{
          background: '#f0f0f0',
          borderBottom: '1px solid #c0c0c0',
          padding: '0 16px',
          display: 'flex',
          gap: '2px'
        }}
      >
        {[
          { id: 'all', label: 'All Variables' },
          { id: 'uv', label: 'UV Disinfection' },
          { id: 'tug', label: 'TUG Fleet' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            data-testid={`tab-${tab.id}`}
            style={{
              padding: '8px 16px',
              background: activeTab === tab.id
                ? 'linear-gradient(180deg, #fff 0%, #f8f8f8 100%)'
                : 'linear-gradient(180deg, #e8e8e8 0%, #d8d8d8 100%)',
              border: '1px solid #a0a0a0',
              borderBottom: activeTab === tab.id ? '1px solid #fff' : '1px solid #a0a0a0',
              borderRadius: '4px 4px 0 0',
              marginBottom: '-1px',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              color: activeTab === tab.id ? '#333' : '#666',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ padding: '16px' }}>
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #c0c0c0',
              borderRadius: '4px',
              padding: '12px'
            }}
            data-testid="summary-total"
          >
            <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Total Variables</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{filteredMetrics.length}</div>
          </div>
          <div
            style={{
              background: '#fff',
              border: '1px solid #c0c0c0',
              borderRadius: '4px',
              padding: '12px'
            }}
            data-testid="summary-normal"
          >
            <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Normal</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>
              {filteredMetrics.filter(m => m.status === 'normal').length}
            </div>
          </div>
          <div
            style={{
              background: '#fff',
              border: '1px solid #c0c0c0',
              borderRadius: '4px',
              padding: '12px'
            }}
            data-testid="summary-warning"
          >
            <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Warning</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f57f17' }}>
              {filteredMetrics.filter(m => m.status === 'warning').length}
            </div>
          </div>
          <div
            style={{
              background: '#fff',
              border: '1px solid #c0c0c0',
              borderRadius: '4px',
              padding: '12px'
            }}
            data-testid="summary-critical"
          >
            <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Critical</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#c62828' }}>
              {filteredMetrics.filter(m => m.status === 'critical').length}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #c0c0c0',
            borderRadius: '4px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #4a7ab0 0%, #3d6a9f 100%)',
              padding: '8px 12px',
              color: '#fff',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            Variable List
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }} data-testid="metrics-table">
            <thead>
              <tr style={{ background: '#f0f0f0', borderBottom: '1px solid #c0c0c0' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#444', borderRight: '1px solid #e0e0e0' }}>ID</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#444', borderRight: '1px solid #e0e0e0' }}>Category</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#444', borderRight: '1px solid #e0e0e0' }}>Variable Name</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#444', borderRight: '1px solid #e0e0e0' }}>Value</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#444', borderRight: '1px solid #e0e0e0' }}>Status</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#444' }}>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredMetrics.map((metric, index) => {
                const statusStyle = getStatusStyle(metric.status)
                return (
                  <tr
                    key={metric.id}
                    data-testid={`metric-row-${metric.id}`}
                    style={{
                      background: index % 2 === 0 ? '#fff' : '#fafafa',
                      borderBottom: '1px solid #e8e8e8'
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontFamily: 'Consolas, monospace', color: '#666', borderRight: '1px solid #f0f0f0' }}>
                      {metric.id}
                    </td>
                    <td style={{ padding: '8px 12px', borderRight: '1px solid #f0f0f0' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: '500',
                          background: metric.category === 'UV' ? '#e3f2fd' : '#f3e5f5',
                          color: metric.category === 'UV' ? '#1565c0' : '#7b1fa2',
                          border: `1px solid ${metric.category === 'UV' ? '#90caf9' : '#ce93d8'}`
                        }}
                      >
                        {metric.category}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: '500', color: '#333', borderRight: '1px solid #f0f0f0' }}>
                      {metric.name}
                    </td>
                    <td
                      style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'Consolas, monospace', fontWeight: '600', color: '#333', borderRight: '1px solid #f0f0f0' }}
                      data-testid={`metric-value-${metric.id}`}
                    >
                      {metric.value} {metric.unit}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #f0f0f0' }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          border: `1px solid ${statusStyle.border}`
                        }}
                        data-testid={`metric-status-${metric.id}`}
                      >
                        {metric.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'Consolas, monospace', color: '#888', fontSize: '11px' }}>
                      {metric.lastUpdated}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(180deg, #e8e8e8 0%, #d0d0d0 100%)',
          borderTop: '1px solid #a0a0a0',
          padding: '4px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#555'
        }}
      >
        <div style={{ display: 'flex', gap: '24px' }}>
          <span>Variables: {filteredMetrics.length}</span>
          <span>|</span>
          <span style={{ color: '#2e7d32' }}>● Normal: {filteredMetrics.filter(m => m.status === 'normal').length}</span>
          <span style={{ color: '#f57f17' }}>● Warning: {filteredMetrics.filter(m => m.status === 'warning').length}</span>
          <span style={{ color: '#c62828' }}>● Critical: {filteredMetrics.filter(m => m.status === 'critical').length}</span>
        </div>
        <div>
          Variable Tracker v2.1.4 | Memorial General Hospital
        </div>
      </div>
    </div>
  )
}
