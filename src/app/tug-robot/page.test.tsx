import { render, screen, fireEvent, act } from '@testing-library/react'
import TUGRobotDashboard from './page'

jest.useFakeTimers()

describe('TUG Robot Dashboard', () => {
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
      render(<TUGRobotDashboard />)
      expect(screen.getByText('Aethon TUG')).toBeInTheDocument()
      expect(screen.getByText(/Autonomous Mobile Robot/)).toBeInTheDocument()
    })

    it('displays initial robot status as idle', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('robot-status')).toHaveTextContent('idle')
    })

    it('displays initial location as Pharmacy', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('current-location')).toHaveTextContent('Pharmacy')
    })

    it('displays initial battery level', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('battery-level')).toHaveTextContent('78')
    })

    it('displays initial speed as 0', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('speed')).toHaveTextContent('0.0 m/s')
    })

    it('displays initial load weight as 0', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('load-weight')).toHaveTextContent('0 kg')
    })

    it('displays trip count', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('trip-count')).toHaveTextContent('24')
    })

    it('displays total distance', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('total-distance')).toHaveTextContent('3.2')
    })
  })

  describe('Connection Status', () => {
    it('renders connection select', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('connection-select')).toBeInTheDocument()
    })

    it('allows changing connection status', () => {
      render(<TUGRobotDashboard />)
      const select = screen.getByTestId('connection-select')
      fireEvent.change(select, { target: { value: 'weak' } })
      expect(select).toHaveValue('weak')
    })

    it('allows setting offline status', () => {
      render(<TUGRobotDashboard />)
      const select = screen.getByTestId('connection-select')
      fireEvent.change(select, { target: { value: 'offline' } })
      expect(select).toHaveValue('offline')
    })
  })

  describe('Battery Controls', () => {
    it('renders battery slider', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('battery-slider')).toBeInTheDocument()
    })

    it('allows changing battery level', () => {
      render(<TUGRobotDashboard />)
      const slider = screen.getByTestId('battery-slider')
      fireEvent.change(slider, { target: { value: '50' } })
      expect(screen.getByTestId('battery-level')).toHaveTextContent('50')
    })

    it('battery bar shows correct color for high charge', () => {
      render(<TUGRobotDashboard />)
      const bar = screen.getByTestId('battery-bar')
      expect(bar).toHaveClass('bg-green-500')
    })

    it('battery bar shows amber for medium charge', () => {
      render(<TUGRobotDashboard />)
      const slider = screen.getByTestId('battery-slider')
      fireEvent.change(slider, { target: { value: '35' } })
      const bar = screen.getByTestId('battery-bar')
      expect(bar).toHaveClass('bg-amber-500')
    })

    it('battery bar shows red for low charge', () => {
      render(<TUGRobotDashboard />)
      const slider = screen.getByTestId('battery-slider')
      fireEvent.change(slider, { target: { value: '15' } })
      const bar = screen.getByTestId('battery-bar')
      expect(bar).toHaveClass('bg-red-500')
    })
  })

  describe('Obstacle Detection', () => {
    it('renders obstacle toggle', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('obstacle-toggle')).toBeInTheDocument()
    })

    it('shows path clear by default', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('obstacle-status')).toHaveTextContent('Path Clear')
    })

    it('shows obstacle detected when toggled', () => {
      render(<TUGRobotDashboard />)
      const toggle = screen.getByTestId('obstacle-toggle')
      fireEvent.click(toggle)
      expect(screen.getByTestId('obstacle-status')).toHaveTextContent('Obstacle Detected')
    })
  })

  describe('Delivery Queue', () => {
    it('renders delivery queue', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('delivery-queue')).toBeInTheDocument()
    })

    it('displays 4 initial deliveries', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('delivery-DEL-001')).toBeInTheDocument()
      expect(screen.getByTestId('delivery-DEL-002')).toBeInTheDocument()
      expect(screen.getByTestId('delivery-DEL-003')).toBeInTheDocument()
      expect(screen.getByTestId('delivery-DEL-004')).toBeInTheDocument()
    })

    it('shows start buttons for pending deliveries', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('start-DEL-001')).toBeInTheDocument()
      expect(screen.getByTestId('start-DEL-002')).toBeInTheDocument()
    })
  })

  describe('Controls', () => {
    it('renders control buttons', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('complete-btn')).toBeInTheDocument()
      expect(screen.getByTestId('abort-btn')).toBeInTheDocument()
      expect(screen.getByTestId('charge-btn')).toBeInTheDocument()
    })

    it('complete button is disabled when idle', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('complete-btn')).toBeDisabled()
    })

    it('abort button is disabled when idle', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('abort-btn')).toBeDisabled()
    })

    it('charge button is enabled when idle', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('charge-btn')).not.toBeDisabled()
    })

    it('clicking charge button changes status to charging', () => {
      render(<TUGRobotDashboard />)
      fireEvent.click(screen.getByTestId('charge-btn'))
      expect(screen.getByTestId('robot-status')).toHaveTextContent('charging')
    })
  })

  describe('Delivery Workflow', () => {
    it('starting delivery changes status to loading', () => {
      render(<TUGRobotDashboard />)
      fireEvent.click(screen.getByTestId('start-DEL-001'))
      expect(screen.getByTestId('robot-status')).toHaveTextContent('loading')
    })

    it('after loading, status changes to en-route', () => {
      render(<TUGRobotDashboard />)
      fireEvent.click(screen.getByTestId('start-DEL-001'))

      act(() => {
        jest.advanceTimersByTime(2100)
      })

      expect(screen.getByTestId('robot-status')).toHaveTextContent('en route')
    })

    it('destination is shown when en-route', () => {
      render(<TUGRobotDashboard />)
      fireEvent.click(screen.getByTestId('start-DEL-001'))

      act(() => {
        jest.advanceTimersByTime(2100)
      })

      expect(screen.getByTestId('destination')).toHaveTextContent('ICU-3')
    })

    it('start buttons are disabled when robot is busy', () => {
      render(<TUGRobotDashboard />)
      fireEvent.click(screen.getByTestId('start-DEL-001'))

      expect(screen.getByTestId('start-DEL-002')).toBeDisabled()
    })

    it('abort button is enabled when en-route', () => {
      render(<TUGRobotDashboard />)
      fireEvent.click(screen.getByTestId('start-DEL-001'))

      act(() => {
        jest.advanceTimersByTime(2100)
      })

      expect(screen.getByTestId('abort-btn')).not.toBeDisabled()
    })

    it('complete button is enabled when en-route', () => {
      render(<TUGRobotDashboard />)
      fireEvent.click(screen.getByTestId('start-DEL-001'))

      act(() => {
        jest.advanceTimersByTime(2100)
      })

      expect(screen.getByTestId('complete-btn')).not.toBeDisabled()
    })

    it('aborting delivery returns robot to idle', () => {
      render(<TUGRobotDashboard />)
      fireEvent.click(screen.getByTestId('start-DEL-001'))

      act(() => {
        jest.advanceTimersByTime(2100)
      })

      fireEvent.click(screen.getByTestId('abort-btn'))
      expect(screen.getByTestId('robot-status')).toHaveTextContent('idle')
    })

    it('completing delivery changes status to unloading', () => {
      render(<TUGRobotDashboard />)
      fireEvent.click(screen.getByTestId('start-DEL-001'))

      act(() => {
        jest.advanceTimersByTime(2100)
      })

      fireEvent.click(screen.getByTestId('complete-btn'))
      expect(screen.getByTestId('robot-status')).toHaveTextContent('unloading')
    })

    it('after unloading, delivery is removed from queue', () => {
      render(<TUGRobotDashboard />)
      fireEvent.click(screen.getByTestId('start-DEL-001'))

      act(() => {
        jest.advanceTimersByTime(2100)
      })

      fireEvent.click(screen.getByTestId('complete-btn'))

      act(() => {
        jest.advanceTimersByTime(1600)
      })

      expect(screen.queryByTestId('delivery-DEL-001')).not.toBeInTheDocument()
    })

    it('after completion, trip count increases', () => {
      render(<TUGRobotDashboard />)
      fireEvent.click(screen.getByTestId('start-DEL-001'))

      act(() => {
        jest.advanceTimersByTime(2100)
      })

      fireEvent.click(screen.getByTestId('complete-btn'))

      act(() => {
        jest.advanceTimersByTime(1600)
      })

      expect(screen.getByTestId('trip-count')).toHaveTextContent('25')
    })
  })

  describe('Offline Mode', () => {
    it('start buttons are disabled when offline', () => {
      render(<TUGRobotDashboard />)
      const select = screen.getByTestId('connection-select')
      fireEvent.change(select, { target: { value: 'offline' } })

      expect(screen.getByTestId('start-DEL-001')).toBeDisabled()
    })
  })

  describe('Recent Trips', () => {
    it('renders trips table', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('trips-table')).toBeInTheDocument()
    })

    it('displays recent trips', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByTestId('trip-TRP-120')).toBeInTheDocument()
      expect(screen.getByTestId('trip-TRP-119')).toBeInTheDocument()
      expect(screen.getByTestId('trip-TRP-118')).toBeInTheDocument()
      expect(screen.getByTestId('trip-TRP-117')).toBeInTheDocument()
    })
  })

  describe('Footer', () => {
    it('displays version information', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByText('Aethon TUG Fleet Manager v3.2.1')).toBeInTheDocument()
    })

    it('displays facility name', () => {
      render(<TUGRobotDashboard />)
      expect(screen.getByText('Memorial General Hospital')).toBeInTheDocument()
    })
  })
})
