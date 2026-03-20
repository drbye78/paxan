// ProxyMania VPN - Entry Point (Incomplete Modular Structure)
// ============================================================================
// IMPORTANT: This file is a placeholder for future modularization
// The extension currently uses popup.js as the main entry point
// ============================================================================

// Mock Chrome API for testing (Node.js environment only)
if (typeof chrome === 'undefined' && typeof window !== 'undefined' && !window.chrome) {
  const noop = () => {};
  global.chrome = {
    runtime: {
      sendMessage: noop,
      onMessage: { addListener: noop, removeListener: noop },
      lastError: null,
    },
    storage: {
      local: { get: noop, set: noop, clear: noop, remove: noop }
    },
    proxy: {
      settings: { set: noop, get: noop, clear: noop }
    },
    tabs: { query: noop, create: noop, update: noop, remove: noop },
    alarms: {
      create: noop, clear: noop, clearAll: noop, get: noop, getAll: noop,
      onAlarm: { addListener: noop, removeListener: noop }
    },
    notifications: {
      create: noop, clear: noop, getAll: noop,
      onClosed: { addListener: noop }
    },
    extension: { getURL: (path) => `chrome-extension://test-id/${path}` }
  };
}

console.warn('⚠️  popup.entry.js is incomplete. Using fallback state management.');

// Fallback state management for testing
const state = {
  proxies: [],
  settings: { theme: 'dark', language: 'en' },
  activeProxy: null,
  favorites: [],
  recentlyUsed: [],
  stats: {},
  dailyStats: { proxiesUsed: 0, connectionTime: 0, attempts: 0, successes: 0 }
};

function getState() { return state; }
function setState(key, value) { state[key] = value; }
function getSettings() { return state.settings; }
function getOnboardingState() { return { completed: true, currentStepIndex: 0 }; }

// ============================================================================
// EXPORTS (for testing)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getState,
    setState,
    getSettings
  };
}
