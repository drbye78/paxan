// PeasyProxy - Popup Event Handlers
// Manages all DOM event listeners and user interactions

import { escapeHtml } from '../shared/utils.js';
import { setLanguage } from '../popup/i18n.js';
import { showOnboardingStep, hideOnboarding } from './popup.onboarding.js';

import {
  getCurrentProxy,
  setCurrentProxy,
  getConnectionStartTime,
  setConnectionStartTime,
  getSettings,
  setSettings,
  getCurrentTab,
  setCurrentTab,
  getSiteRules,
  setSiteRules,
  getAutoRotation,
  setAutoRotation,
  saveAllState,
  toggleFavorite,
  addToRecentlyUsed,
  updateDailyStats,
  getIpInfo
} from './popup.state.js';

import {
  connectToProxy,
  disconnectProxy,
  reconnectToLastProxy,
  checkIpAddresses,
  applyRuleForCurrentTab,
  startHealthMonitoring,
  stopHealthMonitoring,
  checkHealthStatus,
  toggleDnsLeakProtection,
  toggleWebRtcProtection,
  toggleAutoRotation,
  updateRotationInterval,
  handleProxyDegraded,
  handleSecurityAlert,
  updateSecurityStatus,
  updateHealthStatus,
  handleConnectionDegraded
} from './popup.connection.js';

import {
  updateUI,
  updateFab,
  showPanel,
  hidePanel,
  showToast,
  renderSiteRules,
  renderBlacklistChips,
  getFlag
} from './popup.ui.js';

import {
  loadProxies,
  connectToBestProxy,
  filterProxies,
  renderQuickConnect,
  renderRecommended,
  updateSelectionState,
  switchToTab
} from './popup.proxy-list.js';

import {
  startSpeedGraph
} from './popup.connection.js';

import {
  importProxies,
  exportProxies,
  clearAllData,
  showAddSiteRuleDialog,
  handleSiteRuleAction,
  deleteSelectedProxies,
  exportSelectedProxies,
  toggleSelectAll,
  toggleBlacklistPanel,
} from './popup.events.dialogs.js';

// DOM Elements
let fab;
let overflowBtn, overflowMenu, overflowStatsBtn, overflowFavoritesBtn, overflowApplyRuleBtn, overflowThemeBtn;
let detailsToggle, connectionDetails;
let quickConnectToggle, quickConnectGrid;
let ipDetectorSection, ipCheckBtn;
let tabChips, mainTabs;
let proxySearch, countryFilter, typeFilter, filterChips;
let settingsBtn, settingsPanel, statsPanel;
let themeSelect, proxySourceSelect, rotationToggle, rotationIntervalSelect;
let manageBlacklistBtn, blacklistContainer, blacklistChips;
let bestProxyBtn;

let refreshTimerId = null;

// Initialize DOM elements
function initDOMElements() {
  fab = document.getElementById('fab');
  
  overflowBtn = document.getElementById('overflowBtn');
  overflowMenu = document.getElementById('overflowMenu');
  overflowStatsBtn = document.getElementById('overflowStatsBtn');
  overflowFavoritesBtn = document.getElementById('overflowFavoritesBtn');
  overflowApplyRuleBtn = document.getElementById('overflowApplyRuleBtn');
  overflowThemeBtn = document.getElementById('overflowThemeBtn');
  
  detailsToggle = document.getElementById('detailsToggle');
  connectionDetails = document.getElementById('connectionDetails');
  
  quickConnectToggle = document.getElementById('quickConnectToggle');
  quickConnectGrid = document.getElementById('quickConnectGrid');
  
  ipDetectorSection = document.getElementById('ipDetectorSection');
  ipCheckBtn = document.getElementById('ipCheckBtn');
  
  tabChips = document.getElementById('tabChips');
  mainTabs = document.getElementById('mainTabs');
  
  proxySearch = document.getElementById('proxySearch');
  filterChips = document.getElementById('filterChips');
  countryFilter = document.getElementById('countryFilter');
  typeFilter = document.getElementById('typeFilter');
  
  settingsBtn = document.getElementById('settingsBtn');
  settingsPanel = document.getElementById('settingsPanel');
  statsPanel = document.getElementById('statsPanel');
  
  themeSelect = document.getElementById('themeSelect');
  proxySourceSelect = document.getElementById('proxySource');
  rotationToggle = document.getElementById('rotationToggle');
  rotationIntervalSelect = document.getElementById('rotationInterval');
  
  manageBlacklistBtn = document.getElementById('manageBlacklistBtn');
  blacklistContainer = document.getElementById('blacklistContainer');
  blacklistChips = document.getElementById('blacklistChips');
  
  bestProxyBtn = document.getElementById('bestProxyBtn');
}

// Setup all event listeners
function setupEventListeners() {
  setupSecurityWarning();
  setupFAB();
  setupOverflowMenu();
  setupDetailsToggle();
  setupQuickConnectToggle();
  setupIPDetector();
  setupEmptyState();
  setupSettings();
  setupFilters();
  setupSpeedGraphControls();
  setupKeyboardShortcuts();
}

function setupSecurityWarning() {
  const securityWarning = document.getElementById('securityWarning');
  const warningDismiss = document.getElementById('warningDismiss');
  
  if (warningDismiss && securityWarning) {
    warningDismiss.addEventListener('click', async () => {
      securityWarning.classList.add('hidden');
      try {
        await chrome.storage.local.set({ securityWarningDismissed: true });
      } catch (e) {}
    });
    
    chrome.storage.local.get(['securityWarningDismissed']).then((result) => {
      if (result.securityWarningDismissed) {
        securityWarning.classList.add('hidden');
      }
    }).catch(() => {});
  }
}

function setupFAB() {
  if (fab) {
    fab.addEventListener('click', handleFabClick);
  }
}

function handleFabClick() {
  if (getCurrentProxy()) {
    disconnectProxy();
  } else {
    connectToBestProxy();
  }
}

function setupOverflowMenu() {
  if (overflowBtn) {
    overflowBtn.addEventListener('click', toggleOverflowMenu);
  }
  
  if (overflowStatsBtn) {
    overflowStatsBtn.addEventListener('click', () => {
      toggleOverflowMenu();
      showPanel('stats');
    });
  }
  
  if (overflowFavoritesBtn) {
    overflowFavoritesBtn.addEventListener('click', () => {
      toggleOverflowMenu();
      switchToTab('favorites');
    });
  }
  
  if (overflowApplyRuleBtn) {
    overflowApplyRuleBtn.addEventListener('click', () => {
      toggleOverflowMenu();
      applyRuleForCurrentTab();
    });
  }
  
  if (overflowThemeBtn) {
    overflowThemeBtn.addEventListener('click', () => {
      toggleOverflowMenu();
      toggleTheme();
    });
  }
  
  // Close overflow menu when clicking outside (named function for cleanup)
  function closeOverflowOnClickOutside(e) {
    if (overflowMenu && !overflowBtn?.contains(e.target) && !overflowMenu.contains(e.target)) {
      overflowMenu.style.display = 'none';
    }
  }
  document.addEventListener('click', closeOverflowOnClickOutside);
}

function toggleOverflowMenu() {
  const current = getComputedStyle(overflowMenu).display;
  overflowMenu.style.display = current === 'none' ? 'block' : 'none';
}

function setupDetailsToggle() {
  if (detailsToggle) {
    detailsToggle.addEventListener('click', () => {
      const isExpanded = detailsToggle.getAttribute('aria-expanded') === 'true';
      detailsToggle.setAttribute('aria-expanded', !isExpanded);
      if (connectionDetails) {
        connectionDetails.dataset.expanded = !isExpanded;
        // Trigger CSS transition
        connectionDetails.style.display = isExpanded ? 'none' : 'block';
        // Force reflow for transition
        void connectionDetails.offsetWidth;
        connectionDetails.style.height = isExpanded ? '0px' : 'auto';
      }
    });
  }
}

function setupQuickConnectToggle() {
  if (quickConnectToggle) {
    quickConnectToggle.addEventListener('click', () => {
      const isExpanded = quickConnectToggle.getAttribute('aria-expanded') === 'true';
      quickConnectToggle.setAttribute('aria-expanded', !isExpanded);
      if (quickConnectGrid) {
        quickConnectGrid.style.display = isExpanded ? 'none' : 'grid';
      }
    });
  }
}

function setupIPDetector() {
  if (ipDetectorSection) {
    ipDetectorSection.addEventListener('click', (e) => {
      if (e.target !== ipCheckBtn) {
        const info = getIpInfo();
        info.expanded = !info.expanded;
        const content = document.getElementById('ipDetectorContent');
        if (content) {
          content.style.display = info.expanded ? 'block' : 'none';
        }
      }
    });
  }
  
  if (ipCheckBtn) {
    ipCheckBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      checkIpAddresses();
    });
  }
}

function setupEmptyState() {
  const emptyRefreshBtn = document.getElementById('emptyRefreshBtn');
  if (emptyRefreshBtn) {
    emptyRefreshBtn.addEventListener('click', loadProxies);
  }
  
  // Bulk action buttons
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', deleteSelectedProxies);
  }
  
  const exportSelectedBtn = document.getElementById('exportSelectedBtn');
  if (exportSelectedBtn) {
    exportSelectedBtn.addEventListener('click', exportSelectedProxies);
  }
  
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', toggleSelectAll);
  }
}

function setupSettings() {
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => showPanel('settings'));
  }
  
  // Panel close buttons
  const settingsClose = document.getElementById('settingsClose');
  const statsClose = document.getElementById('statsClose');
  
  if (settingsClose) {
    settingsClose.addEventListener('click', () => hidePanel('settings'));
  }
  
  if (statsClose) {
    statsClose.addEventListener('click', () => hidePanel('stats'));
  }
  
  // Settings buttons
  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  
  if (importBtn) {
    importBtn.addEventListener('click', importProxies);
  }
  
  if (exportBtn) {
    exportBtn.addEventListener('click', exportProxies);
  }
  
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', clearAllData);
  }
  
  // Security toggles
  const dnsLeakToggle = document.getElementById('dnsLeakToggle');
  const webRtcToggle = document.getElementById('webRtcToggle');
  
  if (dnsLeakToggle) {
    dnsLeakToggle.addEventListener('click', toggleDnsLeakProtection);
  }
  
  if (webRtcToggle) {
    webRtcToggle.addEventListener('click', toggleWebRtcProtection);
  }
  
  // Site rules
  const addSiteRuleBtn = document.getElementById('addSiteRuleBtn');
  const siteRulesList = document.getElementById('siteRulesList');
  
  if (addSiteRuleBtn) {
    addSiteRuleBtn.addEventListener('click', showAddSiteRuleDialog);
  }
  
  if (siteRulesList) {
    siteRulesList.addEventListener('click', handleSiteRuleAction);
  }
  
  // Auto-rotation
  if (rotationToggle) {
    rotationToggle.addEventListener('click', toggleAutoRotation);
  }
  
  if (rotationIntervalSelect) {
    rotationIntervalSelect.addEventListener('change', updateRotationInterval);
  }
  
  // Country blacklist
  if (manageBlacklistBtn) {
    manageBlacklistBtn.addEventListener('click', toggleBlacklistPanel);
  }
  
  // Theme select
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      const settings = getSettings();
      settings.theme = e.target.value;
      setSettings(settings);
      applyTheme();
      saveAllState();
    });
  }
  
  // Health monitoring
  const startHealthBtn = document.getElementById('startHealthBtn');
  const stopHealthBtn = document.getElementById('stopHealthBtn');
  const checkHealthBtn = document.getElementById('checkHealthBtn');
  
  if (startHealthBtn) {
    startHealthBtn.addEventListener('click', startHealthMonitoring);
  }
  
  if (stopHealthBtn) {
    stopHealthBtn.addEventListener('click', stopHealthMonitoring);
  }
  
  if (checkHealthBtn) {
    checkHealthBtn.addEventListener('click', checkHealthStatus);
  }
}

function setupFilters() {
  if (countryFilter) {
    countryFilter.addEventListener('change', filterProxies);
  }
  
  if (typeFilter) {
    typeFilter.addEventListener('change', filterProxies);
  }
  
  if (bestProxyBtn) {
    bestProxyBtn.addEventListener('click', connectToBestProxy);
  }
}

function setupSpeedGraphControls() {
  const speedGraphRange = document.getElementById('speedGraphRange');
  if (speedGraphRange) {
    speedGraphRange.addEventListener('change', () => {
      // In a real implementation, this would update the speed graph time range
      // For now, we'll just trigger a refresh of the speed graph data
      // The actual implementation would depend on how the speed graph data is managed
      startSpeedGraph();
    });
  }
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input/select/contentEditable
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        proxySearch?.focus();
      }
      return;
    }
    
    // Ctrl+K or / - Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      proxySearch?.focus();
    }
    
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      proxySearch?.focus();
    }
    
    // Ctrl+D - Disconnect
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      if (getCurrentProxy()) disconnectProxy();
    }
    
    // Ctrl+R - Refresh proxies
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      loadProxies();
    }
    
    // Ctrl+I - Check IPs
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      checkIpAddresses();
    }
    
    // Ctrl+S - Open Settings
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      showPanel('settings');
    }
    
    // Ctrl+Q - Quick connect
    if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
      e.preventDefault();
      connectToBestProxy();
    }
    
    // Ctrl+F - Focus country filter
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      countryFilter?.focus();
    }
    
    // Escape - Close panels
    if (e.key === 'Escape') {
      hidePanel('settings');
      hidePanel('stats');
    }
  });
}

// Tab listeners
function setupTabListeners() {
  const tabContainer = tabChips || mainTabs;
  if (!tabContainer) return;
  
  const tabs = tabContainer.querySelectorAll('[data-tab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
  });
  
  // Keyboard navigation for tabs
  tabContainer.addEventListener('keydown', (e) => {
    const chips = Array.from(tabContainer.querySelectorAll('[data-tab]'));
    const currentIndex = chips.indexOf(document.activeElement);
    
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      let newIndex;
      if (e.key === 'ArrowRight') {
        newIndex = (currentIndex + 1) % chips.length;
      } else {
        newIndex = (currentIndex - 1 + chips.length) % chips.length;
      }
      chips[newIndex].focus();
    }
  });
}

// Filter chip listeners
function setupFilterChipListeners() {
  if (!filterChips) return;
  
  filterChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.querySelectorAll('.chip').forEach(c => {
        c.classList.remove('chip-active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('chip-active');
      chip.setAttribute('aria-pressed', 'true');
      filterProxies();
    });
  });
  
  // Keyboard navigation for filter chips
  filterChips.addEventListener('keydown', (e) => {
    const chips = Array.from(filterChips.querySelectorAll('.chip'));
    const currentIndex = chips.indexOf(document.activeElement);
    
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      let newIndex;
      if (e.key === 'ArrowRight') {
        newIndex = (currentIndex + 1) % chips.length;
      } else {
        newIndex = (currentIndex - 1 + chips.length) % chips.length;
      }
      chips[newIndex].focus();
    }
  });
}

// Settings listeners (called after DOM is fully loaded)
function setupSettingsListeners() {
  const settings = getSettings();
  
  if (themeSelect) {
    themeSelect.value = settings.theme;
  }
  
  if (document.getElementById('languageSelect')) {
    document.getElementById('languageSelect').value = settings.language || 'ru';
  }
  
  if (document.getElementById('refreshInterval')) {
    document.getElementById('refreshInterval').value = settings.refreshInterval.toString();
  }
  
  if (proxySourceSelect) {
    proxySourceSelect.value = settings.proxySource || 'peasyproxy';
  }
  
  const autoFailoverToggle = document.getElementById('autoFailoverToggle');
  if (autoFailoverToggle) {
    autoFailoverToggle.classList.toggle('active', settings.autoFailover);
    autoFailoverToggle.addEventListener('click', function() {
      settings.autoFailover = !settings.autoFailover;
      this.classList.toggle('active', settings.autoFailover);
      setSettings(settings);
      saveAllState();
    });
  }
  
  const testBeforeConnectToggle = document.getElementById('testBeforeConnectToggle');
  if (testBeforeConnectToggle) {
    testBeforeConnectToggle.classList.toggle('active', settings.testBeforeConnect);
    testBeforeConnectToggle.addEventListener('click', function() {
      settings.testBeforeConnect = !settings.testBeforeConnect;
      this.classList.toggle('active', settings.testBeforeConnect);
      setSettings(settings);
      saveAllState();
    });
  }
  
  const autoConnectToggle = document.getElementById('autoConnectToggle');
  if (autoConnectToggle) {
    autoConnectToggle.classList.toggle('active', settings.autoConnect);
    autoConnectToggle.addEventListener('click', function() {
      settings.autoConnect = !settings.autoConnect;
      this.classList.toggle('active', settings.autoConnect);
      setSettings(settings);
      saveAllState();
      showToast(`Auto-connect ${settings.autoConnect ? 'enabled' : 'disabled'}`, 'info');
    });
  }
  
  const notificationsToggle = document.getElementById('notificationsToggle');
  if (notificationsToggle) {
    notificationsToggle.classList.toggle('active', settings.notifications);
    notificationsToggle.addEventListener('click', function() {
      settings.notifications = !settings.notifications;
      this.classList.toggle('active', settings.notifications);
      setSettings(settings);
      saveAllState();
    });
  }
  
  if (document.getElementById('languageSelect')) {
    document.getElementById('languageSelect').addEventListener('change', (e) => {
      settings.language = e.target.value;
      setSettings(settings);
      saveAllState();
      setLanguage(e.target.value);
      showToast(`Language changed to ${e.target.options[e.target.selectedIndex].text}`, 'info');
    });
  }
  
  if (document.getElementById('refreshInterval')) {
    document.getElementById('refreshInterval').addEventListener('change', (e) => {
      settings.refreshInterval = parseInt(e.target.value);
      setSettings(settings);
      saveAllState();
      startAutoRefresh();
    });
  }
  
  if (proxySourceSelect) {
    proxySourceSelect.addEventListener('change', (e) => {
      settings.proxySource = e.target.value;
      setSettings(settings);
      saveAllState();
      showToast(`Proxy source changed to ${e.target.options[e.target.selectedIndex].text}`, 'info');
      loadProxies(true); // Force refresh when source changes
    });
  }
}

// Message listener
// Note: chrome.runtime.onMessage listeners in popups do not need removal —
// popups are re-created each time they open, so the listener is automatically
// discarded when the popup closes.
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'proxyDegraded') handleProxyDegraded(message);
    if (message.action === 'securityAlert') handleSecurityAlert(message);
    if (message.action === 'securityStatusUpdate') updateSecurityStatus(message);
    if (message.action === 'healthStatusUpdate') updateHealthStatus(message);
    if (message.action === 'connectionDegraded') handleConnectionDegraded(message);
    if (message.action === 'showOnboarding') showOnboardingStep(message.step);
    if (message.action === 'hideOnboarding') hideOnboarding();
    if (message.action === 'showOnboardingStep') showOnboardingStep(message.step);
  });
}

// Search listener
function setupSearchListener() {
  if (proxySearch) {
    const debouncedFilter = debounce(() => filterProxies(), 300);
    proxySearch.addEventListener('input', debouncedFilter);
  }
}

// Helper functions
function toggleTheme() {
  const settings = getSettings();
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  setSettings(settings);
  applyTheme();
  saveAllState();
  showToast(`Switched to ${settings.theme} theme`, 'info');
}

function applyTheme() {
  const settings = getSettings();
  let theme = settings.theme;
  if (theme === 'auto') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
}

function startAutoRefresh() {
  const settings = getSettings();
  if (refreshTimerId) clearInterval(refreshTimerId);
  if (settings.refreshInterval > 0) {
    refreshTimerId = setInterval(loadProxies, settings.refreshInterval);
  }
}

// Lightweight debounce — module-scoped for event listener use
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Import/Export functions — imported from popup.events.dialogs.js

// clearAllData — imported from popup.events.dialogs.js

// Site rules functions — imported from popup.events.dialogs.js

// Bulk action functions — imported from popup.events.dialogs.js

// Export functions for testing
export {
  initDOMElements,
  setupEventListeners,
  setupTabListeners,
  setupFilterChipListeners,
  setupSettingsListeners,
  setupMessageListener,
  setupSearchListener,
  applyTheme,
  startAutoRefresh,
  toggleTheme,
  importProxies,
  exportProxies,
  clearAllData,
  showAddSiteRuleDialog,
  handleSiteRuleAction,
  deleteSelectedProxies,
  exportSelectedProxies,
  toggleSelectAll,
  toggleBlacklistPanel,
  handleFabClick
};
