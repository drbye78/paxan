// ProxyMania VPN - Events Module
// All event listeners and user interaction handlers

import { getState, setState, getCurrentProxy, getSettings } from './state.js';
import { 
  settingsBtn, settingsPanel, statsPanel, overflowBtn, overflowMenu,
  overflowStatsBtn, overflowFavoritesBtn, overflowApplyRuleBtn, overflowThemeBtn,
  fab, detailsToggle, quickConnectToggle, ipDetectorSection, proxySearch,
  countryFilter, typeFilter, filterChips, tabChips, mainTabs
} from './dom.js';
import { showToast } from './toast.js';
import { applyTheme, toggleTheme, setLanguage } from './settings.js';
import { updateUI, updateFab, toggleDetails } from './ui-core.js';
import { checkIpAddresses } from './ip-detector.js';
import { showAddSiteRuleDialog, handleSiteRuleAction, applyRuleForCurrentTab } from './site-rules.js';
import { toggleBlacklistPanel } from './country-blacklist.js';
import { toggleAutoRotation, updateRotationInterval } from './auto-rotation.js';
import { switchToTab } from './tabs-filters.js';
import { filterProxies } from './proxy-list.js';
import { connectToBestProxy, disconnectProxy } from './connection.js';

// ============================================================================
// EVENT SETUP
// ============================================================================

/**
 * Setup all event listeners
 */
export function setupEventListeners() {
  setupHeaderButtons();
  setupPanelCloseButtons();
  setupImportExport();
  setupFab();
  setupOverflowMenu();
  setupProgressiveDisclosure();
  setupQuickConnect();
  setupIpDetector();
  setupEmptyState();
  setupSecurityToggles();
  setupSiteRules();
  setupAutoRotation();
  setupBlacklist();
  setupThemeSelect();
  setupKeyboardShortcuts();
}

/**
 * Setup header buttons
 */
function setupHeaderButtons() {
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => showPanel('settings'));
  }
}

/**
 * Setup panel close buttons
 */
function setupPanelCloseButtons() {
  const settingsClose = document.getElementById('settingsClose');
  const statsClose = document.getElementById('statsClose');
  
  if (settingsClose) {
    settingsClose.addEventListener('click', () => hidePanel('settings'));
  }
  
  if (statsClose) {
    statsClose.addEventListener('click', () => hidePanel('stats'));
  }
}

/**
 * Setup import/export buttons
 */
function setupImportExport() {
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
}

/**
 * Setup FAB (Floating Action Button)
 */
function setupFab() {
  if (!fab) return;
  
  fab.addEventListener('click', handleFabClick);
}

/**
 * Handle FAB click
 */
function handleFabClick() {
  const currentProxy = getCurrentProxy();
  
  if (currentProxy) {
    disconnectProxy();
  } else {
    connectToBestProxy();
  }
}

/**
 * Setup overflow menu
 */
function setupOverflowMenu() {
  if (!overflowBtn) return;
  
  overflowBtn.addEventListener('click', toggleOverflowMenu);
  
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
  
  // Close overflow menu when clicking outside
  document.addEventListener('click', (e) => {
    if (overflowMenu && !overflowBtn?.contains(e.target) && !overflowMenu.contains(e.target)) {
      overflowMenu.style.display = 'none';
    }
  });
}

/**
 * Toggle overflow menu
 */
function toggleOverflowMenu() {
  if (!overflowMenu) return;
  
  if (overflowMenu.style.display === 'none') {
    overflowMenu.style.display = 'block';
  } else {
    overflowMenu.style.display = 'none';
  }
}

/**
 * Setup progressive disclosure
 */
function setupProgressiveDisclosure() {
  if (detailsToggle) {
    detailsToggle.addEventListener('click', toggleDetails);
  }
}

/**
 * Setup quick connect
 */
function setupQuickConnect() {
  if (quickConnectToggle) {
    quickConnectToggle.addEventListener('click', toggleQuickConnect);
  }
}

/**
 * Toggle quick connect
 */
function toggleQuickConnect() {
  const quickConnectGrid = document.getElementById('quickConnectGrid');
  if (!quickConnectGrid) return;
  
  const isExpanded = quickConnectGrid.style.display !== 'none';
  quickConnectGrid.style.display = isExpanded ? 'none' : 'grid';
  
  if (quickConnectToggle) {
    quickConnectToggle.setAttribute('aria-expanded', !isExpanded);
  }
}

/**
 * Setup IP detector
 */
function setupIpDetector() {
  if (ipDetectorSection) {
    ipDetectorSection.addEventListener('click', (e) => {
      if (e.target !== document.getElementById('ipCheckBtn')) {
        const { toggleIpDetector } = require('./ip-detector.js');
        toggleIpDetector();
      }
    });
  }
  
  const ipCheckBtn = document.getElementById('ipCheckBtn');
  if (ipCheckBtn) {
    ipCheckBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      checkIpAddresses();
    });
  }
}

/**
 * Setup empty state refresh button
 */
function setupEmptyState() {
  const emptyRefreshBtn = document.getElementById('emptyRefreshBtn');
  if (emptyRefreshBtn) {
    emptyRefreshBtn.addEventListener('click', () => {
      const { loadProxies } = require('./proxy-list.js');
      loadProxies(true);
    });
  }
}

/**
 * Setup security toggles
 */
function setupSecurityToggles() {
  const dnsLeakToggle = document.getElementById('dnsLeakToggle');
  const webRtcToggle = document.getElementById('webRtcToggle');
  
  if (dnsLeakToggle) {
    dnsLeakToggle.addEventListener('click', () => {
      const { toggleDnsLeakProtection } = require('./security.js');
      toggleDnsLeakProtection();
    });
  }
  
  if (webRtcToggle) {
    webRtcToggle.addEventListener('click', () => {
      const { toggleWebRtcProtection } = require('./security.js');
      toggleWebRtcProtection();
    });
  }
}

/**
 * Setup site rules
 */
function setupSiteRules() {
  const addSiteRuleBtn = document.getElementById('addSiteRuleBtn');
  const siteRulesList = document.getElementById('siteRulesList');
  
  if (addSiteRuleBtn) {
    addSiteRuleBtn.addEventListener('click', showAddSiteRuleDialog);
  }
  
  if (siteRulesList) {
    siteRulesList.addEventListener('click', handleSiteRuleAction);
  }
}

/**
 * Setup auto-rotation
 */
function setupAutoRotation() {
  const rotationToggle = document.getElementById('rotationToggle');
  const rotationIntervalSelect = document.getElementById('rotationInterval');
  
  if (rotationToggle) {
    rotationToggle.addEventListener('click', toggleAutoRotation);
  }
  
  if (rotationIntervalSelect) {
    rotationIntervalSelect.addEventListener('change', updateRotationInterval);
  }
}

/**
 * Setup country blacklist
 */
function setupBlacklist() {
  const manageBlacklistBtn = document.getElementById('manageBlacklistBtn');
  if (manageBlacklistBtn) {
    manageBlacklistBtn.addEventListener('click', toggleBlacklistPanel);
  }
}

/**
 * Setup theme select
 */
function setupThemeSelect() {
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      setState({ settings: { ...getSettings(), theme: e.target.value } });
      applyTheme();
      const { saveSettings } = require('./settings.js');
      saveSettings();
    });
  }
}

// ============================================================================
// TAB LISTENERS
// ============================================================================

/**
 * Setup tab listeners
 */
export function setupTabListeners() {
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

// ============================================================================
// FILTER CHIP LISTENERS
// ============================================================================

/**
 * Setup filter chip listeners
 */
export function setupFilterChipListeners() {
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

// ============================================================================
// SETTINGS LISTENERS
// ============================================================================

/**
 * Setup settings listeners
 */
export function setupSettingsListeners() {
  const { setupSettingsListeners: setupSettings } = require('./settings.js');
  setupSettings();
}

// ============================================================================
// MESSAGE LISTENER
// ============================================================================

/**
 * Setup message listener for background messages
 */
export function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'proxyDegraded') {
      const { handleProxyDegraded } = require('./connection.js');
      handleProxyDegraded(message);
    }
    
    if (message.action === 'securityAlert') {
      const { handleSecurityAlert } = require('./security.js');
      handleSecurityAlert(message);
    }
    
    if (message.action === 'securityStatusUpdate') {
      const { updateSecurityStatus } = require('./security.js');
      updateSecurityStatus(message);
    }
    
    if (message.action === 'healthStatusUpdate') {
      const { updateHealthStatus } = require('./monitoring.js');
      updateHealthStatus(message);
    }
    
    if (message.action === 'connectionDegraded') {
      const { handleConnectionDegraded } = require('./connection.js');
      handleConnectionDegraded(message);
    }
    
    if (message.action === 'showOnboarding') {
      const { showOnboardingStep } = require('./onboarding.js');
      showOnboardingStep(message.step);
    }
    
    if (message.action === 'hideOnboarding') {
      const { hideOnboarding } = require('./onboarding.js');
      hideOnboarding();
    }
  });
}

// ============================================================================
// SEARCH LISTENER
// ============================================================================

/**
 * Setup search listener
 */
export function setupSearchListener() {
  if (proxySearch) {
    proxySearch.addEventListener('input', debounce(filterProxies, 300));
  }
  
  if (countryFilter) {
    countryFilter.addEventListener('change', filterProxies);
  }
  
  if (typeFilter) {
    typeFilter.addEventListener('change', filterProxies);
  }
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

/**
 * Setup keyboard shortcuts
 */
export function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input/select
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
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
    
    // / - Focus search
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
      const { loadProxies } = require('./proxy-list.js');
      loadProxies(true);
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

// ============================================================================
// PANEL MANAGEMENT
// ============================================================================

/**
 * Show panel
 * @param {string} panelName - Panel to show
 */
export function showPanel(panelName) {
  if (panelName === 'settings' && settingsPanel) {
    settingsPanel.style.display = 'block';
  } else if (panelName === 'stats' && statsPanel) {
    statsPanel.style.display = 'block';
  }
}

/**
 * Hide panel
 * @param {string} panelName - Panel to hide
 */
export function hidePanel(panelName) {
  if (panelName === 'settings' && settingsPanel) {
    settingsPanel.style.display = 'none';
  } else if (panelName === 'stats' && statsPanel) {
    statsPanel.style.display = 'none';
  }
}

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

/**
 * Import proxies
 */
function importProxies() {
  const { importProxies: doImport } = require('./import-export.js');
  doImport();
}

/**
 * Export proxies
 */
function exportProxies() {
  const { exportProxies: doExport } = require('./import-export.js');
  doExport();
}

/**
 * Clear all data
 */
async function clearAllData() {
  if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    const { clearAllData: doClear } = require('./import-export.js');
    await doClear();
    location.reload();
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Debounce function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} - Debounced function
 */
function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Helper for setState
function setState(state) {
  const { setState } = require('./state.js');
  setState(state);
}

// Helper for getSettings
function getSettings() {
  const { getSettings } = require('./state.js');
  return getSettings();
}

// Helper for require
function require(module) {
  console.warn(`Dynamic import not implemented: ${module}`);
  return {};
}
