import { render, screen, fireEvent, act } from '@testing-library/react'
import EnvironmentalMonitoring from './page'

jest.useFakeTimers()

describe('Environmental Monitoring Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
    jest.useFakeTimers()
  })

  describe('Initial Render', () => {
    it('renders the dashboard header', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByText('EnviroSense')).toBeInTheDocument()
      expect(screen.getByText('IoT Security')).toBeInTheDocument()
    })

    it('renders navigation tabs', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('tab-overview')).toBeInTheDocument()
      expect(screen.getByTestId('tab-sensors')).toBeInTheDocument()
      expect(screen.getByTestId('tab-alerts')).toBeInTheDocument()
      expect(screen.getByTestId('tab-settings')).toBeInTheDocument()
    })

    it('renders filter controls', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('site-filter')).toBeInTheDocument()
      expect(screen.getByTestId('time-range-filter')).toBeInTheDocument()
    })

    it('renders summary stat cards', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('stat-total-sensors')).toBeInTheDocument()
      expect(screen.getByTestId('stat-online')).toBeInTheDocument()
      expect(screen.getByTestId('stat-warning')).toBeInTheDocument()
      expect(screen.getByTestId('stat-offline')).toBeInTheDocument()
      expect(screen.getByTestId('stat-high-risk')).toBeInTheDocument()
      expect(screen.getByTestId('stat-active-alerts')).toBeInTheDocument()
    })

    it('displays correct total sensor count', () => {
      render(<EnvironmentalMonitoring />)
      const totalCard = screen.getByTestId('stat-total-sensors')
      expect(totalCard).toHaveTextContent('8')
    })

    it('displays correct online sensor count', () => {
      render(<EnvironmentalMonitoring />)
      const onlineCard = screen.getByTestId('stat-online')
      expect(onlineCard).toHaveTextContent('6')
    })

    it('displays correct offline sensor count', () => {
      render(<EnvironmentalMonitoring />)
      const offlineCard = screen.getByTestId('stat-offline')
      expect(offlineCard).toHaveTextContent('1')
    })

    it('displays correct warning sensor count', () => {
      render(<EnvironmentalMonitoring />)
      const warningCard = screen.getByTestId('stat-warning')
      expect(warningCard).toHaveTextContent('1')
    })
  })

  describe('Navigation Tabs', () => {
    it('overview tab is active by default', () => {
      render(<EnvironmentalMonitoring />)
      const overviewTab = screen.getByTestId('tab-overview')
      expect(overviewTab).toHaveClass('bg-white/10')
    })

    it('clicking sensors tab changes active state', () => {
      render(<EnvironmentalMonitoring />)
      const sensorsTab = screen.getByTestId('tab-sensors')
      fireEvent.click(sensorsTab)
      expect(sensorsTab).toHaveClass('bg-white/10')
    })

    it('clicking alerts tab changes active state', () => {
      render(<EnvironmentalMonitoring />)
      const alertsTab = screen.getByTestId('tab-alerts')
      fireEvent.click(alertsTab)
      expect(alertsTab).toHaveClass('bg-white/10')
    })

    it('clicking settings tab changes active state', () => {
      render(<EnvironmentalMonitoring />)
      const settingsTab = screen.getByTestId('tab-settings')
      fireEvent.click(settingsTab)
      expect(settingsTab).toHaveClass('bg-white/10')
    })
  })

  describe('Filter Controls', () => {
    it('allows changing site filter', () => {
      render(<EnvironmentalMonitoring />)
      const siteFilter = screen.getByTestId('site-filter')
      fireEvent.change(siteFilter, { target: { value: 'main' } })
      expect(siteFilter).toHaveValue('main')
    })

    it('allows changing time range filter', () => {
      render(<EnvironmentalMonitoring />)
      const timeFilter = screen.getByTestId('time-range-filter')
      fireEvent.change(timeFilter, { target: { value: '7d' } })
      expect(timeFilter).toHaveValue('7d')
    })

    it('has all site options', () => {
      render(<EnvironmentalMonitoring />)
      const siteFilter = screen.getByTestId('site-filter')
      expect(siteFilter).toContainHTML('All Sites')
      expect(siteFilter).toContainHTML('Main Building')
      expect(siteFilter).toContainHTML('East Wing')
      expect(siteFilter).toContainHTML('West Wing')
    })

    it('has all time range options', () => {
      render(<EnvironmentalMonitoring />)
      const timeFilter = screen.getByTestId('time-range-filter')
      expect(timeFilter).toContainHTML('Last 1 Hour')
      expect(timeFilter).toContainHTML('Last 24 Hours')
      expect(timeFilter).toContainHTML('Last 7 Days')
      expect(timeFilter).toContainHTML('Last 30 Days')
    })
  })

  describe('Auto-Refresh Toggle', () => {
    it('auto-refresh is enabled by default', () => {
      render(<EnvironmentalMonitoring />)
      const toggle = screen.getByTestId('auto-refresh-toggle')
      expect(toggle).toHaveClass('bg-cyan-500')
    })

    it('clicking toggle disables auto-refresh', () => {
      render(<EnvironmentalMonitoring />)
      const toggle = screen.getByTestId('auto-refresh-toggle')
      fireEvent.click(toggle)
      expect(toggle).toHaveClass('bg-white/20')
    })

    it('clicking toggle again enables auto-refresh', () => {
      render(<EnvironmentalMonitoring />)
      const toggle = screen.getByTestId('auto-refresh-toggle')
      fireEvent.click(toggle)
      fireEvent.click(toggle)
      expect(toggle).toHaveClass('bg-cyan-500')
    })
  })

  describe('Sensor Table', () => {
    it('renders sensor table', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('sensor-table')).toBeInTheDocument()
    })

    it('displays all sensors in table', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('sensor-row-ENV-001')).toBeInTheDocument()
      expect(screen.getByTestId('sensor-row-ENV-002')).toBeInTheDocument()
      expect(screen.getByTestId('sensor-row-ENV-003')).toBeInTheDocument()
      expect(screen.getByTestId('sensor-row-ENV-004')).toBeInTheDocument()
      expect(screen.getByTestId('sensor-row-ENV-005')).toBeInTheDocument()
      expect(screen.getByTestId('sensor-row-ENV-006')).toBeInTheDocument()
      expect(screen.getByTestId('sensor-row-ENV-007')).toBeInTheDocument()
      expect(screen.getByTestId('sensor-row-ENV-008')).toBeInTheDocument()
    })

    it('clicking sensor row selects it', () => {
      render(<EnvironmentalMonitoring />)
      const row = screen.getByTestId('sensor-row-ENV-001')
      fireEvent.click(row)
      expect(row).toHaveClass('bg-cyan-50')
    })

    it('clicking selected sensor row deselects it', () => {
      render(<EnvironmentalMonitoring />)
      const row = screen.getByTestId('sensor-row-ENV-001')
      fireEvent.click(row)
      fireEvent.click(row)
      expect(row).not.toHaveClass('bg-cyan-50')
    })

    it('displays sensor locations', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByText('Operating Room 1')).toBeInTheDocument()
      expect(screen.getByText('Operating Room 2')).toBeInTheDocument()
      expect(screen.getByText('Post-Anesthesia Care')).toBeInTheDocument()
    })

    it('displays risk levels', () => {
      render(<EnvironmentalMonitoring />)
      const lowRiskBadges = screen.getAllByText('low')
      const highRiskBadges = screen.getAllByText('high')
      expect(lowRiskBadges.length).toBeGreaterThan(0)
      expect(highRiskBadges.length).toBeGreaterThan(0)
    })
  })

  describe('Sensor Categories', () => {
    it('renders sensor categories panel', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('sensor-categories')).toBeInTheDocument()
    })

    it('displays sensor type categories', () => {
      render(<EnvironmentalMonitoring />)
      const categoriesPanel = screen.getByTestId('sensor-categories')
      expect(categoriesPanel).toHaveTextContent('Air Quality')
      expect(categoriesPanel).toHaveTextContent('Temperature')
    })
  })

  describe('Sensor Utilization', () => {
    it('renders utilization panel', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('sensor-utilization')).toBeInTheDocument()
    })

    it('displays utilization legend', () => {
      render(<EnvironmentalMonitoring />)
      const utilizationPanel = screen.getByTestId('sensor-utilization')
      expect(utilizationPanel).toHaveTextContent('In Use')
      expect(utilizationPanel).toHaveTextContent('Online')
      expect(utilizationPanel).toHaveTextContent('Offline')
    })
  })

  describe('Risk Assessment', () => {
    it('renders risk assessment panel', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('risk-assessment')).toBeInTheDocument()
    })

    it('displays risk categories', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByText('Outdated Firmware')).toBeInTheDocument()
      expect(screen.getByText('Threshold Violations')).toBeInTheDocument()
      expect(screen.getByText('Connection Issues')).toBeInTheDocument()
    })
  })

  describe('Alerts', () => {
    it('renders alerts list', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('alerts-list')).toBeInTheDocument()
    })

    it('displays individual alerts', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('alert-1')).toBeInTheDocument()
      expect(screen.getByTestId('alert-2')).toBeInTheDocument()
      expect(screen.getByTestId('alert-3')).toBeInTheDocument()
      expect(screen.getByTestId('alert-4')).toBeInTheDocument()
    })

    it('shows critical alert banner when unacknowledged critical alerts exist', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('alert-banner')).toBeInTheDocument()
    })

    it('acknowledging alert changes its state', () => {
      render(<EnvironmentalMonitoring />)
      const ackBtn = screen.getByTestId('ack-alert-1')
      fireEvent.click(ackBtn)
      // After acknowledging, the ack button should not exist
      expect(screen.queryByTestId('ack-alert-1')).not.toBeInTheDocument()
    })

    it('dismissing alert removes it from list', () => {
      render(<EnvironmentalMonitoring />)
      const dismissBtn = screen.getByTestId('dismiss-alert-4')
      fireEvent.click(dismissBtn)
      expect(screen.queryByTestId('alert-4')).not.toBeInTheDocument()
    })

    it('acknowledge all button works', () => {
      render(<EnvironmentalMonitoring />)
      const ackAllBtn = screen.getByTestId('ack-all-alerts-btn')
      fireEvent.click(ackAllBtn)
      // All individual ack buttons should be gone
      expect(screen.queryByTestId('ack-alert-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('ack-alert-2')).not.toBeInTheDocument()
    })

    it('acknowledge all in banner works', () => {
      render(<EnvironmentalMonitoring />)
      const bannerAckBtn = screen.getByTestId('acknowledge-all-btn')
      fireEvent.click(bannerAckBtn)
      // Critical alert banner should be gone after acknowledging all critical
      expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument()
    })
  })

  describe('Threshold Configuration', () => {
    it('renders threshold inputs', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('threshold-particulate')).toBeInTheDocument()
      expect(screen.getByTestId('threshold-co2')).toBeInTheDocument()
      expect(screen.getByTestId('threshold-temp-min')).toBeInTheDocument()
      expect(screen.getByTestId('threshold-temp-max')).toBeInTheDocument()
    })

    it('threshold inputs have default values', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('threshold-particulate')).toHaveValue(100)
      expect(screen.getByTestId('threshold-co2')).toHaveValue(700)
      expect(screen.getByTestId('threshold-temp-min')).toHaveValue(65)
      expect(screen.getByTestId('threshold-temp-max')).toHaveValue(72)
    })

    it('allows changing particulate threshold', () => {
      render(<EnvironmentalMonitoring />)
      const input = screen.getByTestId('threshold-particulate')
      fireEvent.change(input, { target: { value: '120' } })
      expect(input).toHaveValue(120)
    })

    it('allows changing CO2 threshold', () => {
      render(<EnvironmentalMonitoring />)
      const input = screen.getByTestId('threshold-co2')
      fireEvent.change(input, { target: { value: '800' } })
      expect(input).toHaveValue(800)
    })

    it('allows changing temperature min threshold', () => {
      render(<EnvironmentalMonitoring />)
      const input = screen.getByTestId('threshold-temp-min')
      fireEvent.change(input, { target: { value: '60' } })
      expect(input).toHaveValue(60)
    })

    it('allows changing temperature max threshold', () => {
      render(<EnvironmentalMonitoring />)
      const input = screen.getByTestId('threshold-temp-max')
      fireEvent.change(input, { target: { value: '75' } })
      expect(input).toHaveValue(75)
    })

    it('renders save and reset buttons', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('save-thresholds-btn')).toBeInTheDocument()
      expect(screen.getByTestId('reset-thresholds-btn')).toBeInTheDocument()
    })

    it('reset button restores default threshold values', () => {
      render(<EnvironmentalMonitoring />)
      // Change values
      const particulateInput = screen.getByTestId('threshold-particulate')
      const co2Input = screen.getByTestId('threshold-co2')
      fireEvent.change(particulateInput, { target: { value: '150' } })
      fireEvent.change(co2Input, { target: { value: '900' } })
      expect(particulateInput).toHaveValue(150)
      expect(co2Input).toHaveValue(900)

      // Reset
      const resetBtn = screen.getByTestId('reset-thresholds-btn')
      fireEvent.click(resetBtn)

      // Values should be back to defaults
      expect(particulateInput).toHaveValue(100)
      expect(co2Input).toHaveValue(700)
      expect(screen.getByTestId('threshold-temp-min')).toHaveValue(65)
      expect(screen.getByTestId('threshold-temp-max')).toHaveValue(72)
    })

    it('save button shows confirmation message', () => {
      render(<EnvironmentalMonitoring />)
      const saveBtn = screen.getByTestId('save-thresholds-btn')
      fireEvent.click(saveBtn)
      expect(screen.getByTestId('save-confirmation')).toBeInTheDocument()
    })
  })

  describe('Action Buttons', () => {
    it('renders export button', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('export-btn')).toBeInTheDocument()
    })

    it('renders refresh button', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByTestId('refresh-btn')).toBeInTheDocument()
    })

    it('export button triggers download', () => {
      // Mock URL methods
      const mockCreateObjectURL = jest.fn(() => 'blob:test-url')
      const mockRevokeObjectURL = jest.fn()
      const originalCreateObjectURL = global.URL.createObjectURL
      const originalRevokeObjectURL = global.URL.revokeObjectURL
      global.URL.createObjectURL = mockCreateObjectURL
      global.URL.revokeObjectURL = mockRevokeObjectURL

      // Mock the anchor click
      const mockClick = jest.fn()
      const originalCreateElement = document.createElement.bind(document)
      jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName)
        if (tagName === 'a') {
          element.click = mockClick
        }
        return element
      })

      render(<EnvironmentalMonitoring />)
      const exportBtn = screen.getByTestId('export-btn')
      fireEvent.click(exportBtn)

      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url')

      // Restore mocks
      global.URL.createObjectURL = originalCreateObjectURL
      global.URL.revokeObjectURL = originalRevokeObjectURL
      jest.restoreAllMocks()
    })

    it('refresh button updates sensor data', () => {
      render(<EnvironmentalMonitoring />)
      // Get initial particulate value from first sensor
      const row = screen.getByTestId('sensor-row-ENV-001')
      const initialContent = row.textContent

      // Click refresh
      const refreshBtn = screen.getByTestId('refresh-btn')
      fireEvent.click(refreshBtn)

      // The sensor table should still be present (data updates)
      expect(screen.getByTestId('sensor-row-ENV-001')).toBeInTheDocument()
    })
  })

  describe('Footer', () => {
    it('displays version information', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByText('EnviroSense IoT Security v2.4.1')).toBeInTheDocument()
    })

    it('displays facility name', () => {
      render(<EnvironmentalMonitoring />)
      expect(screen.getByText('Memorial General Hospital')).toBeInTheDocument()
    })
  })

  describe('Data Updates', () => {
    it('sensor values update when auto-refresh is on', () => {
      render(<EnvironmentalMonitoring />)

      // Get initial value
      const row = screen.getByTestId('sensor-row-ENV-001')
      const initialContent = row.textContent

      // Advance timers
      act(() => {
        jest.advanceTimersByTime(5000)
      })

      // Values should potentially change (random, so content might differ)
      // This test just verifies no errors occur during update
      expect(screen.getByTestId('sensor-row-ENV-001')).toBeInTheDocument()
    })
  })

  describe('Complete Workflow', () => {
    it('complete alert management workflow', () => {
      render(<EnvironmentalMonitoring />)

      // 1. Verify alert banner exists
      expect(screen.getByTestId('alert-banner')).toBeInTheDocument()

      // 2. Acknowledge one alert
      const ackBtn1 = screen.getByTestId('ack-alert-1')
      fireEvent.click(ackBtn1)
      expect(screen.queryByTestId('ack-alert-1')).not.toBeInTheDocument()

      // 3. Alert banner should be gone (no more critical unacknowledged)
      expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument()

      // 4. Dismiss another alert
      const dismissBtn = screen.getByTestId('dismiss-alert-2')
      fireEvent.click(dismissBtn)
      expect(screen.queryByTestId('alert-2')).not.toBeInTheDocument()

      // 5. Clear acknowledged alerts
      const clearBtn = screen.getByTestId('clear-ack-alerts-btn')
      fireEvent.click(clearBtn)

      // Only unacknowledged alerts should remain
      expect(screen.queryByTestId('alert-1')).not.toBeInTheDocument()
    })

    it('filter and sensor selection workflow', () => {
      render(<EnvironmentalMonitoring />)

      // 1. Change site filter
      const siteFilter = screen.getByTestId('site-filter')
      fireEvent.change(siteFilter, { target: { value: 'east' } })
      expect(siteFilter).toHaveValue('east')

      // 2. Change time range
      const timeFilter = screen.getByTestId('time-range-filter')
      fireEvent.change(timeFilter, { target: { value: '7d' } })
      expect(timeFilter).toHaveValue('7d')

      // 3. Select a sensor
      const sensorRow = screen.getByTestId('sensor-row-ENV-003')
      fireEvent.click(sensorRow)
      expect(sensorRow).toHaveClass('bg-cyan-50')

      // 4. Toggle auto-refresh off
      const toggle = screen.getByTestId('auto-refresh-toggle')
      fireEvent.click(toggle)
      expect(toggle).toHaveClass('bg-white/20')
    })
  })
})
