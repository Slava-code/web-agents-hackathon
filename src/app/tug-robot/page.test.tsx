import { render, screen, fireEvent, act } from '@testing-library/react'
import TUGDashboard from './page'

jest.useFakeTimers()

describe('TUG Fleet Dashboard', () => {
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
      render(<TUGDashboard />)
      expect(screen.getByText('TUG Fleet Monitor')).toBeInTheDocument()
      expect(screen.getByText('OR → Sterilization Transport')).toBeInTheDocument()
    })

    it('displays all 4 bots', () => {
      render(<TUGDashboard />)
      expect(screen.getByTestId('bot-row-TUG-01')).toBeInTheDocument()
      expect(screen.getByTestId('bot-row-TUG-02')).toBeInTheDocument()
      expect(screen.getByTestId('bot-row-TUG-03')).toBeInTheDocument()
      expect(screen.getByTestId('bot-row-TUG-04')).toBeInTheDocument()
    })

    it('displays active count', () => {
      render(<TUGDashboard />)
      expect(screen.getByTestId('active-count')).toHaveTextContent('2 / 4')
    })

    it('displays trip count', () => {
      render(<TUGDashboard />)
      expect(screen.getByTestId('trip-count')).toHaveTextContent('47')
    })
  })

  describe('Bot Status Display', () => {
    it('shows correct status for each bot', () => {
      render(<TUGDashboard />)
      expect(screen.getByTestId('bot-status-TUG-01')).toHaveTextContent('IDLE')
      expect(screen.getByTestId('bot-status-TUG-02')).toHaveTextContent('EN ROUTE')
      expect(screen.getByTestId('bot-status-TUG-03')).toHaveTextContent('IDLE')
      expect(screen.getByTestId('bot-status-TUG-04')).toHaveTextContent('RETURNING')
    })

    it('shows source for each bot', () => {
      render(<TUGDashboard />)
      expect(screen.getByTestId('bot-source-TUG-01')).toHaveTextContent('OR-1')
      expect(screen.getByTestId('bot-source-TUG-02')).toHaveTextContent('OR-3')
      expect(screen.getByTestId('bot-source-TUG-03')).toHaveTextContent('OR-2')
      expect(screen.getByTestId('bot-source-TUG-04')).toHaveTextContent('OR-4')
    })

    it('shows battery levels', () => {
      render(<TUGDashboard />)
      expect(screen.getByTestId('bot-battery-TUG-01')).toHaveTextContent('94%')
      expect(screen.getByTestId('bot-battery-TUG-02')).toHaveTextContent('78%')
    })
  })

  describe('Deploy Action', () => {
    it('shows deploy button for IDLE bots', () => {
      render(<TUGDashboard />)
      expect(screen.getByTestId('deploy-btn-TUG-01')).toBeInTheDocument()
      expect(screen.getByTestId('deploy-btn-TUG-03')).toBeInTheDocument()
    })

    it('does not show deploy button for active bots', () => {
      render(<TUGDashboard />)
      expect(screen.queryByTestId('deploy-btn-TUG-02')).not.toBeInTheDocument()
      expect(screen.queryByTestId('deploy-btn-TUG-04')).not.toBeInTheDocument()
    })

    it('deploying a bot changes its status to EN_ROUTE', () => {
      render(<TUGDashboard />)
      fireEvent.click(screen.getByTestId('deploy-btn-TUG-01'))
      expect(screen.getByTestId('bot-status-TUG-01')).toHaveTextContent('EN ROUTE')
    })

    it('deploy button has correct text', () => {
      render(<TUGDashboard />)
      expect(screen.getByTestId('deploy-btn-TUG-01')).toHaveTextContent('Deploy to Sterilization')
    })
  })

  describe('Progress Tracking', () => {
    it('shows progress bar for EN_ROUTE bots', () => {
      render(<TUGDashboard />)
      expect(screen.getByTestId('bot-progress-TUG-02')).toBeInTheDocument()
    })

    it('progress increases over time for EN_ROUTE bots', () => {
      render(<TUGDashboard />)
      const initialProgress = screen.getByTestId('bot-progress-TUG-02').style.width

      act(() => {
        jest.advanceTimersByTime(600)
      })

      const newProgress = screen.getByTestId('bot-progress-TUG-02').style.width
      expect(newProgress).not.toBe(initialProgress)
    })

    it('bot transitions to ARRIVED when progress reaches 100', () => {
      render(<TUGDashboard />)
      fireEvent.click(screen.getByTestId('deploy-btn-TUG-01'))

      // Progress to 100% (50 steps * 200ms = 10000ms)
      act(() => {
        jest.advanceTimersByTime(10200)
      })

      expect(screen.getByTestId('bot-status-TUG-01')).toHaveTextContent('ARRIVED')
    })
  })

  describe('Return Action', () => {
    it('shows return button for ARRIVED bots', () => {
      render(<TUGDashboard />)
      fireEvent.click(screen.getByTestId('deploy-btn-TUG-01'))

      act(() => {
        jest.advanceTimersByTime(10200)
      })

      expect(screen.getByTestId('return-btn-TUG-01')).toBeInTheDocument()
    })

    it('clicking return changes status to RETURNING', () => {
      render(<TUGDashboard />)
      fireEvent.click(screen.getByTestId('deploy-btn-TUG-01'))

      act(() => {
        jest.advanceTimersByTime(10200)
      })

      fireEvent.click(screen.getByTestId('return-btn-TUG-01'))
      expect(screen.getByTestId('bot-status-TUG-01')).toHaveTextContent('RETURNING')
    })

    it('bot returns to IDLE after RETURNING completes', () => {
      render(<TUGDashboard />)
      fireEvent.click(screen.getByTestId('deploy-btn-TUG-01'))

      // EN_ROUTE -> ARRIVED
      act(() => {
        jest.advanceTimersByTime(10200)
      })

      fireEvent.click(screen.getByTestId('return-btn-TUG-01'))

      // RETURNING -> IDLE (34 steps * 200ms ≈ 6800ms)
      act(() => {
        jest.advanceTimersByTime(7000)
      })

      expect(screen.getByTestId('bot-status-TUG-01')).toHaveTextContent('IDLE')
    })
  })

  describe('Stats Display', () => {
    it('displays quick stats', () => {
      render(<TUGDashboard />)
      expect(screen.getByText('Avg Transit Time')).toBeInTheDocument()
      expect(screen.getByText('On-Time Rate')).toBeInTheDocument()
      expect(screen.getByText('Items Transported')).toBeInTheDocument()
      expect(screen.getByText('Fleet Uptime')).toBeInTheDocument()
    })
  })

  describe('Footer', () => {
    it('displays version info', () => {
      render(<TUGDashboard />)
      expect(screen.getByText('Aethon TUG Fleet Manager v4.1.2')).toBeInTheDocument()
    })

    it('displays facility info', () => {
      render(<TUGDashboard />)
      expect(screen.getByText(/Memorial General Hospital/)).toBeInTheDocument()
    })
  })
})
