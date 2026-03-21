// PeasyProxy - Popup Main Entry Point
// Coordinates all popup modules and initializes the application

import {
  loadAllState,
  getCurrentProxy,
  setCurrentProxy,
  setConnectionStartTime,
  getSettings,
  setSettings,
  getConnectionQuality,
  getIpInfo,
  getOnboardingState,
  setOnboardingState,
  getProxies,
  setProxies,
  getProxyStats,
  getDailyStats,
  getFavorites,
  getRecentlyUsed,
  getSiteRules,
  setSiteRules,
  getAutoRotation,
  setAutoRotation,
  getSecurityStatus,
  setSecurityStatus,
  getHealthStatus,
  setHealthStatus,
  getIpInfo as getIpInfoState,
  setIpInfo,
  getCurrentTab,
  setCurrentTab
} from './popup.state.js';

import {
  initDOMElements,
  setupEventListeners,
  setupTabListeners,
  setupFilterChipListeners,
  setupSettingsListeners,
  setupMessageListener,
  setupSearchListener,
  applyTheme,
  startAutoRefresh
} from './popup.events.js';

import {
  updateUI,
  updateFab,
  updateSecurityUI,
  updateHealthUI,
  updateConnectionQuality,
  getFlag,
  showToast,
  hideEmptyState,
  showEmptyState,
  renderSiteRules,
  renderBlacklistChips,
  removeFromBlacklist,
  addToBlacklist,
  updateStatsDisplay,
  showPanel,
  hidePanel
} from './popup.ui.js';

import {
  loadProxies,
  renderQuickConnect,
  renderRecommended
} from './popup.proxy-list.js';

import {
  startConnectionTimer
} from './popup.connection.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  console.log('🚀 Initializing PeasyProxy...');
  
  try {
    // 1. Initialize DOM references
    console.log('📦 Initializing DOM...');
    initDOMElements();
    
    // 2. Load persisted state
    console.log('💾 Loading settings...');
    await loadAllState();
    applyTheme();
    
    // 3. Apply saved language
    const settings = getSettings();
    if (settings.language) {
      if (typeof setLanguage === 'function') {
        setLanguage(settings.language);
      }
    }
    
    // 4. Update UI with loaded state
    updateUI();
    updateFab();
    updateSecurityUI();
    updateHealthUI();
    
    // 5. Load proxies
    console.log('📡 Loading proxies...');
    await loadProxies();
    
    // 6. Render quick connect and recommended
    renderQuickConnect();
    renderRecommended();
    
    // 7. Setup all event listeners
    console.log('🎯 Setting up event listeners...');
    setupEventListeners();
    setupTabListeners();
    setupFilterChipListeners();
    setupSettingsListeners();
    setupMessageListener();
    setupSearchListener();
    
    // 8. Start auto-refresh
    console.log('🔄 Starting auto-refresh...');
    startAutoRefresh();
    
    // 9. Show onboarding if needed
    const onboardingState = getOnboardingState();
    if (!onboardingState.completed) {
      console.log('📚 Showing onboarding...');
      if (typeof showOnboarding === 'function') {
        showOnboarding();
      }
    }
    
    // 10. Start connection timer if already connected
    const currentProxy = getCurrentProxy();
    if (currentProxy) {
      startConnectionTimer();
    }
    
    console.log('✅ PeasyProxy initialized successfully!');
    
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

// Note: init is called automatically on DOMContentLoaded, so no need to export it globally

// ============================================================================
// GLOBAL WINDOW EXPORTS
// ============================================================================

// Expose state functions globally for popup.html to call
window.getProxies = getProxies;
window.setProxies = setProxies;
window.getProxyStats = getProxyStats;
window.getDailyStats = getDailyStats;
window.getFavorites = getFavorites;
window.getRecentlyUsed = getRecentlyUsed;
window.getSiteRules = getSiteRules;
window.setSiteRules = setSiteRules;
window.getAutoRotation = getAutoRotation;
window.setAutoRotation = setAutoRotation;
window.getSecurityStatus = getSecurityStatus;
window.setSecurityStatus = setSecurityStatus;
window.getHealthStatus = getHealthStatus;
window.setHealthStatus = setHealthStatus;
window.getIpInfo = getIpInfoState;
window.setIpInfo = setIpInfo;
window.getCurrentTab = getCurrentTab;
window.setCurrentTab = setCurrentTab;
window.getCurrentProxy = getCurrentProxy;
window.setCurrentProxy = setCurrentProxy;
window.getSettings = getSettings;
window.setSettings = setSettings;
window.loadAllState = loadAllState;
window.getFlag = getFlag;
window.showToast = showToast;
window.hideEmptyState = hideEmptyState;
window.showEmptyState = showEmptyState;
window.renderSiteRules = renderSiteRules;
window.renderBlacklistChips = renderBlacklistChips;
window.removeFromBlacklist = removeFromBlacklist;
window.addToBlacklist = addToBlacklist;
window.updateStatsDisplay = updateStatsDisplay;
window.showPanel = showPanel;
window.hidePanel = hidePanel;
window.updateUI = updateUI;
window.updateSecurityUI = updateSecurityUI;
window.updateHealthUI = updateHealthUI;

