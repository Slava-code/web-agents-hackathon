import { render, screen, fireEvent, act } from '@testing-library/react'
import UVRobotPortal from './page'

// Mock timers for cycle progress simulation
jest.useFakeTimers()

describe('UV Robot Portal - Minimal Dashboard', () => {
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
    it('renders the dashboard with header', () => {
      render(<UVRobotPortal />)
      expect(screen.getByText('UltraClean')).toBeInTheDocument()
      expect(screen.getByText('UV-C Disinfection System')).toBeInTheDocument()
    })

    it('displays device serial number', () => {
      render(<UVRobotPortal />)
      expect(screen.getByText('UVC-2019-4721')).toBeInTheDocument()
    })

    it('shows initial room selection as OR-1', () => {
      render(<UVRobotPortal />)
      const roomSelector = screen.getByTestId('room-selector')
      expect(roomSelector).toHaveValue('OR-1')
    })

    it('shows initial progress as 0', () => {
      render(<UVRobotPortal />)
      const progressValue = screen.getByTestId('progress-value')
      expect(progressValue).toHaveTextContent('00')
    })

    it('shows initial battery level as 87%', () => {
      render(<UVRobotPortal />)
      const batteryText = screen.getByTestId('battery-level-text')
      expect(batteryText).toHaveTextContent('87%')
    })

    it('shows initial connection status as connected', () => {
      render(<UVRobotPortal />)
      const connectionSelect = screen.getByTestId('connection-status-select')
      expect(connectionSelect).toHaveValue('connected')
    })

    it('shows standard mode selected by default', () => {
      render(<UVRobotPortal />)
      const standardMode = screen.getByTestId('mode-standard') as HTMLInputElement
      expect(standardMode.checked).toBe(true)
    })

    it('shows initial intensity as 85', () => {
      render(<UVRobotPortal />)
      const intensityValue = screen.getByTestId('intensity-value')
      expect(intensityValue).toHaveTextContent('85')
    })

    it('displays cycle history with 4 initial records', () => {
      render(<UVRobotPortal />)
      const historyTable = screen.getByTestId('cycle-history-table')
      expect(historyTable).toBeInTheDocument()
      expect(screen.getByTestId('history-row-0')).toBeInTheDocument()
      expect(screen.getByTestId('history-row-3')).toBeInTheDocument()
    })
  })

  describe('Room Selection', () => {
    it('allows selecting different rooms', () => {
      render(<UVRobotPortal />)
      const roomSelector = screen.getByTestId('room-selector')
      fireEvent.change(roomSelector, { target: { value: 'OR-3' } })
      expect(roomSelector).toHaveValue('OR-3')
      expect(screen.getByTestId('display-room')).toHaveTextContent('OR-3')
    })

    it('has all 8 rooms available', () => {
      render(<UVRobotPortal />)
      const roomSelector = screen.getByTestId('room-selector')
      const options = roomSelector.querySelectorAll('option')
      expect(options.length).toBe(8)
    })

    it('disables room selection during active cycle', () => {
      render(<UVRobotPortal />)
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      const roomSelector = screen.getByTestId('room-selector')
      expect(roomSelector).toBeDisabled()
    })
  })

  describe('Cycle Mode Selection', () => {
    it('allows selecting high mode', () => {
      render(<UVRobotPortal />)
      const highMode = screen.getByTestId('mode-high')
      fireEvent.click(highMode)
      expect((highMode as HTMLInputElement).checked).toBe(true)
      expect(screen.getByTestId('display-mode')).toHaveTextContent('high')
    })

    it('allows selecting terminal mode', () => {
      render(<UVRobotPortal />)
      const terminalMode = screen.getByTestId('mode-terminal')
      fireEvent.click(terminalMode)
      expect((terminalMode as HTMLInputElement).checked).toBe(true)
      expect(screen.getByTestId('display-mode')).toHaveTextContent('terminal')
    })

    it('disables mode selection during active cycle', () => {
      render(<UVRobotPortal />)
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      const highMode = screen.getByTestId('mode-high')
      expect(highMode).toBeDisabled()
    })
  })

  describe('UV Intensity Control', () => {
    it('allows adjusting intensity via slider', () => {
      render(<UVRobotPortal />)
      const intensitySlider = screen.getByTestId('intensity-slider')
      fireEvent.change(intensitySlider, { target: { value: '95' } })
      expect(screen.getByTestId('intensity-value')).toHaveTextContent('95')
      expect(screen.getByTestId('display-intensity')).toHaveTextContent('95%')
    })

    it('disables intensity slider during active cycle', () => {
      render(<UVRobotPortal />)
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      const intensitySlider = screen.getByTestId('intensity-slider')
      expect(intensitySlider).toBeDisabled()
    })
  })

  describe('Battery Controls', () => {
    it('updates battery level via slider', () => {
      render(<UVRobotPortal />)
      const batterySlider = screen.getByTestId('battery-slider')
      fireEvent.change(batterySlider, { target: { value: '50' } })
      expect(screen.getByTestId('battery-level-text')).toHaveTextContent('50%')
    })

    it('shows correct color for battery > 50%', () => {
      render(<UVRobotPortal />)
      const batteryBar = screen.getByTestId('battery-level-bar')
      expect(batteryBar).toHaveClass('bg-[var(--accent)]')
    })

    it('shows amber color for battery 21-50%', () => {
      render(<UVRobotPortal />)
      const batterySlider = screen.getByTestId('battery-slider')
      fireEvent.change(batterySlider, { target: { value: '35' } })
      const batteryBar = screen.getByTestId('battery-level-bar')
      expect(batteryBar).toHaveClass('bg-amber-400')
    })

    it('shows danger color for battery <= 20%', () => {
      render(<UVRobotPortal />)
      const batterySlider = screen.getByTestId('battery-slider')
      fireEvent.change(batterySlider, { target: { value: '15' } })
      const batteryBar = screen.getByTestId('battery-level-bar')
      expect(batteryBar).toHaveClass('bg-[var(--danger)]')
    })
  })

  describe('Connection Status', () => {
    it('allows changing connection status', () => {
      render(<UVRobotPortal />)
      const connectionSelect = screen.getByTestId('connection-status-select')
      fireEvent.change(connectionSelect, { target: { value: 'weak' } })
      expect(connectionSelect).toHaveValue('weak')
    })

    it('shows Online indicator when connected', () => {
      render(<UVRobotPortal />)
      expect(screen.getByText('Online')).toBeInTheDocument()
    })

    it('shows Weak indicator when weak', () => {
      render(<UVRobotPortal />)
      const connectionSelect = screen.getByTestId('connection-status-select')
      fireEvent.change(connectionSelect, { target: { value: 'weak' } })
      expect(screen.getByText('Weak')).toBeInTheDocument()
    })

    it('shows Offline indicator when disconnected', () => {
      render(<UVRobotPortal />)
      const connectionSelect = screen.getByTestId('connection-status-select')
      fireEvent.change(connectionSelect, { target: { value: 'disconnected' } })
      expect(screen.getByText('Offline')).toBeInTheDocument()
    })

    it('disables start cycle button when disconnected', () => {
      render(<UVRobotPortal />)
      const connectionSelect = screen.getByTestId('connection-status-select')
      fireEvent.change(connectionSelect, { target: { value: 'disconnected' } })
      const startBtn = screen.getByTestId('start-cycle-btn')
      expect(startBtn).toBeDisabled()
    })

    it('updates status bar connection indicator', () => {
      render(<UVRobotPortal />)
      const connectionSelect = screen.getByTestId('connection-status-select')
      fireEvent.change(connectionSelect, { target: { value: 'disconnected' } })
      const statusBar = screen.getByTestId('status-bar-connection')
      expect(statusBar).toHaveTextContent('System Offline')
    })
  })

  describe('Device Health', () => {
    it('allows changing device health status', () => {
      render(<UVRobotPortal />)
      const healthSelect = screen.getByTestId('device-health-select')
      fireEvent.change(healthSelect, { target: { value: 'warning' } })
      expect(healthSelect).toHaveValue('warning')
    })

    it('displays lamp hours', () => {
      render(<UVRobotPortal />)
      expect(screen.getByTestId('lamp-hours')).toHaveTextContent('1247')
    })
  })

  describe('Cycle Control - Start Cycle', () => {
    it('starts cycle when start button clicked', () => {
      render(<UVRobotPortal />)
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      expect(screen.getByTestId('cycle-status')).toHaveTextContent('disinfecting')
    })

    it('shows Running on start button during cycle', () => {
      render(<UVRobotPortal />)
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      expect(startBtn).toHaveTextContent('Running')
    })

    it('disables start button during active cycle', () => {
      render(<UVRobotPortal />)
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      expect(startBtn).toBeDisabled()
    })

    it('enables abort button during active cycle', () => {
      render(<UVRobotPortal />)
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      const abortBtn = screen.getByTestId('abort-cycle-btn')
      expect(abortBtn).not.toBeDisabled()
    })

    it('progress increases during cycle', () => {
      render(<UVRobotPortal />)
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      act(() => {
        jest.advanceTimersByTime(600)
      })
      const progressValue = screen.getByTestId('progress-value')
      expect(progressValue.textContent).not.toBe('00')
    })
  })

  describe('Cycle Control - Abort Cycle', () => {
    it('abort button is disabled when no cycle is active', () => {
      render(<UVRobotPortal />)
      const abortBtn = screen.getByTestId('abort-cycle-btn')
      expect(abortBtn).toBeDisabled()
    })

    it('aborts cycle when abort button clicked', () => {
      render(<UVRobotPortal />)
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      act(() => {
        jest.advanceTimersByTime(600)
      })
      const abortBtn = screen.getByTestId('abort-cycle-btn')
      fireEvent.click(abortBtn)
      expect(screen.getByTestId('cycle-status')).toHaveTextContent('standby')
      expect(screen.getByTestId('progress-value')).toHaveTextContent('00')
    })

    it('re-enables start button after abort', () => {
      render(<UVRobotPortal />)
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      const abortBtn = screen.getByTestId('abort-cycle-btn')
      fireEvent.click(abortBtn)
      expect(startBtn).not.toBeDisabled()
    })
  })

  describe('Emergency Stop', () => {
    it('emergency stop aborts active cycle', () => {
      render(<UVRobotPortal />)
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      act(() => {
        jest.advanceTimersByTime(300)
      })
      const emergencyBtn = screen.getByTestId('emergency-stop-btn')
      fireEvent.click(emergencyBtn)
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('EMERGENCY STOP'))
      expect(screen.getByTestId('cycle-status')).toHaveTextContent('standby')
    })

    it('emergency stop does nothing when no cycle active', () => {
      render(<UVRobotPortal />)
      const emergencyBtn = screen.getByTestId('emergency-stop-btn')
      fireEvent.click(emergencyBtn)
      expect(global.alert).not.toHaveBeenCalled()
    })
  })

  describe('Cycle History', () => {
    it('adds aborted cycle to history', () => {
      render(<UVRobotPortal />)
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      act(() => {
        jest.advanceTimersByTime(900)
      })
      const abortBtn = screen.getByTestId('abort-cycle-btn')
      fireEvent.click(abortBtn)
      // Should show 5 history items now
      expect(screen.getByText('5 cycles')).toBeInTheDocument()
    })
  })

  describe('History Log Buttons', () => {
    it('export log button is rendered', () => {
      render(<UVRobotPortal />)
      expect(screen.getByTestId('export-log-btn')).toBeInTheDocument()
    })

    it('print log button is rendered', () => {
      render(<UVRobotPortal />)
      expect(screen.getByTestId('print-log-btn')).toBeInTheDocument()
    })

    it('clear log button is rendered', () => {
      render(<UVRobotPortal />)
      expect(screen.getByTestId('clear-log-btn')).toBeInTheDocument()
    })
  })

  describe('Display Panel Updates', () => {
    it('display panel shows current settings', () => {
      render(<UVRobotPortal />)
      expect(screen.getByTestId('display-room')).toHaveTextContent('OR-1')
      expect(screen.getByTestId('display-mode')).toHaveTextContent('standard')
      expect(screen.getByTestId('display-intensity')).toHaveTextContent('85%')
    })

    it('display panel updates when room changes', () => {
      render(<UVRobotPortal />)
      const roomSelector = screen.getByTestId('room-selector')
      fireEvent.change(roomSelector, { target: { value: 'PACU-1' } })
      expect(screen.getByTestId('display-room')).toHaveTextContent('PACU-1')
    })

    it('display panel updates when mode changes', () => {
      render(<UVRobotPortal />)
      const terminalMode = screen.getByTestId('mode-terminal')
      fireEvent.click(terminalMode)
      expect(screen.getByTestId('display-mode')).toHaveTextContent('terminal')
    })

    it('display panel updates when intensity changes', () => {
      render(<UVRobotPortal />)
      const intensitySlider = screen.getByTestId('intensity-slider')
      fireEvent.change(intensitySlider, { target: { value: '100' } })
      expect(screen.getByTestId('display-intensity')).toHaveTextContent('100%')
    })
  })

  describe('Complete Workflow Test', () => {
    it('completes a full cycle workflow', () => {
      render(<UVRobotPortal />)

      // 1. Select room
      const roomSelector = screen.getByTestId('room-selector')
      fireEvent.change(roomSelector, { target: { value: 'OR-3' } })
      expect(screen.getByTestId('display-room')).toHaveTextContent('OR-3')

      // 2. Select mode
      const highMode = screen.getByTestId('mode-high')
      fireEvent.click(highMode)
      expect(screen.getByTestId('display-mode')).toHaveTextContent('high')

      // 3. Adjust intensity
      const intensitySlider = screen.getByTestId('intensity-slider')
      fireEvent.change(intensitySlider, { target: { value: '95' } })
      expect(screen.getByTestId('display-intensity')).toHaveTextContent('95%')

      // 4. Start cycle
      const startBtn = screen.getByTestId('start-cycle-btn')
      fireEvent.click(startBtn)
      expect(screen.getByTestId('cycle-status')).toHaveTextContent('disinfecting')

      // 5. Verify controls are disabled
      expect(roomSelector).toBeDisabled()
      expect(highMode).toBeDisabled()
      expect(intensitySlider).toBeDisabled()

      // 6. Abort cycle
      const abortBtn = screen.getByTestId('abort-cycle-btn')
      fireEvent.click(abortBtn)

      // 7. Verify controls are re-enabled
      expect(roomSelector).not.toBeDisabled()
    })
  })
})
