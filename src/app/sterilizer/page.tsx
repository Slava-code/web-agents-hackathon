'use client'

import { useState } from 'react'

interface TrayRecord {
  trayId: string
  description: string
  sterilizerId: string
  cycleNumber: string
  loadDate: string
  loadTime: string
  operator: string
  status: 'Pass' | 'Fail' | 'Pending' | 'In Progress'
  expirationDate: string
  biIndicator: 'Pass' | 'Fail' | 'N/A' | 'Pending'
}

export default function SterilizerSystem() {
  const [records, setRecords] = useState<TrayRecord[]>([
    { trayId: 'TRY-20240115-001', description: 'General Surgery Set A', sterilizerId: 'STER-01', cycleNumber: '4521', loadDate: '01/15/2024', loadTime: '08:32:15', operator: 'J. Smith', status: 'Pass', expirationDate: '01/15/2025', biIndicator: 'Pass' },
    { trayId: 'TRY-20240115-002', description: 'Orthopedic Instruments', sterilizerId: 'STER-02', cycleNumber: '3892', loadDate: '01/15/2024', loadTime: '08:45:22', operator: 'M. Johnson', status: 'Pass', expirationDate: '01/15/2025', biIndicator: 'Pass' },
    { trayId: 'TRY-20240115-003', description: 'Cardiac Surgery Kit', sterilizerId: 'STER-01', cycleNumber: '4522', loadDate: '01/15/2024', loadTime: '09:12:08', operator: 'J. Smith', status: 'In Progress', expirationDate: '-', biIndicator: 'Pending' },
    { trayId: 'TRY-20240115-004', description: 'Laparoscopic Set', sterilizerId: 'STER-03', cycleNumber: '2156', loadDate: '01/15/2024', loadTime: '09:30:45', operator: 'R. Williams', status: 'Fail', expirationDate: '-', biIndicator: 'Fail' },
    { trayId: 'TRY-20240115-005', description: 'ENT Instrument Set', sterilizerId: 'STER-02', cycleNumber: '3893', loadDate: '01/15/2024', loadTime: '10:05:33', operator: 'M. Johnson', status: 'Pass', expirationDate: '01/15/2025', biIndicator: 'N/A' },
    { trayId: 'TRY-20240115-006', description: 'Neuro Surgery Kit', sterilizerId: 'STER-01', cycleNumber: '4523', loadDate: '01/15/2024', loadTime: '10:22:17', operator: 'J. Smith', status: 'Pending', expirationDate: '-', biIndicator: 'Pending' },
    { trayId: 'TRY-20240115-007', description: 'Emergency Tray C', sterilizerId: 'STER-03', cycleNumber: '2157', loadDate: '01/15/2024', loadTime: '10:45:09', operator: 'R. Williams', status: 'Pass', expirationDate: '01/15/2025', biIndicator: 'Pass' },
    { trayId: 'TRY-20240115-008', description: 'OB/GYN Set B', sterilizerId: 'STER-02', cycleNumber: '3894', loadDate: '01/15/2024', loadTime: '11:08:44', operator: 'M. Johnson', status: 'Pass', expirationDate: '01/15/2025', biIndicator: 'Pass' },
  ])

  const [filters, setFilters] = useState({
    sterilizer: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    trayId: '',
    operator: 'all',
  })

  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [sortColumn, setSortColumn] = useState<keyof TrayRecord>('loadTime')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const operators = ['J. Smith', 'M. Johnson', 'R. Williams', 'A. Brown', 'S. Davis']
  const sterilizers = ['STER-01', 'STER-02', 'STER-03', 'STER-04']

  const filteredRecords = records.filter(r => {
    if (filters.sterilizer !== 'all' && r.sterilizerId !== filters.sterilizer) return false
    if (filters.status !== 'all' && r.status !== filters.status) return false
    if (filters.operator !== 'all' && r.operator !== filters.operator) return false
    if (filters.trayId && !r.trayId.toLowerCase().includes(filters.trayId.toLowerCase())) return false
    return true
  })

  const sortedRecords = [...filteredRecords].sort((a, b) => {
    const aVal = a[sortColumn]
    const bVal = b[sortColumn]
    if (sortDirection === 'asc') return aVal < bVal ? -1 : 1
    return aVal > bVal ? -1 : 1
  })

  const paginatedRecords = sortedRecords.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage)

  const handleSort = (column: keyof TrayRecord) => {
    if (sortColumn === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const handleSelectAll = () => {
    if (selectedRows.length === paginatedRecords.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(paginatedRecords.map(r => r.trayId))
    }
  }

  const handleSelectRow = (trayId: string) => {
    setSelectedRows(prev =>
      prev.includes(trayId)
        ? prev.filter(id => id !== trayId)
        : [...prev, trayId]
    )
  }

  const handlePrintLabels = () => {
    alert(`Printing labels for ${selectedRows.length} selected tray(s)`)
  }

  const handleExport = () => {
    alert('Exporting records to CSV...')
  }

  const handleReprocess = () => {
    if (selectedRows.length > 0) {
      setRecords(prev => prev.map(r =>
        selectedRows.includes(r.trayId) && r.status === 'Fail'
          ? { ...r, status: 'Pending' as const, biIndicator: 'Pending' as const }
          : r
      ))
      setSelectedRows([])
    }
  }

  return (
    <div className="min-h-screen bg-[#e8e8e8] legacy-scrollbar" style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}>
      {/* Old-school header bar */}
      <div className="bg-gradient-to-b from-[#4a6fa5] to-[#3a5a8a] text-white px-4 py-2 border-b-2 border-[#2a4a7a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Crect fill='%23fff' width='32' height='32' rx='4'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-size='14' font-weight='bold' fill='%234a6fa5'%3ECSD%3C/text%3E%3C/svg%3E"
              alt="Logo"
              className="w-8 h-8"
            />
            <div>
              <h1 className="text-lg font-bold" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>
                CentralSterile Pro v4.2.1
              </h1>
              <p className="text-xs opacity-80">Sterilization Tracking & Compliance System</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span>User: ADMIN01</span>
            <span>|</span>
            <span>Facility: Memorial General Hospital</span>
            <span>|</span>
            <span>{new Date().toLocaleDateString()}</span>
            <button className="ml-4 bg-[#c41e3a] hover:bg-[#a01830] px-3 py-1 rounded border border-[#8a1428]">
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Navigation tabs - old style */}
      <div className="bg-[#d4d4d4] border-b border-[#999] px-4">
        <div className="flex">
          {['Tray Tracking', 'Cycle History', 'BI Results', 'Equipment Status', 'Reports', 'Administration'].map((tab, i) => (
            <button
              key={tab}
              className={`px-4 py-2 text-xs font-bold border-t border-l border-r ${
                i === 0
                  ? 'bg-white border-[#999] -mb-px relative z-10'
                  : 'bg-[#c0c0c0] border-[#999] hover:bg-[#d0d0d0]'
              }`}
              style={{ marginRight: '-1px' }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* Filter Panel - old fieldset style */}
        <fieldset className="border-2 border-[#999] bg-white p-4 mb-4">
          <legend className="text-xs font-bold px-2 text-[#333]">Search Filters</legend>

          <div className="grid grid-cols-6 gap-4 text-xs">
            <div>
              <label className="block mb-1 font-bold">Sterilizer:</label>
              <select
                value={filters.sterilizer}
                onChange={(e) => setFilters(f => ({ ...f, sterilizer: e.target.value }))}
                className="w-full border border-[#7f9db9] p-1 bg-white"
              >
                <option value="all">-- All --</option>
                {sterilizers.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-bold">Status:</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-[#7f9db9] p-1 bg-white"
              >
                <option value="all">-- All --</option>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
              </select>
            </div>

            <div>
              <label className="block mb-1 font-bold">Operator:</label>
              <select
                value={filters.operator}
                onChange={(e) => setFilters(f => ({ ...f, operator: e.target.value }))}
                className="w-full border border-[#7f9db9] p-1 bg-white"
              >
                <option value="all">-- All --</option>
                {operators.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-bold">Date From:</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                className="w-full border border-[#7f9db9] p-1"
              />
            </div>

            <div>
              <label className="block mb-1 font-bold">Date To:</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                className="w-full border border-[#7f9db9] p-1"
              />
            </div>

            <div>
              <label className="block mb-1 font-bold">Tray ID:</label>
              <input
                type="text"
                value={filters.trayId}
                onChange={(e) => setFilters(f => ({ ...f, trayId: e.target.value }))}
                placeholder="Enter Tray ID..."
                className="w-full border border-[#7f9db9] p-1"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button className="px-4 py-1 bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] border border-[#999] text-xs font-bold hover:from-[#e0e0e0] hover:to-[#c0c0c0]">
              Apply Filters
            </button>
            <button
              onClick={() => setFilters({ sterilizer: 'all', status: 'all', dateFrom: '', dateTo: '', trayId: '', operator: 'all' })}
              className="px-4 py-1 bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] border border-[#999] text-xs font-bold hover:from-[#e0e0e0] hover:to-[#c0c0c0]"
            >
              Clear Filters
            </button>
          </div>
        </fieldset>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={handlePrintLabels}
            disabled={selectedRows.length === 0}
            className="px-4 py-2 bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] border border-[#999] text-xs font-bold hover:from-[#e0e0e0] hover:to-[#c0c0c0] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <span>🖨️</span> Print Labels
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] border border-[#999] text-xs font-bold hover:from-[#e0e0e0] hover:to-[#c0c0c0] flex items-center gap-1"
          >
            <span>📊</span> Export to Excel
          </button>
          <button
            onClick={handleReprocess}
            disabled={selectedRows.length === 0}
            className="px-4 py-2 bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] border border-[#999] text-xs font-bold hover:from-[#e0e0e0] hover:to-[#c0c0c0] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <span>🔄</span> Reprocess Selected
          </button>
          <button className="px-4 py-2 bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] border border-[#999] text-xs font-bold hover:from-[#e0e0e0] hover:to-[#c0c0c0] flex items-center gap-1">
            <span>➕</span> New Tray Entry
          </button>
          <button className="px-4 py-2 bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] border border-[#999] text-xs font-bold hover:from-[#e0e0e0] hover:to-[#c0c0c0] flex items-center gap-1">
            <span>🔍</span> View Details
          </button>
        </div>

        {/* Data Table */}
        <div className="border-2 border-[#999] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-b from-[#e8e8e8] to-[#d0d0d0]">
                <th className="border border-[#999] p-2 w-8">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === paginatedRecords.length && paginatedRecords.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                {[
                  { key: 'trayId', label: 'Tray ID' },
                  { key: 'description', label: 'Description' },
                  { key: 'sterilizerId', label: 'Sterilizer' },
                  { key: 'cycleNumber', label: 'Cycle #' },
                  { key: 'loadDate', label: 'Load Date' },
                  { key: 'loadTime', label: 'Load Time' },
                  { key: 'operator', label: 'Operator' },
                  { key: 'status', label: 'Status' },
                  { key: 'biIndicator', label: 'BI Result' },
                  { key: 'expirationDate', label: 'Expiration' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key as keyof TrayRecord)}
                    className="border border-[#999] p-2 text-left cursor-pointer hover:bg-[#c0c0c0]"
                  >
                    {col.label}
                    {sortColumn === col.key && (
                      <span className="ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.map((record, i) => (
                <tr
                  key={record.trayId}
                  className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#f4f4f4]'} hover:bg-[#ffffcc]`}
                >
                  <td className="border border-[#ccc] p-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(record.trayId)}
                      onChange={() => handleSelectRow(record.trayId)}
                    />
                  </td>
                  <td className="border border-[#ccc] p-2 font-mono">{record.trayId}</td>
                  <td className="border border-[#ccc] p-2">{record.description}</td>
                  <td className="border border-[#ccc] p-2">{record.sterilizerId}</td>
                  <td className="border border-[#ccc] p-2">{record.cycleNumber}</td>
                  <td className="border border-[#ccc] p-2">{record.loadDate}</td>
                  <td className="border border-[#ccc] p-2">{record.loadTime}</td>
                  <td className="border border-[#ccc] p-2">{record.operator}</td>
                  <td className="border border-[#ccc] p-2">
                    <span className={`px-2 py-0.5 text-xs font-bold ${
                      record.status === 'Pass' ? 'bg-[#90ee90] text-[#006400]' :
                      record.status === 'Fail' ? 'bg-[#ffcccb] text-[#8b0000]' :
                      record.status === 'In Progress' ? 'bg-[#add8e6] text-[#00008b]' :
                      'bg-[#fffacd] text-[#8b8000]'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="border border-[#ccc] p-2">
                    <span className={`px-2 py-0.5 text-xs font-bold ${
                      record.biIndicator === 'Pass' ? 'bg-[#90ee90] text-[#006400]' :
                      record.biIndicator === 'Fail' ? 'bg-[#ffcccb] text-[#8b0000]' :
                      record.biIndicator === 'N/A' ? 'bg-[#ddd] text-[#666]' :
                      'bg-[#fffacd] text-[#8b8000]'
                    }`}>
                      {record.biIndicator}
                    </span>
                  </td>
                  <td className="border border-[#ccc] p-2">{record.expirationDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination - old style */}
        <div className="mt-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(parseInt(e.target.value))
                setCurrentPage(1)
              }}
              className="border border-[#999] p-1 bg-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="ml-4">
              Showing {((currentPage - 1) * rowsPerPage) + 1} - {Math.min(currentPage * rowsPerPage, filteredRecords.length)} of {filteredRecords.length} records
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] border border-[#999] disabled:opacity-50"
            >
              |◀
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] border border-[#999] disabled:opacity-50"
            >
              ◀
            </button>
            <span className="px-4">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] border border-[#999] disabled:opacity-50"
            >
              ▶
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0] border border-[#999] disabled:opacity-50"
            >
              ▶|
            </button>
          </div>
        </div>

        {/* Status Bar - old Windows style */}
        <div className="mt-4 bg-[#e8e8e8] border-t-2 border-[#fff] border-b-2 border-b-[#999] px-2 py-1 flex justify-between text-xs text-[#333]">
          <span>Ready</span>
          <span>Selected: {selectedRows.length} tray(s)</span>
          <span>Last Updated: {new Date().toLocaleTimeString()}</span>
          <span>Database: STERILE_PROD</span>
        </div>
      </div>
    </div>
  )
}
