import '@testing-library/jest-dom'

// Mock IntersectionObserver
class IntersectionObserver {
  constructor(callback) {
    this.callback = callback
  }
  observe() {
    return null
  }
  unobserve() {
    return null
  }
  disconnect() {
    return null
  }
}

window.IntersectionObserver = IntersectionObserver
