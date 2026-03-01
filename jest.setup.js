import '@testing-library/jest-dom'

// Mock window.alert and window.confirm
global.alert = jest.fn()
global.confirm = jest.fn(() => true)
