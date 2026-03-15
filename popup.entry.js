// ProxyMania VPN - Main Entry Point
// Initializes all modules and starts the application

// ============================================================================
// MOCK CHROME API (for testing)
// ============================================================================

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

// ============================================================================
// MODULE IMPORTS
// ============================================================================

import { getState, setState, getSettings, getOnboardingState } from './modules/state.js';
import { initDOMElements } from './modules/dom.js';
import { loadSettings, applyTheme, setLanguage } from './modules/settings.js';
import { 
  loadFavorites, 
  loadProxyStats, 
  loadProxyReputation, 
  loadDailyStats, 
  loadSecurityStatus, 
  loadOnboardingState, 
  loadHealthStatus, 
  loadSiteRules, 
  loadAutoRotationSettings, 
  loadCurrentProxy 
} from './modules/storage.js';
import { setupEventListeners, setupTabListeners, setupFilterChipListeners, setupSettingsListeners, setupMessageListener, setupSearchListener } from './modules/events.js';
import { loadProxies, populateCountryFilter } from './modules/proxy-list.js';
import { renderQuickConnect, renderRecommended, setupBestProxyButton } from './modules/quick-connect.js';
import { startAutoRefresh } from './modules/auto-refresh.js';
import { showOnboarding, isOnboardingCompleted } from './modules/onboarding.js';
import { updateUI, updateFab } from './modules/ui-core.js';
import { setupAccessibility } from './modules/accessibility.js';
import { setupSecurityListeners } from './modules/security.js';
import { setupIpDetectorListeners } from './modules/ip-detector.js';
import { setupHealthListeners } from './modules/monitoring.js';

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

/**
 * Initialize the application
 */
async function init() {
  console.log('🚀 Initializing ProxyMania VPN...');
  
  try {
    // 1. Initialize DOM references
    console.log('📦 Initializing DOM...');
    initDOMElements();
    
    // 2. Load persisted state
    console.log('💾 Loading settings...');
    await loadSettings();
    applyTheme();
    
    // 3. Apply saved language
    const { language } = getSettings();
    if (language) {
      setLanguage(language);
    }
    
    // 4. Load all stored data in parallel
    console.log('💾 Loading stored data...');
    await Promise.all([
      loadFavorites(),
      loadProxyStats(),
      loadProxyReputation(),
      loadDailyStats(),
      loadSecurityStatus(),
      loadOnboardingState(),
      loadHealthStatus(),
      loadSiteRules(),
      loadAutoRotationSettings(),
      loadCurrentProxy()
    ]);
    
    // 5. Setup accessibility
    setupAccessibility();
    
    // 6. Load and render proxies
    console.log('📡 Loading proxies...');
    await loadProxies();
    
    // 7. Render quick connect and recommended
    renderQuickConnect();
    renderRecommended();
    setupBestProxyButton();
    
    // 8. Setup all event listeners
    console.log('🎯 Setting up event listeners...');
    setupEventListeners();
    setupTabListeners();
    setupFilterChipListeners();
    setupSettingsListeners();
    setupMessageListener();
    setupSearchListener();
    setupSecurityListeners();
    setupIpDetectorListeners();
    setupHealthListeners();
    
    // 9. Start auto-refresh
    console.log('🔄 Starting auto-refresh...');
    startAutoRefresh();
    
    // 10. Update UI
    console.log('🎨 Updating UI...');
    updateUI();
    updateFab();
    
    // 11. Show onboarding if needed
    const onboardingState = getOnboardingState();
    if (!onboardingState.completed) {
      console.log('📚 Showing onboarding...');
      showOnboarding();
    }
    
    console.log('✅ ProxyMania VPN initialized successfully!');
    
  } catch (error) {
    console.error('❌ Initialization error:', error);
    throw error;
  }
}

// ============================================================================
// START APPLICATION
// ============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ============================================================================
// EXPORTS (for testing)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    init,
    getState,
    setState,
    getSettings
  };
}
