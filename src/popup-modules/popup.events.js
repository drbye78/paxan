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

// Import/Export functions
function importProxies() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      if (Array.isArray(imported)) {
        const validProxies = imported.filter(p =>
          p && typeof p === 'object' &&
          typeof p.ip === 'string' && p.ip.trim() &&
          typeof p.port === 'number' && p.port > 0 && p.port <= 65535
        );
        if (validProxies.length === 0) {
          showToast('No valid proxies found in file', 'warning');
          return;
        }
        const currentProxies = getProxies();
        setProxies([...currentProxies, ...validProxies]);
        await chrome.storage.local.set({ proxies: getProxies() });
        showToast(`Imported ${validProxies.length} proxies`, 'success');
        loadProxies();
      }
    } catch {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      const imported = lines.map(line => {
        const [ip, portStr] = line.split(':');
        const port = parseInt(portStr, 10);
        if (!ip || !portStr || isNaN(port) || port <= 0 || port > 65535) return null;
        return { ip: ip.trim(), port, ipPort: `${ip.trim()}:${port}`, country: 'Unknown', type: 'HTTPS', speedMs: 9999 };
      }).filter(p => p !== null);
      if (imported.length === 0) {
        showToast('No valid proxies found in file', 'warning');
        return;
      }
      const currentProxies = getProxies();
      setProxies([...currentProxies, ...imported]);
      await chrome.storage.local.set({ proxies: getProxies() });
      showToast(`Imported ${imported.length} proxies`, 'success');
      loadProxies();
    }
  };
  input.click();
}

function exportProxies() {
  const currentProxies = getProxies();
  const proxyStats = getProxyStats();
  const working = currentProxies.filter(p => {
    const stats = proxyStats[p.ipPort];
    return stats && stats.successRate > 50;
  });
  const data = JSON.stringify(working, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `proxies-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${working.length} proxies`, 'success');
}

async function clearAllData() {
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.innerHTML = `
    <div class="confirm-dialog-content">
      <h3>Clear All Data</h3>
      <p>Clear all extension data? This cannot be undone.</p>
      <div class="confirm-dialog-actions">
        <button class="btn btn-secondary" id="confirmCancel">Cancel</button>
        <button class="btn btn-danger" id="confirmClear">Clear All</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  return new Promise((resolve) => {
    document.getElementById('confirmCancel').addEventListener('click', () => {
      dialog.remove();
      resolve(false);
    });
    document.getElementById('confirmClear').addEventListener('click', async () => {
      dialog.remove();
      await chrome.storage.local.clear();
      location.reload();
      resolve(true);
    });
  });
}

// Site rules functions
function showAddSiteRuleDialog() {
  const currentProxies = getProxies();
  const dialog = document.createElement('div');
  dialog.className = 'rule-dialog';
  dialog.innerHTML = `
    <div class="rule-dialog-content">
      <h3>Add Site Rule</h3>
      <div class="rule-input-group">
        <label>Website URL (e.g., netflix.com)</label>
        <input type="text" id="ruleUrl" placeholder="netflix.com or *.netflix.com" />
      </div>
      <div class="rule-input-group">
        <label>Pattern Type</label>
        <select id="rulePatternType">
          <option value="exact">Exact Match (netflix.com)</option>
          <option value="wildcard">Wildcard (*.netflix.com)</option>
          <option value="contains">Contains (*netflix*)</option>
          <option value="regex">Regex Pattern</option>
        </select>
      </div>
      <div class="rule-input-group">
        <label>Priority (1 = highest)</label>
        <input type="number" id="rulePriority" min="1" max="999" value="100" />
      </div>
      <div class="rule-input-group">
        <label>Proxy Country</label>
        <select id="ruleCountry">
          ${[...new Set(currentProxies.map(p => p.country))].sort().map(c => 
            `<option value="${escapeHtml(c)}">${getFlag(c)} ${escapeHtml(c)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="rule-actions">
        <button class="btn btn-primary" id="saveRuleBtn">Save</button>
        <button class="btn btn-secondary" id="cancelRuleBtn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const saveRuleBtn = document.getElementById('saveRuleBtn');
  const cancelRuleBtn = document.getElementById('cancelRuleBtn');
  const ruleUrl = document.getElementById('ruleUrl');
  const rulePatternType = document.getElementById('rulePatternType');
  const rulePriority = document.getElementById('rulePriority');
  const ruleCountry = document.getElementById('ruleCountry');

  if (saveRuleBtn) {
    saveRuleBtn.addEventListener('click', async () => {
      const url = ruleUrl?.value?.trim();
      const patternType = rulePatternType?.value || 'exact';
      const priority = parseInt(rulePriority?.value) || 100;
      const country = ruleCountry?.value;

      if (!url || !country) {
        showToast('Please fill all fields', 'warning');
        return;
      }

      const countryProxies = currentProxies.filter(p => p.country === country);
      if (countryProxies.length === 0) {
        showToast('No proxies available for ' + country, 'warning');
        return;
      }

      const siteRules = getSiteRules();
      siteRules.push({
        id: Date.now(),
        url,
        patternType,
        priority,
        country,
        proxyIps: countryProxies.map(p => p.ipPort),
        enabled: true
      });

      siteRules.sort((a, b) => a.priority - b.priority);
      setSiteRules(siteRules);
      await chrome.storage.local.set({ siteRules });
      renderSiteRules();
      dialog.remove();
      showToast('Rule added', 'success');
    });
  }

  if (cancelRuleBtn) {
    cancelRuleBtn.addEventListener('click', () => dialog.remove());
  }
}

function handleSiteRuleAction(e) {
  const siteRules = getSiteRules();
  const deleteBtn = e.target.closest('.delete-rule-btn');
  const toggleBtn = e.target.closest('.rule-toggle');
  
  if (deleteBtn) {
    const ruleId = parseInt(deleteBtn.dataset.id);
    const filtered = siteRules.filter(r => r.id !== ruleId);
    setSiteRules(filtered);
    chrome.storage.local.set({ siteRules: filtered });
    renderSiteRules();
    showToast('Rule deleted', 'info');
  }
  
  if (toggleBtn) {
    const ruleId = parseInt(toggleBtn.dataset.id);
    const rule = siteRules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = !rule.enabled;
      chrome.storage.local.set({ siteRules });
      renderSiteRules();
      showToast(`Rule ${rule.enabled ? 'enabled' : 'disabled'}`, 'info');
    }
  }
  
  const priorityBtn = e.target.closest('.priority-up-btn, .priority-down-btn');
  if (priorityBtn) {
    const ruleId = parseInt(priorityBtn.dataset.id);
    const ruleIndex = siteRules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return;
    
    const direction = priorityBtn.classList.contains('priority-up-btn') ? -1 : 1;
    const newIndex = ruleIndex + direction;
    
    if (newIndex >= 0 && newIndex < siteRules.length) {
      const temp = siteRules[ruleIndex].priority;
      siteRules[ruleIndex].priority = siteRules[newIndex].priority;
      siteRules[newIndex].priority = temp;
      
      siteRules.sort((a, b) => a.priority - b.priority);
      setSiteRules(siteRules);
      chrome.storage.local.set({ siteRules });
      renderSiteRules();
    }
  }
}

// Bulk action functions
async function deleteSelectedProxies() {
  // Note: We can't actually delete proxies from the source, but we can blacklist them
  const selectedCheckboxes = document.querySelectorAll('.proxy-select-checkbox:checked');
  if (selectedCheckboxes.length === 0) return;
  
  const settings = getSettings();
  const countryBlacklist = settings.countryBlacklist || [];
  
  // Get selected proxy countries
  const selectedCountries = Array.from(selectedCheckboxes)
    .map(checkbox => {
      const item = checkbox.closest('.proxy-item');
      return item ? item.querySelector('.proxy-details span').textContent.trim() : null;
    })
    .filter(country => country !== null);
  
  // Add to blacklist
  const newBlacklist = [...new Set([...countryBlacklist, ...selectedCountries])];
  settings.countryBlacklist = newBlacklist;
  
  try {
    await chrome.storage.local.set({ settings });
    await loadProxies(true); // Reload proxies with new blacklist
    showToast(`Added ${selectedCountries.length} countries to blacklist`, 'info');
  } catch (error) {
    console.error('Error updating blacklist:', error);
    showToast('Failed to update blacklist', 'error');
  }
  
  // Clear selection
  updateSelectionState();
}

async function exportSelectedProxies() {
  const selectedCheckboxes = document.querySelectorAll('.proxy-select-checkbox:checked');
  if (selectedCheckboxes.length === 0) return;
  
  // Get selected proxy data
  const selectedProxies = Array.from(selectedCheckboxes)
    .map(checkbox => {
      const item = checkbox.closest('.proxy-item');
      if (!item) return null;
      
      const flagEl = item.querySelector('.proxy-flag');
      const ipPortEl = item.querySelector('.proxy-ip span:nth-child(2)');
      const countryEl = item.querySelector('.proxy-details span');
      const typeEl = item.querySelector('.proxy-type');
      const speedEl = item.querySelector('.proxy-speed');
      
      return {
        ipPort: ipPortEl ? ipPortEl.textContent : '',
        country: countryEl ? countryEl.textContent : '',
        type: typeEl ? typeEl.textContent : '',
        speed: speedEl ? speedEl.textContent.replace('⚡ ', '') : '',
        flag: flagEl ? flagEl.textContent : ''
      };
    })
    .filter(proxy => proxy !== null);
  
  if (selectedProxies.length === 0) {
    showToast('No valid proxies selected', 'warning');
    return;
  }
  
  // Create CSV content
  const csvHeaders = ['Flag', 'Country', 'Type', 'IP:Port', 'Speed (ms)'];
  const csvRows = selectedProxies.map(proxy => [
    proxy.flag,
    proxy.country,
    proxy.type,
    proxy.ipPort,
    proxy.speed
  ]);
  
  const csvContent = [
    csvHeaders.join(','),
    ...csvRows.map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const filename = `peasyproxy_selected_proxies_${new Date().toISOString().slice(0,10)}.csv`;
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast(`Exported ${selectedProxies.length} proxies to ${filename}`, 'success');
}

function toggleSelectAll(e) {
  const isChecked = e.target.checked;
  const checkboxes = document.querySelectorAll('.proxy-select-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = isChecked;
    const item = checkbox.closest('.proxy-item');
    if (item) {
      item.classList.toggle('selected', isChecked);
    }
  });
  updateSelectionState();
}

function toggleBlacklistPanel() {
  const blacklistContainer = document.getElementById('blacklistContainer');
  if (!blacklistContainer) return;
  
  const isVisible = blacklistContainer.style.display !== 'none';
  blacklistContainer.style.display = isVisible ? 'none' : 'block';
  
  if (!isVisible) {
    renderBlacklistChips();
  }
}

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
  toggleBlacklistPanel,
  handleFabClick
};
