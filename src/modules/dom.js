// PeasyProxy VPN - DOM Module
// Centralize DOM element references and initialization

// ============================================================================
// DOM ELEMENT SELECTOR
// ============================================================================

/**
 * Get element by ID
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} - DOM element
 */
export const $ = (id) => document.getElementById(id);

// ============================================================================
// DOM ELEMENT REFERENCES
// ============================================================================

// Status elements
export let statusIndicator = null;
export let statusText = null;
export let currentProxyDisplay = null;
export let proxyFlag = null;
export let proxyAddress = null;
export let proxyCountry = null;
export let connectionTimer = null;
export let timerValue = null;

// Test status
export let testStatus = null;
export let testText = null;

// Indicators
export let healthIndicator = null;
export let securityIndicator = null;
export let failoverIndicator = null;
export let dnsIndicator = null;
export let webrtcIndicator = null;

// New v3.0 elements
export let qualityBadgeInline = null;
export let qualityStats = null;
export let connectionQualityInline = null;
export let detailsToggle = null;
export let connectionDetails = null;
export let ipDetectorContent = null;

// FAB (Floating Action Button)
export let fab = null;

// Overflow menu
export let overflowBtn = null;
export let overflowMenu = null;
export let overflowStatsBtn = null;
export let overflowFavoritesBtn = null;
export let overflowApplyRuleBtn = null;
export let overflowThemeBtn = null;

// Settings & panels
export let settingsBtn = null;
export let settingsPanel = null;
export let statsPanel = null;

// Filters
export let proxySearch = null;
export let filterChips = null;
export let countryFilter = null;
export let typeFilter = null;

// Proxy list
export let proxyList = null;
export let proxyCount = null;
export let listTitle = null;
export let loading = null;
export let emptyState = null;

// Quick connect
export let quickConnectGrid = null;
export let quickConnectSection = null;
export let quickConnectToggle = null;
export let bestProxyBtn = null;

// Tabs
export let tabChips = null;
export let mainTabs = null;

// Toast
export let toastContainer = null;

// Settings elements
export let themeSelect = null;
export let proxySourceSelect = null;
export let rotationToggle = null;
export let rotationIntervalSelect = null;
export let manageBlacklistBtn = null;
export let blacklistContainer = null;
export let blacklistChips = null;
export let ipCheckBtn = null;
export let ipRealValue = null;
export let ipProxyValue = null;
export let ipDetectorSection = null;
export let speedGraphCanvas = null;
export let speedGraphSection = null;
export let currentLatencyEl = null;

// Virtual scroller
export let virtualScroller = null;

// ============================================================================
// DOM INITIALIZATION
// ============================================================================

/**
 * Initialize all DOM element references
 */
export function initDOMElements() {
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
  failoverIndicator = $('failoverIndicator');
  dnsIndicator = $('dnsIndicator');
  webrtcIndicator = $('webrtcIndicator');

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
  proxySourceSelect = $('proxySource');
  rotationToggle = $('rotationToggle');
  rotationIntervalSelect = $('rotationInterval');
  manageBlacklistBtn = $('manageBlacklistBtn');
  blacklistContainer = $('blacklistContainer');
  blacklistChips = $('blacklistChips');
  ipCheckBtn = $('ipCheckBtn');
  ipRealValue = $('ipRealValue');
  ipProxyValue = $('ipProxyValue');
  ipDetectorSection = $('ipDetectorSection');
  speedGraphCanvas = $('speedGraph');
  speedGraphSection = $('speedGraphSection');
  currentLatencyEl = $('currentLatency');
}

/**
 * Get all DOM elements as an object (for testing/debugging)
 * @returns {Object} - Object with all DOM element references
 */
export function getAllElements() {
  return {
    statusIndicator,
    statusText,
    currentProxyDisplay,
    proxyFlag,
    proxyAddress,
    proxyCountry,
    connectionTimer,
    timerValue,
    healthIndicator,
    securityIndicator,
    fab,
    overflowBtn,
    overflowMenu,
    settingsBtn,
    settingsPanel,
    statsPanel,
    proxySearch,
    filterChips,
    countryFilter,
    typeFilter,
    proxyList,
    proxyCount,
    listTitle,
    loading,
    emptyState,
    quickConnectGrid,
    quickConnectSection,
    quickConnectToggle,
    bestProxyBtn,
    tabChips,
    mainTabs,
    toastContainer,
    themeSelect,
    proxySourceSelect,
    rotationToggle,
    rotationIntervalSelect,
    manageBlacklistBtn,
    blacklistContainer,
    blacklistChips,
    ipCheckBtn,
    ipRealValue,
    ipProxyValue,
    ipDetectorSection,
    speedGraphCanvas,
    speedGraphSection,
    currentLatencyEl
  };
}

/**
 * Reset all DOM element references (for cleanup)
 */
export function resetDOMElements() {
  Object.keys(exports).forEach(key => {
    if (exports[key] instanceof HTMLElement) {
      exports[key] = null;
    }
  });
}
