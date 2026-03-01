import '@testing-library/jest-dom'

// Mock window.alert and window.confirm
global.alert = jest.fn()
global.confirm = jest.fn(() => true)

// Mock Convex device overlay hook so components render without ConvexProvider
jest.mock('@/hooks/useConvexDeviceOverlay', () => ({
  useConvexDeviceOverlay: jest.fn(() => ({
    status: 'idle',
    currentAction: undefined,
    lastError: undefined,
    fields: {},
    updatedAt: 0,
    roomStatus: 'idle',
    isLoading: false,
  })),
}))
