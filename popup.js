// ProxyMania VPN - Chrome Extension
// MV3 Compatible Version 3.0.0 - Modern UX Refresh

let proxies = [];
let currentProxy = null;
let connectionStartTime = null;
let timerInterval = null;
let proxyStats = {};
let favorites = [];
let currentTab = 'all';
let monitoringActive = false;
let settings = {
  theme: 'dark',
  autoFailover: true,
  testBeforeConnect: true,
  autoConnect: false,
  notifications: true,
  refreshInterval: 300000
};
let dailyStats = {
  proxiesUsed: 0,
  connectionTime: 0,
  attempts: 0,
  successes: 0
};
let securityStatus = {
  status: 'secure',
  dnsLeakProtection: true,
  webRtcProtection: true,
  lastCheck: null
};
let onboardingState = {
  completed: false,
  currentStepIndex: 0,
  version: '3.0.0'
};
let healthStatus = {
  active: false,
  quality: 'excellent',
  avgLatency: 0,
  lastCheck: null
};

// Connection Quality state
let connectionQuality = {
  enabled: true,
  lastUpdate: null,
  latency: 0,
  packetLoss: 0,
  quality: 'excellent'
};

// IP Detector state
let ipInfo = {
  realIp: null,
  proxyIp: null,
  isLoading: false,
  lastCheck: null,
  expanded: false
};

// Undo Disconnect state
let lastDisconnectedProxy = null;
let disconnectTimeout = null;

// Per-Site Rules state
let siteRules = [];

// Auto-Rotation state
let autoRotation = {
  enabled: false,
  interval: 600000,
  timer: null,
  lastRotation: null
};

// Details expanded state (Progressive Disclosure)
let detailsExpanded = false;

// Country flag mapping
const countryFlags = {
  'United States': '🇺🇸', 'USA': '🇺🇸', 'Germany': '🇩🇪', 'France': '🇫🇷',
  'United Kingdom': '🇬🇧', 'UK': '🇬🇧', 'Japan': '🇯🇵', 'China': '🇨🇳',
  'Brazil': '🇧🇷', 'Canada': '🇨🇦', 'Australia': '🇦🇺', 'Russia': '🇷🇺',
  'India': '🇮🇳', 'South Korea': '🇰🇷', 'Netherlands': '🇳🇱', 'Spain': '🇪🇸',
  'Italy': '🇮🇹', 'Poland': '🇵🇱', 'Singapore': '🇸🇬', 'Hong Kong': '🇭🇰',
  'Taiwan': '🇹🇼', 'Indonesia': '🇮🇩', 'Thailand': '🇹🇭', 'Vietnam': '🇻🇳',
  'Philippines': '🇵🇭', 'Malaysia': '🇲🇾', 'Argentina': '🇦🇷', 'Mexico': '🇲🇽',
  'Ukraine': '🇺🇦', 'Turkey': '🇹🇷', 'South Africa': '🇿🇦', 'Sweden': '🇸🇪',
  'Norway': '🇳🇴', 'Switzerland': '🇨🇭', 'Austria': '🇦🇹', 'Belgium': '🇧🇪',
  'Portugal': '🇵🇹', 'Greece': '🇬🇷', 'Czech Republic': '🇨🇿', 'Romania': '🇷🇴',
  'Hungary': '🇭🇺', 'Bulgaria': '🇧🇬', 'Ireland': '🇮🇪', 'New Zealand': '🇳🇿',
  'Pakistan': '🇵🇰', 'Bangladesh': '🇧🇩', 'Iran': '🇮🇷', 'Israel': '🇮🇱',
  'UAE': '🇦🇪', 'Saudi Arabia': '🇸🇦', 'Egypt': '🇪🇬', 'Nigeria': '🇳🇬',
  'Kenya': '🇰🇪', 'Chile': '🇨🇱', 'Colombia': '🇨🇴', 'Peru': '🇵🇪',
  'Venezuela': '🇻🇪', 'Ecuador': '🇪🇨', 'Uruguay': '🇺🇾', 'Costa Rica': '🇨🇷',
  'Panama': '🇵🇦', 'Guatemala': '🇬🇹', 'Cuba': '🇨🇺', 'Jamaica': '🇯🇲',
  'Fiji': '🇫🇯', 'Iceland': '🇮🇸', 'Luxembourg': '🇱🇺', 'Malta': '🇲🇹',
  'Cyprus': '🇨🇾', 'Georgia': '🇬🇪', 'Armenia': '🇦🇲', 'Kazakhstan': '🇰🇿',
  'Belarus': '🇧🇾', 'Lithuania': '🇱🇹', 'Latvia': '🇱🇻', 'Estonia': '🇪🇪',
  'Croatia': '🇭🇷', 'Serbia': '🇷🇸', 'Slovakia': '🇸🇰', 'Slovenia': '🇸🇮',
  'Denmark': '🇩🇰', 'Finland': '🇫🇮', 'Morocco': '🇲🇦', 'Tunisia': '🇹🇳',
  'Algeria': '🇩🇿', 'Ghana': '🇬🇭', 'Ethiopia': '🇪🇹', 'Tanzania': '🇹🇿',
  'Uganda': '🇺🇬', 'Zimbabwe': '🇿🇼', 'Angola': '🇦🇴', 'Zambia': '🇿🇲',
  'Mozambique': '🇲🇿', 'Botswana': '🇧🇼', 'Namibia': '🇳🇦', 'Nepal': '🇳🇵',
  'Sri Lanka': '🇱🇰', 'Myanmar': '🇲🇲', 'Cambodia': '🇰🇭', 'Laos': '🇱🇦',
  'Mongolia': '🇲🇳', 'Iraq': '🇮🇶', 'Libya': '🇱🇾', 'Paraguay': '🇵🇾',
  'Bolivia': '🇧🇴', 'Honduras': '🇭🇳', 'El Salvador': '🇸🇻', 'Nicaragua': '🇳🇮',
  'Dominican Republic': '🇩🇴', 'Trinidad and Tobago': '🇹🇹', 'Bahamas': '🇧🇸',
  'Barbados': '🇧🇧', 'Papua New Guinea': '🇵🇬', 'Vanuatu': '🇻🇺'
};

function getFlag(country) {
  if (!country) return '🌍';
  return countryFlags[country] || countryFlags[country.split(' ')[0]] || '🌍';
}

// DOM Elements - initialized lazily
const $ = (id) => document.getElementById(id);

let statusIndicator, statusText, currentProxyDisplay, proxyFlag, proxyAddress, proxyCountry;
let connectionTimer, timerValue, testStatus, testText;
let countryFilter, typeFilter, proxyList, proxyCount, listTitle, loading;
let quickConnectGrid, quickConnectSection, recommendedSection, recommendedList;
let toastContainer, mainTabs, filterChips, settingsPanel, statsPanel;
let proxySearch, bestProxyBtn;
let speedGraphCanvas, speedGraphSection, currentLatencyEl;
let healthIndicator, securityIndicator;
let speedData = [];
let speedGraphInterval = null;

// v3.0 New DOM elements
let qualityBadgeInline, qualityStats, connectionQualityInline;
let detailsToggle, connectionDetails, ipDetectorContent;
let fab;
let overflowBtn, overflowMenu, overflowStatsBtn, overflowFavoritesBtn, overflowApplyRuleBtn, overflowThemeBtn;
let emptyState, themeSelect, settingsBtn;

function initDOMElements() {
  // Status elements
  statusIndicator = $('statusBadge');
  statusText = statusIndicator?.querySelector('.status-text');
  currentProxyDisplay = $('currentProxyDisplay');
  proxyFlag = $('proxyFlag');
  proxyAddress = $('proxyAddress');
  proxyCountry = $('proxyCountry');
  connectionTimer = $('connectionTimer');
  timerValue = connectionTimer?.querySelector('.timer-value');
  
  // Test status (removed in v3.0)
  testStatus = $('testStatus');
  testText = testStatus?.querySelector('.test-text');
  
  // Indicators
  healthIndicator = $('healthIndicator');
  securityIndicator = $('securityIndicator');
  
  // New v3.0 elements
  qualityBadgeInline = $('qualityBadge');
  qualityStats = $('qualityStats');
  connectionQualityInline = $('connectionQualityInline');
  detailsToggle = $('detailsToggle');
  connectionDetails = $('connectionDetails');
  ipDetectorContent = $('ipDetectorContent');
  
  // FAB (Floating Action Button)
  fab = $('fab');
  
  // Overflow menu
  overflowBtn = $('overflowBtn');
  overflowMenu = $('overflowMenu');
  overflowStatsBtn = $('overflowStatsBtn');
  overflowFavoritesBtn = $('overflowFavoritesBtn');
  overflowApplyRuleBtn = $('overflowApplyRuleBtn');
  overflowThemeBtn = $('overflowThemeBtn');
  
  // Settings & panels
  settingsBtn = $('settingsBtn');
  settingsPanel = $('settingsPanel');
  statsPanel = $('statsPanel');
  
  // Filters
  proxySearch = $('proxySearch');
  filterChips = $('filterChips');
  countryFilter = $('countryFilter');
  typeFilter = $('typeFilter');
  
  // Proxy list
  proxyList = $('proxyList');
  proxyCount = $('proxyCount');
  listTitle = $('listTitle');
  loading = $('loading');
  emptyState = $('emptyState');
  
  // Quick connect
  quickConnectGrid = $('quickConnectGrid');
  quickConnectSection = $('quickConnectSection');
  quickConnectToggle = $('quickConnectToggle');
  bestProxyBtn = $('bestProxyBtn');
  
  // Tabs (now integrated in filter bar)
  tabChips = $('tabChips');
  mainTabs = $('mainTabs'); // Keep for backward compatibility
  
  // Toast
  toastContainer = $('toastContainer');
  
  // Settings elements
  themeSelect = $('themeSelect');
  rotationToggle = $('rotationToggle');
  rotationIntervalSelect = $('rotationInterval');
  ipCheckBtn = $('ipCheckBtn');
  ipRealValue = $('ipRealValue');
  ipProxyValue = $('ipProxyValue');
  ipDetectorSection = $('ipDetectorSection');
  speedGraphCanvas = $('speedGraph');
  speedGraphSection = $('speedGraphSection');
  currentLatencyEl = $('currentLatency');
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  initDOMElements();
  await loadSettings();
  applyTheme();
  setupThemeWatcher();
  await loadFavorites();
  await loadProxyStats();
  await loadDailyStats();
  await loadSecurityStatus();
  await loadOnboardingState();
  await loadHealthStatus();
  await loadSiteRules();
  await loadAutoRotationSettings();
  loadCurrentProxy();
  loadProxies();
  setupEventListeners();
  setupTabListeners();
  setupFilterChipListeners();
  setupSettingsListeners();
  setupMessageListener();
  setupSearchListener();
  startAutoRefresh();

  // Check if onboarding should be shown
  if (!onboardingState.completed) {
    showOnboarding();
  }
});

function setupEventListeners() {
  // ===== v3.0 New Event Handlers =====
  
  // FAB (Floating Action Button)
  if (fab) {
    fab.addEventListener('click', handleFabClick);
  }
  
  // Overflow menu
  if (overflowBtn) {
    overflowBtn.addEventListener('click', toggleOverflowMenu);
  }
  if (overflowStatsBtn) {
    overflowStatsBtn.addEventListener('click', () => { toggleOverflowMenu(); showPanel('stats'); });
  }
  if (overflowFavoritesBtn) {
    overflowFavoritesBtn.addEventListener('click', () => { toggleOverflowMenu(); switchToTab('favorites'); });
  }
  if (overflowApplyRuleBtn) {
    overflowApplyRuleBtn.addEventListener('click', () => { toggleOverflowMenu(); applyRuleForCurrentTab(); });
  }
  if (overflowThemeBtn) {
    overflowThemeBtn.addEventListener('click', () => { toggleOverflowMenu(); toggleTheme(); });
  }
  
  // Close overflow menu when clicking outside
  document.addEventListener('click', (e) => {
    if (overflowMenu && !overflowBtn?.contains(e.target) && !overflowMenu.contains(e.target)) {
      overflowMenu.style.display = 'none';
    }
  });
  
  // Progressive Disclosure - Details toggle
  if (detailsToggle) {
    detailsToggle.addEventListener('click', toggleDetails);
  }
  
  // IP Detector expand
  if (ipDetectorSection) {
    ipDetectorSection.addEventListener('click', (e) => {
      if (e.target !== ipCheckBtn) {
        toggleIpDetector();
      }
    });
  }
  
  // Empty state refresh
  $('emptyRefreshBtn')?.addEventListener('click', loadProxies);
  
  // ===== Existing Event Handlers =====
  
  // Header buttons (now in overflow)
  settingsBtn.addEventListener('click', () => showPanel('settings'));

  // Panel close buttons
  $('settingsClose')?.addEventListener('click', () => hidePanel('settings'));
  $('statsClose')?.addEventListener('click', () => hidePanel('stats'));

  // Settings panel
  $('importBtn')?.addEventListener('click', importProxies);
  $('exportBtn')?.addEventListener('click', exportProxies);
  $('clearDataBtn')?.addEventListener('click', clearAllData);

  // Filters
  countryFilter?.addEventListener('change', filterProxies);
  typeFilter?.addEventListener('change', filterProxies);

  // Best Proxy button
  if (bestProxyBtn) {
    bestProxyBtn.addEventListener('click', connectToBestProxy);
  }

  // Security toggles
  $('dnsLeakToggle')?.addEventListener('click', toggleDnsLeakProtection);
  $('webRtcToggle')?.addEventListener('click', toggleWebRtcProtection);

  // Feature 2: IP Detector
  if (ipCheckBtn) {
    ipCheckBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      checkIpAddresses();
    });
  }

  // Feature 4: Site Rules
  $('addSiteRuleBtn')?.addEventListener('click', showAddSiteRuleDialog);
  $('siteRulesList')?.addEventListener('click', handleSiteRuleAction);

  // Feature 5: Auto-Rotation
  if (rotationToggle) {
    rotationToggle.addEventListener('click', toggleAutoRotation);
  }
  if (rotationIntervalSelect) {
    rotationIntervalSelect.addEventListener('change', updateRotationInterval);
  }
  
  // Theme select
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      settings.theme = e.target.value;
      applyTheme();
      saveSettings();
    });
  }

  // Task 9: Keyboard Shortcuts
  setupKeyboardShortcuts();
}

// ===== v3.0 New Functions =====

// FAB Handler
function handleFabClick() {
  if (currentProxy) {
    disconnectProxy();
  } else {
    // Find best proxy and connect
    connectToBestProxy();
  }
}

// Overflow Menu Toggle
function toggleOverflowMenu() {
  if (overflowMenu.style.display === 'none') {
    overflowMenu.style.display = 'block';
  } else {
    overflowMenu.style.display = 'none';
  }
}

// Progressive Disclosure - Toggle Details
function toggleDetails() {
  detailsExpanded = !detailsExpanded;
  connectionDetails.setAttribute('data-expanded', detailsExpanded);
  detailsToggle.setAttribute('aria-expanded', detailsExpanded);
}

// Toggle IP Detector
function toggleIpDetector() {
  ipInfo.expanded = !ipInfo.expanded;
  if (ipDetectorContent) {
    ipDetectorContent.style.display = ipInfo.expanded ? 'block' : 'none';
  }
}

// Update FAB state
function updateFab() {
  if (!fab) return;

  fab.classList.remove('loading', 'connected');

  if (currentProxy) {
    fab.classList.add('connected');
    fab.title = 'Disconnect';
  } else {
    fab.title = 'Connect';
  }
  
  // Force icon visibility update
  const connectIcon = fab.querySelector('.fab-connect');
  const disconnectIcon = fab.querySelector('.fab-disconnect');
  const loadingIcon = fab.querySelector('.fab-loading');
  
  if (connectIcon) connectIcon.style.display = currentProxy ? 'none' : 'block';
  if (disconnectIcon) disconnectIcon.style.display = currentProxy ? 'block' : 'none';
  if (loadingIcon) loadingIcon.style.display = 'none';
}

// Task 9: Keyboard Shortcuts Setup
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input/select
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      // Allow Ctrl+K to focus search even when typing
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
    
    // / - Focus search (single key)
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      proxySearch?.focus();
    }
    
    // Ctrl+D - Disconnect
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      if (currentProxy) disconnectProxy();
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
    
    // Ctrl+Q - Quick connect (connect to best proxy)
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

function handleConnectClick() {
  if (currentProxy) {
    disconnectProxy();
  } else {
    // Open proxy list to select a proxy
    switchToTab('all');
  }
}

function setupTabListeners() {
  // Use tabChips if available, otherwise fall back to mainTabs
  const tabContainer = tabChips || mainTabs;
  if (!tabContainer) return;
  
  const tabs = tabContainer.querySelectorAll('.tab, [data-tab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
  });
}

function setupFilterChipListeners() {
  if (!filterChips) return;
  filterChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      filterProxies();
    });
  });
}

function setupSettingsListeners() {
  $('themeSelect').addEventListener('change', (e) => {
    settings.theme = e.target.value;
    applyTheme();
    saveSettings();
  });
  
  $('refreshInterval').addEventListener('change', (e) => {
    settings.refreshInterval = parseInt(e.target.value);
    saveSettings();
    startAutoRefresh();
  });
  
  $('autoFailoverToggle').addEventListener('click', function() {
    settings.autoFailover = !settings.autoFailover;
    this.classList.toggle('active', settings.autoFailover);
    saveSettings();
  });
  
  $('testBeforeConnectToggle').addEventListener('click', function() {
    settings.testBeforeConnect = !settings.testBeforeConnect;
    this.classList.toggle('active', settings.testBeforeConnect);
    saveSettings();
  });
  
  $('autoConnectToggle')?.addEventListener('click', function() {
    settings.autoConnect = !settings.autoConnect;
    this.classList.toggle('active', settings.autoConnect);
    saveSettings();
    showToast(`Auto-connect ${settings.autoConnect ? 'enabled' : 'disabled'}`, 'info');
  });
  
  $('notificationsToggle').addEventListener('click', function() {
    settings.notifications = !settings.notifications;
    this.classList.toggle('active', settings.notifications);
    saveSettings();
  });
}

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

// Settings Management
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    if (result.settings) settings = { ...settings, ...result.settings };
    
    $('themeSelect').value = settings.theme;
    $('refreshInterval').value = settings.refreshInterval.toString();
    $('autoFailoverToggle').classList.toggle('active', settings.autoFailover);
    $('testBeforeConnectToggle').classList.toggle('active', settings.testBeforeConnect);
    $('autoConnectToggle')?.classList.toggle('active', settings.autoConnect);
    $('notificationsToggle').classList.toggle('active', settings.notifications);
  } catch (error) { console.error('Error loading settings:', error); }
}

// Security Management
async function loadSecurityStatus() {
  try {
    const result = await chrome.storage.local.get(['security']);
    if (result.security) {
      securityStatus = { ...securityStatus, ...result.security };
    }
    
    // Update UI based on security status
    updateSecurityUI();
    
    // Request current security status from background
    chrome.runtime.sendMessage({ action: 'getSecurityStatus' })
      .then(status => {
        securityStatus = status;
        updateSecurityUI();
      })
      .catch(console.error);
  } catch (error) { console.error('Error loading security status:', error); }
}

function updateSecurityUI() {
  const dnsToggle = $('dnsLeakToggle');
  const webRtcToggle = $('webRtcToggle');
  
  if (securityIndicator) {
    securityIndicator.classList.toggle('active', securityStatus.status === 'secure');
    const indicatorText = securityIndicator.querySelector('.indicator-text');
    if (indicatorText) {
      indicatorText.textContent = securityStatus.status === 'secure' ? 'Secure' : 'Warning';
    }
  }
  
  if (healthIndicator) {
    healthIndicator.classList.toggle('active', healthStatus.active);
    const indicatorText = healthIndicator.querySelector('.indicator-text');
    if (indicatorText) {
      indicatorText.textContent = healthStatus.active ? healthStatus.quality : 'Offline';
    }
  }
  
  if (dnsToggle) {
    dnsToggle.classList.toggle('active', securityStatus.dnsLeakProtection);
  }
  
  if (webRtcToggle) {
    webRtcToggle.classList.toggle('active', securityStatus.webRtcProtection);
  }
}

// Health Management
async function loadHealthStatus() {
  try {
    const result = await chrome.storage.local.get(['healthData']);
    if (result.healthData) {
      healthStatus = { ...healthStatus, ...result.healthData };
    }
    
    // Request current health status from background
    chrome.runtime.sendMessage({ action: 'getHealthStatus' })
      .then(status => {
        healthStatus = status;
        updateHealthUI();
      })
      .catch(console.error);
  } catch (error) { console.error('Error loading health status:', error); }
}

function updateHealthUI() {
  const healthIndicator = $('healthIndicator');
  const qualityBadge = $('qualityBadge');
  const latencyValue = $('latencyValue');
  
  if (healthIndicator) {
    healthIndicator.classList.remove('excellent', 'good', 'fair', 'poor');
    healthIndicator.classList.add(healthStatus.quality || 'excellent');
    healthIndicator.textContent = healthStatus.active ? 'Health: ' + (healthStatus.quality || 'Excellent') : 'Health: Offline';
  }
  
  if (qualityBadge) {
    qualityBadge.classList.remove('excellent', 'good', 'fair', 'poor');
    qualityBadge.classList.add(healthStatus.quality || 'excellent');
    qualityBadge.textContent = healthStatus.quality || 'Excellent';
  }
  
  if (latencyValue) {
    latencyValue.textContent = healthStatus.avgLatency ? healthStatus.avgLatency + 'ms' : '0ms';
  }
}

function setupHealthListeners() {
  // Health monitoring controls
  $('startHealthBtn').addEventListener('click', startHealthMonitoring);
  $('stopHealthBtn').addEventListener('click', stopHealthMonitoring);
  $('checkHealthBtn').addEventListener('click', checkHealthStatus);
}

async function startHealthMonitoring() {
  if (currentProxy) {
    try {
      await chrome.runtime.sendMessage({ action: 'startHealthMonitoring', proxy: currentProxy });
      showToast('Health monitoring started', 'info');
    } catch (error) {
      showToast('Failed to start health monitoring', 'error');
    }
  } else {
    showToast('Connect to a proxy first', 'warning');
  }
}

async function stopHealthMonitoring() {
  try {
    await chrome.runtime.sendMessage({ action: 'stopHealthMonitoring' });
    showToast('Health monitoring stopped', 'info');
  } catch (error) {
    showToast('Failed to stop health monitoring', 'error');
  }
}

async function checkHealthStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ action: 'getHealthStatus' });
    showToast(`Quality: ${status.quality} | Avg Latency: ${status.avgLatency}ms`, 'info');
  } catch (error) {
    showToast('Failed to get health status', 'error');
  }
}

async function toggleDnsLeakProtection() {
  const enabled = !securityStatus.dnsLeakProtection;
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'toggleDnsLeakProtection',
      enabled: enabled
    });
    
    if (result.success) {
      securityStatus.dnsLeakProtection = enabled;
      updateSecurityUI();
      showToast(`DNS leak protection ${enabled ? 'enabled' : 'disabled'}`, 'info');
    }
  } catch (error) {
    showToast('Failed to toggle DNS leak protection', 'error');
  }
}

async function toggleWebRtcProtection() {
  const enabled = !securityStatus.webRtcProtection;
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'toggleWebRtcProtection',
      enabled: enabled
    });

    if (result.success) {
      securityStatus.webRtcProtection = enabled;
      updateSecurityUI();
      showToast(`WebRTC protection ${enabled ? 'enabled' : 'disabled'}`, 'info');
    }
  } catch (error) {
    showToast('Failed to toggle WebRTC protection', 'error');
  }
}

function showSecurityStatus() {
  showToast(`Security: ${securityStatus.status} | DNS: ${securityStatus.dnsLeakProtection ? 'ON' : 'OFF'} | WebRTC: ${securityStatus.webRtcProtection ? 'ON' : 'OFF'}`, 'info');
}

// ===== Feature 1: Connection Quality Badge (v3.0 Inline) =====
function updateConnectionQuality(latency, packetLoss = 0) {
  connectionQuality.latency = latency || 0;
  connectionQuality.packetLoss = packetLoss;
  connectionQuality.quality = calculateConnectionQuality(latency, packetLoss);
  connectionQuality.lastUpdate = Date.now();

  // Update inline quality badge
  if (qualityBadgeInline) {
    qualityBadgeInline.className = `quality-badge ${connectionQuality.quality}`;
    qualityBadgeInline.textContent = connectionQuality.quality.charAt(0).toUpperCase() + connectionQuality.quality.slice(1);
  }
  if (qualityStats) {
    qualityStats.textContent = `${connectionQuality.latency}ms`;
  }
  
  // Show quality inline when connected
  if (connectionQualityInline && currentProxy) {
    connectionQualityInline.style.display = 'flex';
  }
}

function calculateConnectionQuality(latency, packetLoss) {
  if (!latency || packetLoss > 50) return 'poor';
  if (latency <= 100 && packetLoss <= 1) return 'excellent';
  if (latency <= 300 && packetLoss <= 5) return 'good';
  if (latency <= 500 && packetLoss <= 10) return 'fair';
  return 'poor';
}

// ===== Feature 2: IP Detector =====
async function checkIpAddresses() {
  if (ipInfo.isLoading) return;

  ipInfo.isLoading = true;
  if (ipCheckBtn) {
    ipCheckBtn.textContent = 'Checking...';
    ipCheckBtn.disabled = true;
  }

  try {
    // Check real IP (without proxy)
    const realIpPromise = (async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json', {
          method: 'GET',
          cache: 'no-store'
        });
        const data = await response.json();
        return data.ip;
      } catch (error) {
        return 'Unable to detect';
      }
    })();

    // Check proxy IP (through current proxy)
    const proxyIpPromise = (async () => {
      if (!currentProxy) {
        return 'Not connected';
      }
      try {
        const testConfig = {
          mode: 'fixed_servers',
          rules: {
            singleProxy: {
              scheme: currentProxy.type === 'SOCKS5' ? 'socks5' : 'http',
              host: currentProxy.ip,
              port: currentProxy.port
            },
            bypassList: ['localhost', '127.0.0.1']
          }
        };

        await chrome.proxy.settings.set({ value: testConfig, scope: 'regular' });

        const response = await fetch('https://api.ipify.org?format=json', {
          method: 'GET',
          cache: 'no-store'
        });

        await chrome.proxy.settings.clear({ scope: 'regular' });

        const data = await response.json();
        return data.ip;
      } catch (error) {
        return 'Proxy blocked';
      }
    })();

    const [realIp, proxyIp] = await Promise.all([realIpPromise, proxyIpPromise]);

    ipInfo.realIp = realIp;
    ipInfo.proxyIp = proxyIp;
    ipInfo.lastCheck = Date.now();

    if (ipRealValue) ipRealValue.textContent = realIp;
    if (ipProxyValue) ipProxyValue.textContent = proxyIp;

    // Check if IPs match (proxy not working)
    if (realIp && proxyIp && realIp === proxyIp && proxyIp !== 'Not connected') {
      showToast('⚠️ Warning: Proxy IP matches real IP!', 'warning');
    } else if (proxyIp && proxyIp !== 'Not connected' && proxyIp !== 'Proxy blocked') {
      showToast('✓ Proxy is working correctly', 'success');
    }

  } catch (error) {
    showToast('IP check failed: ' + error.message, 'error');
  } finally {
    ipInfo.isLoading = false;
    if (ipCheckBtn) {
      ipCheckBtn.textContent = 'Check IPs';
      ipCheckBtn.disabled = false;
    }
  }
}

// ===== Feature 3: Undo Disconnect =====
async function disconnectProxy() {
  try {
    // Save for undo
    lastDisconnectedProxy = currentProxy;

    await chrome.runtime.sendMessage({ action: 'clearProxy' });
    await chrome.runtime.sendMessage({ action: 'stopMonitoring' });
    await chrome.storage.local.remove(['activeProxy', 'connectionStartTime']);
    stopConnectionTimer();
    stopMonitoring();
    stopSpeedGraph();
    currentProxy = null;
    connectionStartTime = null;
    updateUI();
    filterProxies();
    renderQuickConnect();
    renderRecommended();

    // Show undo toast
    showToast('Disconnected', 'info', () => {
      // Undo callback
      if (disconnectTimeout) clearTimeout(disconnectTimeout);
      reconnectToLastProxy();
    });

    // Auto-clear after 5 seconds
    disconnectTimeout = setTimeout(() => {
      lastDisconnectedProxy = null;
    }, 5000);

  } catch (error) { showToast('Disconnect failed', 'error'); }
}

async function reconnectToLastProxy() {
  if (!lastDisconnectedProxy) return;

  const proxy = lastDisconnectedProxy;
  lastDisconnectedProxy = null;

  try {
    await chrome.runtime.sendMessage({ action: 'setProxy', proxy });
    currentProxy = proxy;
    connectionStartTime = Date.now();
    await chrome.storage.local.set({ activeProxy: proxy, connectionStartTime });
    startConnectionTimer();
    startMonitoring();
    startSpeedGraph();
    updateUI();
    filterProxies();
    renderQuickConnect();
    renderRecommended();
    showToast(`Reconnected to ${proxy.country}`, 'success');
  } catch (error) {
    showToast('Reconnect failed', 'error');
  }
}

// Onboarding Management
async function loadOnboardingState() {
  try {
    const result = await chrome.storage.local.get(['onboarding']);
    if (result.onboarding) {
      onboardingState = { ...onboardingState, ...result.onboarding };
    }
  } catch (error) { console.error('Error loading onboarding state:', error); }
}

// ===== Feature 4: Per-Site Proxy Rules =====
async function loadSiteRules() {
  try {
    const result = await chrome.storage.local.get(['siteRules']);
    siteRules = result.siteRules || [];
    // Ensure all rules have required fields (migration)
    siteRules = siteRules.map(rule => ({
      id: rule.id || Date.now(),
      url: rule.url || '',
      country: rule.country || '',
      proxyIps: rule.proxyIps || [],
      enabled: rule.enabled !== undefined ? rule.enabled : true,
      priority: rule.priority || 999,
      patternType: rule.patternType || 'exact'
    }));
  } catch (error) { console.error('Error loading site rules:', error); }
}

async function saveSiteRules() {
  try {
    await chrome.storage.local.set({ siteRules });
    showToast('Site rules saved', 'success');
  } catch (error) { showToast('Failed to save rules', 'error'); }
}

// Wildcard pattern matching
function matchesPattern(pattern, hostname, patternType = 'exact') {
  if (!pattern || !hostname) return false;
  
  switch (patternType) {
    case 'wildcard':
      // *.example.com matches sub.example.com
      if (pattern.startsWith('*.')) {
        const domain = pattern.slice(2);
        return hostname === domain || hostname.endsWith('.' + domain);
      }
      // *keyword* matches anything containing keyword
      if (pattern.startsWith('*') && pattern.endsWith('*')) {
        return hostname.includes(pattern.slice(1, -1));
      }
      return hostname.endsWith(pattern);
      
    case 'regex':
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(hostname);
      } catch (e) {
        return false;
      }
      
    case 'exact':
    default:
      return hostname === pattern || hostname.endsWith('.' + pattern);
  }
}

function showAddSiteRuleDialog() {
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
          ${[...new Set(proxies.map(p => p.country))].sort().map(c => 
            `<option value="${c}">${getFlag(c)} ${c}</option>`
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

  $('saveRuleBtn')?.addEventListener('click', async () => {
    const url = $('ruleUrl')?.value?.trim();
    const patternType = $('rulePatternType')?.value || 'exact';
    const priority = parseInt($('rulePriority')?.value) || 100;
    const country = $('ruleCountry')?.value;

    if (!url || !country) {
      showToast('Please fill all fields', 'warning');
      return;
    }

    // Find proxies from that country
    const countryProxies = proxies.filter(p => p.country === country);
    if (countryProxies.length === 0) {
      showToast('No proxies available for ' + country, 'warning');
      return;
    }

    siteRules.push({
      id: Date.now(),
      url,
      patternType,
      priority,
      country,
      proxyIps: countryProxies.map(p => p.ipPort),
      enabled: true
    });

    // Sort by priority
    siteRules.sort((a, b) => a.priority - b.priority);

    await saveSiteRules();
    renderSiteRules();
    dialog.remove();
    showToast('Rule added', 'success');
  });

  $('cancelRuleBtn')?.addEventListener('click', () => dialog.remove());
}

function handleSiteRuleAction(e) {
  const deleteBtn = e.target.closest('.delete-rule-btn');
  const toggleBtn = e.target.closest('.rule-toggle');
  
  if (deleteBtn) {
    const ruleId = parseInt(deleteBtn.dataset.id);
    siteRules = siteRules.filter(r => r.id !== ruleId);
    saveSiteRules();
    renderSiteRules();
    showToast('Rule deleted', 'info');
  }
  
  if (toggleBtn) {
    const ruleId = parseInt(toggleBtn.dataset.id);
    const rule = siteRules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = !rule.enabled;
      saveSiteRules();
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
      // Swap priorities
      const temp = siteRules[ruleIndex].priority;
      siteRules[ruleIndex].priority = siteRules[newIndex].priority;
      siteRules[newIndex].priority = temp;
      
      // Re-sort
      siteRules.sort((a, b) => a.priority - b.priority);
      
      saveSiteRules();
      renderSiteRules();
    }
  }
}

function renderSiteRules() {
  const container = $('siteRulesList');
  if (!container) return;

  // Sort by priority
  siteRules.sort((a, b) => a.priority - b.priority);

  if (siteRules.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No rules yet. Click "Manage Rules" to add one.</p>';
    return;
  }

  container.innerHTML = siteRules.map((rule, index) => `
    <div class="site-rule-item" data-id="${rule.id}">
      <div class="rule-priority-controls">
        <button class="priority-btn priority-up-btn" data-id="${rule.id}" ${index === 0 ? 'disabled' : ''}>▲</button>
        <span class="rule-priority">#${index + 1}</span>
        <button class="priority-btn priority-down-btn" data-id="${rule.id}" ${index === siteRules.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      <div class="rule-info">
        <span class="rule-url">${escapeHtml(rule.url)}</span>
        <span class="rule-pattern-type">${rule.patternType || 'exact'}</span>
        <span class="rule-country">${getFlag(rule.country)} ${rule.country}</span>
      </div>
      <div class="rule-actions-right">
        <div class="toggle rule-toggle ${rule.enabled ? 'active' : ''}" data-id="${rule.id}">
          <div class="toggle-knob"></div>
        </div>
        <button class="delete-rule-btn" data-id="${rule.id}" title="Delete rule">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function applySiteRule(url) {
  if (!url || siteRules.length === 0) return;
  
  // Find first matching enabled rule (sorted by priority)
  const sortedRules = [...siteRules].filter(r => r.enabled).sort((a, b) => a.priority - b.priority);
  const rule = sortedRules.find(r => matchesPattern(r.url, url, r.patternType));
  
  if (!rule || !currentProxy) return;

  // Check if current proxy matches the rule
  const matchingProxies = rule.proxyIps.filter(ip => ip === currentProxy.ipPort);
  if (matchingProxies.length === 0) {
    // Find a new proxy from the rule's country
    const newProxy = proxies.find(p => rule.proxyIps.includes(p.ipPort));
    if (newProxy) {
      showToast(`Auto-switching to ${rule.country} proxy for ${url}`, 'info');
      await chrome.runtime.sendMessage({ action: 'setProxy', proxy: newProxy });
      currentProxy = newProxy;
      await chrome.storage.local.set({ activeProxy: newProxy });
      updateUI();
    }
  }
}

// Feature 6: Apply rule for current tab
async function applyRuleForCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      showToast('No active tab found', 'warning');
      return;
    }
    
    let hostname;
    try {
      hostname = new URL(tab.url).hostname;
    } catch (e) {
      showToast('Invalid tab URL', 'error');
      return;
    }
    
    // Find matching rule
    const rule = siteRules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority)
      .find(r => matchesPattern(r.url, hostname, r.patternType));
    
    if (!rule) {
      showToast('No rule for this site. Create one in Settings.', 'info');
      return;
    }
    
    // Apply the rule's proxy
    const proxy = proxies.find(p => rule.proxyIps.includes(p.ipPort));
    if (!proxy) {
      showToast('No available proxies for ' + rule.country, 'warning');
      return;
    }
    
    await chrome.runtime.sendMessage({ action: 'setProxy', proxy });
    currentProxy = proxy;
    connectionStartTime = Date.now();
    await chrome.storage.local.set({ activeProxy: proxy, connectionStartTime });
    
    startConnectionTimer();
    startMonitoring();
    startSpeedGraph();
    updateUI();
    
    showToast(`Applied ${rule.country} proxy for ${hostname}`, 'success');
  } catch (error) {
    showToast('Failed to apply rule: ' + error.message, 'error');
  }
}

// ===== Feature 5: Auto-Rotation =====
async function loadAutoRotationSettings() {
  try {
    const result = await chrome.storage.local.get(['autoRotation']);
    if (result.autoRotation) {
      autoRotation = { ...autoRotation, ...result.autoRotation };
    }
    if (rotationToggle) {
      rotationToggle.classList.toggle('active', autoRotation.enabled);
    }
    if (rotationIntervalSelect) {
      rotationIntervalSelect.value = autoRotation.interval.toString();
    }
  } catch (error) { console.error('Error loading auto-rotation:', error); }
}

async function toggleAutoRotation() {
  autoRotation.enabled = !autoRotation.enabled;
  if (rotationToggle) {
    rotationToggle.classList.toggle('active', autoRotation.enabled);
  }
  await chrome.storage.local.set({ autoRotation });

  if (autoRotation.enabled) {
    startAutoRotation();
    showToast(`Auto-rotation enabled (${autoRotation.interval / 60000} min)`, 'info');
  } else {
    stopAutoRotation();
    showToast('Auto-rotation disabled', 'info');
  }
}

async function updateRotationInterval(e) {
  autoRotation.interval = parseInt(e.target.value);
  await chrome.storage.local.set({ autoRotation });

  if (autoRotation.enabled) {
    stopAutoRotation();
    startAutoRotation();
  }
  showToast(`Rotation interval: ${autoRotation.interval / 60000} min`, 'info');
}

function startAutoRotation() {
  if (autoRotation.timer) clearInterval(autoRotation.timer);

  autoRotation.timer = setInterval(async () => {
    if (!currentProxy || !autoRotation.enabled) return;

    try {
      // Find a new proxy from the same country with good stats
      const currentCountry = currentProxy.country;
      const alternatives = proxies.filter(p =>
        p.country === currentCountry &&
        p.ipPort !== currentProxy.ipPort &&
        p.speedMs < 300
      );

      if (alternatives.length === 0) {
        console.log('No alternative proxies found');
        return;
      }

      // Pick the fastest
      const newProxy = alternatives.sort((a, b) => a.speedMs - b.speedMs)[0];

      showToast(`Auto-rotating to ${newProxy.ipPort} (${newProxy.speedMs}ms)`, 'info');

      await chrome.runtime.sendMessage({ action: 'setProxy', proxy: newProxy });
      currentProxy = newProxy;
      connectionStartTime = Date.now();
      autoRotation.lastRotation = Date.now();
      await chrome.storage.local.set({ activeProxy: newProxy, connectionStartTime });

      startConnectionTimer();
      startSpeedGraph();
      updateUI();
      filterProxies();

    } catch (error) {
      console.error('Auto-rotation failed:', error);
    }
  }, autoRotation.interval);
}

function stopAutoRotation() {
  if (autoRotation.timer) {
    clearInterval(autoRotation.timer);
    autoRotation.timer = null;
  }
}

// Task 7: Enhanced Onboarding for v2.2.0
const onboardingSteps = [
  {
    id: 'welcome',
    image: '🛡️',
    title: 'Welcome to ProxyMania VPN',
    content: 'Your free VPN service using ProxyMania proxy servers. Let\'s get you started!'
  },
  {
    id: 'connectivity',
    image: '🔌',
    title: 'Quick Connection',
    content: 'Click any proxy or use Quick Connect to start browsing securely. The green status means you\'re connected!'
  },
  {
    id: 'quality',
    image: '🟢',
    title: 'Connection Quality',
    content: 'See real-time connection quality. Green = excellent, Red = poor. Shows latency and packet loss.'
  },
  {
    id: 'ip-detector',
    image: '🌐',
    title: 'IP Detector',
    content: 'Click "Check IPs" to verify your proxy is working. Your proxy IP should differ from your real IP.'
  },
  {
    id: 'site-rules',
    image: '🎯',
    title: 'Per-Site Rules',
    content: 'Auto-switch proxies for specific websites. Set rules in Settings → Advanced Features.'
  },
  {
    id: 'auto-rotation',
    image: '🔄',
    title: 'Auto-Rotation',
    content: 'Automatically rotate to fresh proxies at set intervals. Enable in Settings → Advanced Features.'
  },
  {
    id: 'undo',
    image: '↩️',
    title: 'Undo Disconnect',
    content: 'Accidentally disconnected? Click Undo within 5 seconds to reconnect instantly!'
  },
  {
    id: 'shortcuts',
    image: '⌨️',
    title: 'Keyboard Shortcuts',
    content: 'Power user tips: Ctrl+K search, Ctrl+D disconnect, Ctrl+I check IPs, / focuses search.'
  },
  {
    id: 'complete',
    image: '🎉',
    title: 'You\'re All Set!',
    content: 'Enjoy secure browsing with ProxyMania VPN. You can always revisit this tutorial in Settings.'
  }
];

function showOnboarding() {
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.className = 'onboarding-overlay';
  overlay.innerHTML = `
    <div class="onboarding-container">
      <div class="onboarding-header">
        <div class="onboarding-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <span class="progress-text">Step 1 of ${onboardingSteps.length}</span>
        </div>
        <button class="onboarding-skip" title="Skip Tutorial">Skip</button>
      </div>

      <div class="onboarding-content">
        <div class="onboarding-image">${onboardingSteps[0].image}</div>
        <h3 class="onboarding-title">${onboardingSteps[0].title}</h3>
        <div class="onboarding-text">${onboardingSteps[0].content}</div>
      </div>

      <div class="onboarding-actions">
        <button class="onboarding-btn onboarding-btn-primary">Get Started</button>
        <button class="onboarding-btn onboarding-btn-secondary" style="display:none">Back</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let currentStep = 0;
  const updateStep = (stepIndex) => {
    const step = onboardingSteps[stepIndex];
    const content = overlay.querySelector('.onboarding-content');
    const progress = overlay.querySelector('.progress-text');
    const progressFill = overlay.querySelector('.progress-fill');
    const backBtn = overlay.querySelector('.onboarding-btn-secondary');
    const nextBtn = overlay.querySelector('.onboarding-btn-primary');

    if (content) {
      content.innerHTML = `
        <div class="onboarding-image">${step.image}</div>
        <h3 class="onboarding-title">${step.title}</h3>
        <div class="onboarding-text">${step.content}</div>
      `;
    }

    if (progress) {
      progress.textContent = `Step ${stepIndex + 1} of ${onboardingSteps.length}`;
    }

    if (progressFill) {
      progressFill.style.width = `${((stepIndex + 1) / onboardingSteps.length) * 100}%`;
    }

    if (backBtn) {
      backBtn.style.display = stepIndex > 0 ? 'inline-block' : 'none';
    }

    if (nextBtn) {
      nextBtn.textContent = stepIndex === onboardingSteps.length - 1 ? 'Finish' : 'Next';
    }
  };

  // Add event listeners
  overlay.querySelector('.onboarding-skip').addEventListener('click', completeOnboarding);
  
  overlay.querySelector('.onboarding-btn-primary').addEventListener('click', () => {
    if (currentStep < onboardingSteps.length - 1) {
      currentStep++;
      updateStep(currentStep);
    } else {
      completeOnboarding();
    }
  });
  
  overlay.querySelector('.onboarding-btn-secondary').addEventListener('click', () => {
    if (currentStep > 0) {
      currentStep--;
      updateStep(currentStep);
    }
  });
}

function hideOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    overlay.remove();
  }
}

async function startOnboarding() {
  try {
    onboardingState.completed = false;
    onboardingState.currentStepIndex = 0;
    await chrome.storage.local.set({ onboarding: onboardingState });
    hideOnboarding();
    showOnboarding();
  } catch (error) {
    showToast('Failed to start onboarding', 'error');
  }
}

async function completeOnboarding() {
  try {
    onboardingState.completed = true;
    await chrome.storage.local.set({ onboarding: onboardingState });
    hideOnboarding();
    showToast('Onboarding complete!', 'info');
  } catch (error) {
    showToast('Failed to complete onboarding', 'error');
  }
}

function showOnboardingStep(step) {
  // Update onboarding overlay with current step
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    const content = overlay.querySelector('.onboarding-content');
    const progress = overlay.querySelector('.progress-text');
    const progressFill = overlay.querySelector('.progress-fill');
    
    if (content) {
      content.innerHTML = `
        <div class="onboarding-image">${step.image}</div>
        <h3 class="onboarding-title">${step.title}</h3>
        <div class="onboarding-text">${step.content}</div>
      `;
    }
    
    if (progress) {
      progress.textContent = `Step ${step.id === 'complete' ? 7 : step.id === 'welcome' ? 1 : step.id === 'connectivity' ? 2 : step.id === 'security' ? 3 : step.id === 'connecting' ? 4 : step.id === 'filters' ? 5 : 6} of 7`;
    }
    
    if (progressFill) {
      const stepIndex = step.id === 'complete' ? 7 : step.id === 'welcome' ? 1 : step.id === 'connectivity' ? 2 : step.id === 'security' ? 3 : step.id === 'connecting' ? 4 : step.id === 'filters' ? 5 : 6;
      progressFill.style.width = `${(stepIndex / 7) * 100}%`;
    }
  }
}

// Security event handlers
function handleSecurityAlert(message) {
  const { type, details } = message;
  
  if (type === 'dnsLeak') {
    showToast('⚠️ DNS leak detected! Protection is active.', 'warning');
  } else if (type === 'webRtcLeak') {
    showToast('⚠️ WebRTC leak detected! Protection is active.', 'warning');
  }
  
  // Update security status
  securityStatus.status = 'warning';
  updateSecurityUI();
}

function updateSecurityStatus(message) {
  securityStatus = { ...securityStatus, ...message };
  updateSecurityUI();
  
  if (message.status === 'breach') {
    showToast('🚨 Security breach detected! Check connection status.', 'error');
  }
}

function handleConnectionDegraded(message) {
  const { type, quality, latency, packetLoss } = message;
  
  if (type === 'quality' && quality === 'poor') {
    showToast('⚠️ Connection quality degraded to poor', 'warning');
  } else if (type === 'latency' && latency > 500) {
    showToast(`⚠️ High latency detected: ${latency}ms`, 'warning');
  } else if (type === 'packetLoss' && packetLoss > 10) {
    showToast(`⚠️ High packet loss: ${packetLoss}%`, 'warning');
  }
  
  // Update health status
  if (healthStatus) {
    healthStatus.quality = quality || 'poor';
    updateHealthUI();
  }
}

function updateHealthStatus(message) {
  healthStatus = { ...healthStatus, ...message };
  updateHealthUI();

  // Also update connection quality badge
  if (message.avgLatency !== undefined) {
    updateConnectionQuality(message.avgLatency, message.packetLoss || 0);
  }

  if (message.quality === 'poor') {
    showToast('🚨 Connection quality is poor. Consider switching proxies.', 'error');
  }
}

function saveSettings() {
  chrome.storage.local.set({ settings }).catch(console.error);
}

function applyTheme() {
  let theme = settings.theme;
  if (theme === 'auto') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
  // Theme button is now in overflow menu - update if exists
  if (typeof themeBtn !== 'undefined' && themeBtn) {
    themeBtn.innerHTML = theme === 'dark'
      ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
      : '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  }
}

function setupThemeWatcher() {
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (settings.theme === 'auto') {
        applyTheme();
      }
    });
  }
}

function setupSearchListener() {
  if (proxySearch) {
    proxySearch.addEventListener('input', () => {
      filterProxies();
    });
  }
}

function toggleTheme() {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  saveSettings();
  showToast(`Switched to ${settings.theme} theme`, 'info');
}

// Panel Management
function showPanel(name) {
  if (name === 'settings') {
    if (settingsPanel) settingsPanel.style.display = 'block';
    renderSiteRules(); // Feature 4: Show site rules
  } else if (name === 'stats') {
    updateStatsDisplay();
    if (statsPanel) statsPanel.style.display = 'block';
  }
}

function hidePanel(name) {
  if (name === 'settings' && settingsPanel) settingsPanel.style.display = 'none';
  else if (name === 'stats' && statsPanel) statsPanel.style.display = 'none';
}

// Stats Management
async function loadDailyStats() {
  try {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get(['dailyStats', 'statsDate']);
    if (result.statsDate !== today) {
      dailyStats = { proxiesUsed: 0, connectionTime: 0, attempts: 0, successes: 0 };
      await chrome.storage.local.set({ dailyStats, statsDate: today });
    } else if (result.dailyStats) {
      dailyStats = result.dailyStats;
    }
  } catch (error) { console.error('Error loading stats:', error); }
}

function updateDailyStats(updates) {
  dailyStats = { ...dailyStats, ...updates };
  chrome.storage.local.set({ dailyStats }).catch(console.error);
}

function updateStatsDisplay() {
  $('statProxiesUsed').textContent = dailyStats.proxiesUsed;
  
  const hours = Math.floor(dailyStats.connectionTime / 3600);
  const mins = Math.floor((dailyStats.connectionTime % 3600) / 60);
  $('statConnectionTime').textContent = `${hours}h ${mins}m`;
  
  const rate = dailyStats.attempts > 0 
    ? Math.round((dailyStats.successes / dailyStats.attempts) * 100) 
    : 0;
  $('statSuccessRate').textContent = rate + '%';
  
  // Top countries
  const countryCount = {};
  proxies.forEach(p => {
    const stats = proxyStats[p.ipPort];
    if (stats && stats.successes > 0) {
      countryCount[p.country] = (countryCount[p.country] || 0) + stats.successes;
    }
  });
  
  const topCountries = Object.entries(countryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  $('topCountriesList').innerHTML = topCountries.map(([country, count]) => `
    <div class="setting">
      <span>${getFlag(country)} ${country}</span>
      <span style="color: var(--accent-primary); font-weight: 600;">${count} connections</span>
    </div>
  `).join('') || '<p style="color: var(--text-secondary); text-align: center;">No data yet</p>';
  
  // Connection history (recent proxies)
  const recentProxies = Object.entries(proxyStats)
    .filter(([, s]) => s.lastSuccess)
    .sort((a, b) => b[1].lastSuccess - a[1].lastSuccess)
    .slice(0, 5);
  
  $('connectionHistoryList').innerHTML = recentProxies.map(([ipPort, stats]) => {
    const proxy = proxies.find(p => p.ipPort === ipPort);
    return `
      <div class="setting">
        <div>
          <div style="font-weight: 600;">${proxy ? getFlag(proxy.country) : '🌍'} ${ipPort}</div>
          <div style="font-size: 10px; color: var(--text-secondary);">
            Success: ${stats.successRate}% | Avg: ${stats.avgLatency || 0}ms
          </div>
        </div>
      </div>
    `;
  }).join('') || '<p style="color: var(--text-secondary); text-align: center;">No connections yet</p>';
}

// Load favorites from storage
async function loadFavorites() {
  try {
    const result = await chrome.storage.local.get(['favorites']);
    favorites = result.favorites || [];
  } catch (error) { console.error('Error loading favorites:', error); }
}

// Load proxy stats
async function loadProxyStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getProxyStats' });
    proxyStats = response.stats || {};
  } catch (error) { proxyStats = {}; }
}

// Load current proxy
async function loadCurrentProxy() {
  try {
    const result = await chrome.storage.local.get(['activeProxy', 'connectionStartTime']);
    currentProxy = result.activeProxy || null;
    if (currentProxy && result.connectionStartTime) {
      connectionStartTime = result.connectionStartTime;
      if (connectionTimer) startConnectionTimer();
    }
    updateUI();
  } catch (error) { console.error('Error loading current proxy:', error); }
}

// Load proxies
async function loadProxies() {
  showLoading(true);
  
  try {
    const cached = await chrome.storage.local.get(['proxies', 'proxiesTimestamp']);
    if (cached.proxies?.length > 0) {
      proxies = cached.proxies;
      await loadProxyStats();
      populateCountryFilter();
      filterProxies();
      updateProxyCount();
      renderQuickConnect();
      renderRecommended();
      showLoading(false);
    }
  } catch (error) { console.error('Error loading cached:', error); }
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'fetchProxies' });
    if (response?.proxies) {
      proxies = response.proxies;
      await chrome.storage.local.set({ proxies, proxiesTimestamp: Date.now() });
      await loadProxyStats();
      populateCountryFilter();
      filterProxies();
      updateProxyCount();
      renderQuickConnect();
      renderRecommended();
      if (proxies.length > 0) showToast(`Loaded ${proxies.length} proxies`, 'info');
    }
  } catch (error) {
    if (!proxies.length) showEmptyState('noProxies');
    else showToast('Using cached proxies', 'warning');
  } finally {
    showLoading(false);
  }
}

// Populate country filter
function populateCountryFilter() {
  if (!countryFilter) return;
  const countries = [...new Set(proxies.map(p => p.country))].sort();
  countryFilter.innerHTML = '<option value="">🌍 All Countries</option>';
  countries.forEach(country => {
    const opt = document.createElement('option');
    opt.value = country;
    opt.textContent = `${getFlag(country)} ${country}`;
    countryFilter.appendChild(opt);
  });
}

// Filter proxies
async function filterProxies() {
  const selectedCountry = countryFilter?.value || '';
  const selectedType = typeFilter?.value || '';
  const activeChip = filterChips?.querySelector('.chip-active');
  const speedFilter = activeChip?.dataset?.filter === 'speed' ? activeChip.dataset.value : 'all';
  const searchQuery = proxySearch?.value?.toLowerCase() || '';

  let filtered = proxies;

  // Apply search filter
  if (searchQuery) {
    filtered = filtered.filter(p =>
      p.ipPort.toLowerCase().includes(searchQuery) ||
      p.country.toLowerCase().includes(searchQuery) ||
      p.type.toLowerCase().includes(searchQuery) ||
      p.ip.toLowerCase().includes(searchQuery)
    );
  }

  if (currentTab === 'favorites') {
    filtered = filtered.filter(p => favorites.some(f => f.ipPort === p.ipPort));
  } else if (currentTab === 'recent') {
    try {
      const result = await chrome.storage.local.get(['recentlyUsed']);
      const recent = result.recentlyUsed || [];
      filtered = filtered.filter(p => recent.some(r => r.proxy && r.proxy.ipPort === p.ipPort));
    } catch (error) {
      console.error('Error loading recent proxies:', error);
      filtered = [];
    }
  }

  applyFilters(filtered, selectedCountry, selectedType, speedFilter);
}

function applyFilters(filtered, country, type, speed) {
  if (!proxyList) return;
  
  if (country) filtered = filtered.filter(p => p.country === country);
  if (type) filtered = filtered.filter(p => p.type === type);
  if (speed === 'fast') filtered = filtered.filter(p => p.speedMs < 100);
  if (speed === 'medium') filtered = filtered.filter(p => p.speedMs < 300);
  
  // Calculate scores and sort
  filtered = filtered.map(p => ({ ...p, score: calculateProxyScore(p) }))
    .sort((a, b) => b.score - a.score);
  
  // "Best" filter - show only top 10 by score (score >= 60)
  if (speed === 'best') {
    filtered = filtered.filter(p => p.score >= 60);
  }

  renderProxyList(filtered);
}

// Calculate proxy score
function calculateProxyScore(proxy) {
  const stats = proxyStats[proxy.ipPort] || { successRate: 50, avgLatency: 100 };
  const speedScore = Math.max(0, 100 - proxy.speedMs / 5);
  const reliabilityScore = stats.successRate || 50;
  let freshnessScore = 50;
  if (proxy.lastCheck) {
    if (proxy.lastCheck.includes('только что')) freshnessScore = 100;
    else if (proxy.lastCheck.includes('1 мин')) freshnessScore = 90;
    else if (proxy.lastCheck.includes('2 мин')) freshnessScore = 80;
    else if (proxy.lastCheck.includes('3 мин')) freshnessScore = 70;
  }
  const favoriteBonus = favorites.some(f => f.ipPort === proxy.ipPort) ? 10 : 0;
  return (speedScore * 0.4) + (reliabilityScore * 0.4) + (freshnessScore * 0.2) + favoriteBonus;
}

// Get recommended proxies
function getRecommendedProxies(excludeProxy = null) {
  return proxies
    .filter(p => !excludeProxy || p.ipPort !== excludeProxy.ipPort)
    .map(p => ({ ...p, score: calculateProxyScore(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function getBestProxy() {
  const oneHourAgo = Date.now() - 3600000;
  
  return proxies
    .map(p => {
      const stats = proxyStats[p.ipPort] || {};
      const recentSuccess = stats.lastSuccess && stats.lastSuccess > oneHourAgo;
      const hasGoodSuccessRate = !stats.successRate || stats.successRate >= 50;
      
      return {
        proxy: p,
        score: (recentSuccess ? 100 : 0) + (hasGoodSuccessRate ? 50 : 0) - (p.speedMs / 10)
      };
    })
    .filter(p => p.score > 50)
    .sort((a, b) => b.score - a.score)[0]?.proxy;
}

async function connectToBestProxy() {
  const best = getBestProxy();
  if (best) {
    showToast(`Connecting to best proxy: ${best.country}`, 'info');
    await connectToProxy(best, { target: { closest: () => null, querySelector: () => null } });
  } else {
    showToast('No suitable proxy found', 'warning');
  }
}

// Render recommended
function renderRecommended() {
  const recommended = getRecommendedProxies();
  if (!recommended.length || recommended[0].score < 60) {
    if (recommendedSection) recommendedSection.style.display = 'none';
    return;
  }
  if (recommendedSection) recommendedSection.style.display = 'block';
  if (!recommendedList) return;
  recommendedList.innerHTML = recommended.slice(0, 3).map(proxy => {
    const stats = proxyStats[proxy.ipPort] || {};
    return `
      <div class="recommended-item" data-proxy="${proxy.ipPort}">
        <div class="rec-info">
          <span class="rec-flag">${getFlag(proxy.country)}</span>
          <span class="rec-country">${proxy.country}</span>
          <span class="rec-type">${proxy.type}</span>
        </div>
        <div class="rec-stats">
          <span class="rec-speed">⚡ ${proxy.speedMs}ms</span>
          ${stats.successRate ? `<span class="rec-rate">✓ ${stats.successRate}%</span>` : ''}
        </div>
        <button class="rec-connect-btn">Connect</button>
      </div>
    `;
  }).join('');
  
  recommendedList.querySelectorAll('.recommended-item').forEach(item => {
    const proxy = proxies.find(p => p.ipPort === item.dataset.proxy);
    item.querySelector('.rec-connect-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (proxy) connectToProxy(proxy, { target: item });
    });
    item.addEventListener('click', () => {
      if (proxy) connectToProxy(proxy, { target: item });
    });
  });
}

// Render proxy list
function renderProxyList(proxyItems) {
  if (!proxyList) return;
  proxyList.innerHTML = '';
  if (!proxyItems.length) {
    showEmptyState(currentTab === 'favorites' ? 'noFavorites' : 'noResults');
    return;
  }
  proxyItems.forEach(proxy => proxyList.appendChild(createProxyItem(proxy, proxyItems)));
}

// Create proxy item
function createProxyItem(proxy, proxyItemsList) {
  const item = document.createElement('div');
  item.className = 'proxy-item' + (currentProxy?.ipPort === proxy.ipPort ? ' active' : '');
  const stats = proxyStats[proxy.ipPort] || {};
  const flag = getFlag(proxy.country);
  const isFav = favorites.some(f => f.ipPort === proxy.ipPort);
  const workingStatus = getWorkingStatus(proxy);
  
  item.innerHTML = `
    <div class="proxy-info">
      <div class="proxy-ip">
        <span class="proxy-flag">${flag}</span>
        <span>${proxy.ipPort}</span>
        ${isFav ? '<span class="fav-indicator">⭐</span>' : ''}
      </div>
      <div class="proxy-details">
        <span>${proxy.country}</span>
        <span class="proxy-type">${proxy.type}</span>
        <span class="proxy-speed">⚡ ${proxy.speedMs}ms</span>
        ${stats.successRate ? `<span class="proxy-rate">✓ ${stats.successRate}%</span>` : ''}
        ${workingStatus !== 'unknown' ? `<span class="proxy-status ${workingStatus}">${workingStatus === 'good' ? '✓' : '⚠'}</span>` : ''}
      </div>
      ${stats.avgLatency && stats.latencies?.length ? renderSparkline(stats.latencies) : ''}
    </div>
    <div class="proxy-actions">
      <button class="icon-btn fav-btn ${isFav ? 'active' : ''}">${isFav ? '⭐' : '☆'}</button>
      <button class="connect-btn ${currentProxy?.ipPort === proxy.ipPort ? 'active' : ''}">
        ${currentProxy?.ipPort === proxy.ipPort ? 'Connected' : 'Connect'}
      </button>
    </div>
  `;
  
  item.querySelector('.fav-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    await toggleFavorite(proxy);
    renderProxyList(proxyItemsList);
    renderRecommended();
  });
  
  item.querySelector('.connect-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    connectToProxy(proxy, { target: item });
  });
  
  return item;
}

// Render sparkline
function renderSparkline(latencies) {
  if (latencies.length < 2) return '';
  const w = 60, h = 20;
  const max = Math.max(...latencies, 100), min = Math.min(...latencies);
  const range = max - min || 1;
  const points = latencies.slice(-10).map((lat, i) => {
    const x = (i / 9) * w;
    const y = h - ((lat - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const color = latencies[latencies.length - 1] < 100 ? '#2ed573' : latencies[latencies.length - 1] < 300 ? '#64ffda' : '#ffa502';
  return `<div class="sparkline-container"><svg width="${w}" height="${h}" class="sparkline"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
}

// Get working status
function getWorkingStatus(proxy) {
  if (!proxy.lastCheck) return 'unknown';
  const recent = ['только что', '1 мин', '2 мин', '3 мин'].some(t => proxy.lastCheck.includes(t));
  return recent ? 'good' : 'warning';
}

// Render quick connect
function renderQuickConnect() {
  if (!quickConnectGrid || !quickConnectSection) return;
  
  const fastest = proxies.filter(p => p.speedMs < 150 && getWorkingStatus(p) === 'good')
    .sort((a, b) => a.speedMs - b.speedMs).slice(0, 4);

  if (!fastest.length) { quickConnectSection.style.display = 'none'; return; }
  quickConnectSection.style.display = 'block';

  quickConnectGrid.innerHTML = fastest.map(p => `
    <button class="quick-connect-btn" data-proxy="${p.ipPort}">
      <span class="qc-flag">${getFlag(p.country)}</span>
      <span class="qc-country">${p.country}</span>
      <span class="qc-speed">${p.speedMs}ms</span>
    </button>
  `).join('');

  quickConnectGrid.querySelectorAll('.quick-connect-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const proxy = proxies.find(p => p.ipPort === btn.dataset.proxy);
      if (proxy) await connectToProxy(proxy, { target: btn });
    });
  });
}

// Switch tab
function switchToTab(tabName) {
  currentTab = tabName;
  
  // Update old tabs if they exist
  if (mainTabs) {
    mainTabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('tab-active', t.dataset.tab === tabName));
  }
  
  // Update new tab chips if they exist
  if (tabChips) {
    tabChips.querySelectorAll('.chip').forEach(t => t.classList.toggle('chip-active', t.dataset.tab === tabName));
  }
  
  listTitle.textContent = { all: 'Available Proxies', favorites: '⭐ Favorites', recent: '🕐 Recently Used' }[tabName];
  filterProxies();
}

// Connect to proxy
async function connectToProxy(proxy, event) {
  const proxyItem = event.target.closest('.proxy-item') || event.target;
  proxyItem?.classList.add('connecting');
  
  // Find the connect button (could be the proxy item itself or a child button)
  const connectBtn = event.target.querySelector?.('.connect-btn') || event.target;
  if (connectBtn && connectBtn.textContent) {
    connectBtn.textContent = '🧪 Testing...';
  }
  
  if (testStatus) {
    testStatus.style.display = 'block';
    if (testText) testText.textContent = 'Testing proxy connectivity...';
  }
  
  try {
    if (settings.testBeforeConnect) {
      const testResult = await chrome.runtime.sendMessage({ action: 'testProxy', proxy });
      await chrome.runtime.sendMessage({ action: 'updateProxyStats', proxy, success: testResult.success, latency: testResult.latency });
      await loadProxyStats();
      if (!testResult.success) throw new Error('Proxy test failed');
      if (testText) testText.textContent = `✓ Test passed (${testResult.latency}ms)`;
      await new Promise(r => setTimeout(r, 500));
    }
    
    await chrome.runtime.sendMessage({ action: 'setProxy', proxy });
    await chrome.runtime.sendMessage({ action: 'setFailoverProxies', proxies, currentProxy: proxy });
    
    currentProxy = proxy;
    connectionStartTime = Date.now();
    await chrome.storage.local.set({ activeProxy: proxy, connectionStartTime });
    await addToRecentlyUsed(proxy);
    updateDailyStats({ proxiesUsed: dailyStats.proxiesUsed + 1 });
    
    startConnectionTimer();
    startMonitoring();
    startSpeedGraph();
    updateUI();
    filterProxies();
    renderQuickConnect();
    renderRecommended();
    showToast(`Connected to ${proxy.country} (${proxy.speedMs}ms)`, 'success');
  } catch (error) {
    showToast(`Connection failed: ${error.message}`, 'error');
    updateDailyStats({ attempts: dailyStats.attempts + 1 });
    if (settings.autoFailover) {
      const result = await chrome.runtime.sendMessage({ action: 'getNextFailoverProxy' });
      if (result.proxy) {
        showToast('Auto-failover: Trying ' + result.proxy.country, 'info');
        await connectToProxy(result.proxy, event);
        return;
      }
    }
  } finally {
    proxyItem?.classList.remove('connecting');
    if (testStatus) testStatus.style.display = 'none';
  }
}

// Disconnect (removed - duplicate, see line 855)

// Toggle favorite
async function toggleFavorite(proxy) {
  const idx = favorites.findIndex(f => f.ipPort === proxy.ipPort);
  if (idx === -1) {
    favorites.push({ ...proxy, favoritedAt: Date.now() });
    showToast(`Added ${proxy.country} to favorites`, 'success');
  } else {
    favorites.splice(idx, 1);
    showToast('Removed from favorites', 'info');
  }
  await chrome.storage.local.set({ favorites });
}

// Add to recently used
async function addToRecentlyUsed(proxy) {
  try {
    const { recentlyUsed = [] } = await chrome.storage.local.get(['recentlyUsed']);
    const filtered = recentlyUsed.filter(r => r && r.proxy && r.proxy.ipPort !== proxy.ipPort);
    filtered.unshift({ proxy: { ...proxy }, lastUsed: Date.now() });
    await chrome.storage.local.set({ recentlyUsed: filtered.slice(0, 10) });
  } catch (error) { console.error(error); }
}

// Monitoring
function startMonitoring() {
  if (currentProxy && !monitoringActive) {
    chrome.runtime.sendMessage({ action: 'startMonitoring', proxy: currentProxy });
    monitoringActive = true;
  }
}

function stopMonitoring() {
  if (monitoringActive) {
    chrome.runtime.sendMessage({ action: 'stopMonitoring' });
    monitoringActive = false;
  }
}

// Timer
function startConnectionTimer() {
  if (connectionTimer) {
    connectionTimer.style.display = 'flex';
  }
  updateTimerDisplay();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  if (!connectionStartTime) return;
  const elapsed = Date.now() - connectionStartTime;
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  timerValue.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function stopConnectionTimer() {
  connectionTimer.style.display = 'none';
  if (timerInterval) clearInterval(timerInterval);
  timerValue.textContent = '00:00';
}

// Update timer on disconnect
function updateConnectionTime() {
  if (connectionStartTime) {
    const elapsed = Math.floor((Date.now() - connectionStartTime) / 1000);
    updateDailyStats({ connectionTime: dailyStats.connectionTime + elapsed });
  }
}

// Update UI - v3.0 Unified Connection Card
function updateUI() {
  if (currentProxy) {
    // Status badge
    statusIndicator.classList.add('connected');
    statusText.textContent = 'Connected';

    // Proxy display
    if (currentProxyDisplay) {
      currentProxyDisplay.style.display = 'flex';
      if (proxyFlag) proxyFlag.textContent = getFlag(currentProxy.country);
      if (proxyAddress) proxyAddress.textContent = currentProxy.ipPort;
      if (proxyCountry) proxyCountry.textContent = currentProxy.country;
    }

    // Timer
    if (connectionTimer) connectionTimer.style.display = 'flex';

    // Quality badge inline
    if (connectionQualityInline) {
      connectionQualityInline.style.display = 'flex';
    }

    // Update FAB
    updateFab();

  } else {
    // Status badge
    statusIndicator.classList.remove('connected');
    statusText.textContent = 'Disconnected';

    // Proxy display
    if (currentProxyDisplay) {
      currentProxyDisplay.style.display = 'none';
    }

    // Timer
    if (connectionTimer) connectionTimer.style.display = 'none';

    // Quality badge inline
    if (connectionQualityInline) {
      connectionQualityInline.style.display = 'none';
    }

    // Reset IP detector
    if (ipRealValue) ipRealValue.textContent = '--';
    if (ipProxyValue) ipProxyValue.textContent = '--';
    if (ipDetectorContent) ipDetectorContent.style.display = 'none';
    ipInfo.expanded = false;

    // Update FAB
    updateFab();
    
    monitoringActive = false;
  }

  updateSecurityUI();
  updateFab();
}

function updateProxyCount() { proxyCount.textContent = proxies.length; }

function showLoading(show) {
  if (loading) {
    loading.style.display = show ? 'flex' : 'none';
  }
  if (show && proxyList) {
    proxyList.innerHTML = '';
  }
  if (emptyState) {
    emptyState.style.display = 'none';
  }
}

// Empty State - v3.0
function showEmptyState(type) {
  if (!emptyState) return;
  
  const msgs = {
    noProxies: { icon: '📭', title: 'No Proxies', msg: 'Failed to load. Check your connection.', action: 'Retry' },
    noResults: { icon: '🔍', title: 'No Matches', msg: 'Try adjusting your filters or search.', action: 'Clear Filters' },
    noFavorites: { icon: '⭐', title: 'No Favorites', msg: 'Star proxies to save them for quick access.', action: 'Browse All' }
  };
  
  const { icon, title, msg, action } = msgs[type];
  
  emptyState.innerHTML = `
    <div class="empty-icon">${icon}</div>
    <h4>${title}</h4>
    <p>${msg}</p>
    <button class="btn btn-primary" id="emptyActionBtn">${action}</button>
  `;
  
  loading.style.display = 'none';
  proxyList.innerHTML = '';
  emptyState.style.display = 'flex';
  
  // Add action handler
  const actionBtn = $('emptyActionBtn');
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      if (type === 'noProxies') loadProxies();
      else if (type === 'noResults') {
        countryFilter.value = '';
        typeFilter.value = '';
        filterProxies();
      }
      else if (type === 'noFavorites') switchToTab('all');
    });
  }
}

// Toast
function showToast(message, type = 'info', onUndo = null) {
  if (!settings.notifications && type !== 'error') return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  
  let undoHtml = '';
  if (onUndo) {
    undoHtml = `<button class="toast-undo" onclick="event.stopPropagation();">Undo</button>`;
  }
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
    ${undoHtml}
  `;
  
  toastContainer.appendChild(toast);
  
  // Add undo listener
  if (onUndo) {
    const undoBtn = toast.querySelector('.toast-undo');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        toast.remove();
        onUndo();
      });
    }
  }
  
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => { toast.classList.add('toast-hide'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// Handle degradation
function handleProxyDegraded(message) {
  const { proxy, latency, success, monitoringTime } = message;
  
  if (!success) {
    showToast(`⚠️ Proxy ${proxy.ipPort} stopped working`, 'warning');
    
    // Auto-failover if enabled
    if (settings.autoFailover) {
      chrome.runtime.sendMessage({ action: 'getNextFailoverProxy' })
        .then(result => {
          if (result.proxy) {
            showToast('Auto-failover: Trying ' + result.proxy.country, 'info');
            connectToProxy(result.proxy, { target: document.body });
          }
        })
        .catch(error => {
          showToast('Auto-failover failed: ' + error.message, 'error');
        });
    }
  } else if (latency > 500) {
    showToast(`⚠️ High latency (${latency}ms)`, 'warning');
  }
  
  // Log degradation event
  console.log('Proxy degradation detected:', {
    proxy: proxy.ipPort,
    latency: latency,
    success: success,
    monitoringTime: monitoringTime
  });
}

// Auto refresh
let refreshTimer;
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (settings.refreshInterval > 0) {
    refreshTimer = setInterval(loadProxies, settings.refreshInterval);
  }
}

// Import/Export
async function importProxies() {
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
        proxies = [...proxies, ...imported];
        await chrome.storage.local.set({ proxies });
        showToast(`Imported ${imported.length} proxies`, 'success');
        loadProxies();
      }
    } catch {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      const imported = lines.map(line => {
        const [ip, port] = line.split(':');
        return { ip, port: parseInt(port), ipPort: line, country: 'Unknown', type: 'HTTPS', speedMs: 9999 };
      }).filter(p => p.ip && p.port);
      proxies = [...proxies, ...imported];
      await chrome.storage.local.set({ proxies });
      showToast(`Imported ${imported.length} proxies`, 'success');
      loadProxies();
    }
  };
  input.click();
}

function exportProxies() {
  const working = proxies.filter(p => {
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
  if (confirm('Clear all extension data? This cannot be undone.')) {
    await chrome.storage.local.clear();
    location.reload();
  }
}

// Enhanced error handling
async function handleProxyError(error, proxy = null) {
  try {
    if (typeof errorHandler !== 'undefined') {
      await chrome.runtime.sendMessage({
        action: 'handleProxyError',
        error: error?.message || String(error),
        proxy: proxy
      });
    }
  } catch (e) {
    // Fallback error handling
    showToast(`Error: ${error?.message || error || 'Unknown error occurred'}`, 'error');
  }
}

// ===== Speed Graph =====
function startSpeedGraph() {
  if (!speedGraphCanvas || !currentProxy) return;
  
  speedData = [];
  speedGraphSection.style.display = 'block';
  
  speedGraphInterval = setInterval(async () => {
    if (!currentProxy) {
      stopSpeedGraph();
      return;
    }
    
    try {
      const testResult = await chrome.runtime.sendMessage({ 
        action: 'quickTest', 
        proxy: currentProxy 
      });
      
      if (testResult.success && testResult.latency) {
        speedData.push(testResult.latency);
        if (speedData.length > 30) speedData.shift();
        drawSpeedGraph();
        
        if (currentLatencyEl) {
          currentLatencyEl.textContent = testResult.latency + 'ms';
        }
      }
    } catch (error) {
      console.error('Speed test error:', error);
    }
  }, 2000);
}

function stopSpeedGraph() {
  if (speedGraphInterval) {
    clearInterval(speedGraphInterval);
    speedGraphInterval = null;
  }
  if (speedGraphSection) {
    speedGraphSection.style.display = 'none';
  }
  speedData = [];
}

function drawSpeedGraph() {
  if (!speedGraphCanvas || speedData.length < 2) return;
  
  const ctx = speedGraphCanvas.getContext('2d');
  const width = speedGraphCanvas.width;
  const height = speedGraphCanvas.height;
  
  ctx.clearRect(0, 0, width, height);
  
  const maxLatency = Math.max(...speedData, 100);
  const minLatency = 0;
  const range = maxLatency - minLatency || 1;
  
  ctx.beginPath();
  ctx.strokeStyle = '#64ffda';
  ctx.lineWidth = 2;
  
  speedData.forEach((latency, index) => {
    const x = (index / (speedData.length - 1)) * width;
    const y = height - ((latency - minLatency) / range) * (height - 4) - 2;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // Fill under the line
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = 'rgba(100, 255, 218, 0.15)';
  ctx.fill();
}
