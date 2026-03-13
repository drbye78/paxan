// Jest setup file for ProxyMania VPN tests

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup DOM environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  },
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Setup Chrome API mocks
import './__mocks__/chrome-api-mock';

// Global test utilities
global.testUtils = {
  createMockProxy: (overrides = {}) => ({
    ip: '192.168.1.1',
    port: 8080,
    ipPort: '192.168.1.1:8080',
    country: 'Germany',
    type: 'HTTPS',
    speed: '45 ms',
    lastCheck: 'Recently',
    speedMs: 45,
    ...overrides,
  }),

  createMockStorage: () => ({
    settings: {
      theme: 'dark',
      autoFailover: true,
      testBeforeConnect: true,
      autoConnect: false,
      notifications: true,
      refreshInterval: 300000,
      proxySource: 'proxymania',
      countryBlacklist: []
    },
    activeProxy: null,
    proxies: [],
    proxyStats: {},
    favorites: [],
    recentlyUsed: [],
    dailyStats: {
      proxiesUsed: 0,
      connectionTime: 0,
      attempts: 0,
      successes: 0
    }
  }),

  waitForNextTick: () => new Promise(resolve => process.nextTick(resolve)),
  
  flushPromises: () => new Promise(resolve => setImmediate(resolve)),
};

// Custom matchers
expect.extend({
  toBeValidProxy(received) {
    const valid = received &&
      typeof received.ip === 'string' &&
      typeof received.port === 'number' &&
      typeof received.ipPort === 'string' &&
      typeof received.country === 'string' &&
      typeof received.type === 'string' &&
      received.port > 0 &&
      received.port <= 65535;

    return {
      message: () =>
        `expected ${JSON.stringify(received)} to be a valid proxy object`,
      pass: valid,
    };
  },

  toBeValidProxyStats(received) {
    const valid = received &&
      typeof received.attempts === 'number' &&
      typeof received.successes === 'number' &&
      typeof received.failures === 'number' &&
      typeof received.successRate === 'number';

    return {
      message: () =>
        `expected ${JSON.stringify(received)} to be valid proxy stats`,
      pass: valid,
    };
  },
});