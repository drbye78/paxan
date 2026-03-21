// PeasyProxy - Popup State Management
// Manages all application state for the popup UI

// ============================================================================
// GLOBAL STATE VARIABLES
// ============================================================================

// Proxy data
let proxies = [];
let currentProxy = null;
let proxyStats = {};
let proxyReputation = {};
let favorites = [];
let recentlyUsed = [];

// Connection state
let connectionStartTime = null;
let monitoringActive = false;
let lastDisconnectedProxy = null;
let disconnectTimeout = null;

// Settings
let settings = {
  theme: 'dark',
  language: 'ru',
  autoFailover: true,
  testBeforeConnect: true,
  autoConnect: true,
  notifications: true,
  refreshInterval: 300000,
  proxySource: 'peasyproxy',
  countryBlacklist: []
};

// Statistics
let dailyStats = {
  proxiesUsed: 0,
  connectionTime: 0,
  attempts: 0,
  successes: 0
};

// Security state
let securityStatus = {
  status: 'secure',
  dnsLeakProtection: true,
  webRtcProtection: true,
  lastCheck: null
};

// Health state
let healthStatus = {
  active: false,
  quality: 'excellent',
  avgLatency: 0,
  lastCheck: null
};

// Connection quality
let connectionQuality = {
  enabled: true,
  lastUpdate: null,
  latency: 0,
  packetLoss: 0,
  quality: 'excellent'
};

// IP detector state
let ipInfo = {
  realIp: null,
  proxyIp: null,
  isLoading: false,
  lastCheck: null,
  expanded: false
};

// UI state
let currentTab = 'all';
let detailsExpanded = false;
let currentFilteredProxies = [];

// Site rules
let siteRules = [];

// Auto-rotation
let autoRotation = {
  enabled: false,
  interval: 600000,
  timer: null,
  lastRotation: null
};

// Onboarding state
let onboardingState = {
  completed: false,
  currentStepIndex: 0,
  version: '3.0.0'
};

// ============================================================================
// STATE INITIALIZATION
// ============================================================================

async function loadAllState() {
  try {
    const result = await chrome.storage.local.get([
      'settings',
      'favorites',
      'recentlyUsed',
      'proxyStats',
      'dailyStats',
      'activeProxy',
      'connectionStartTime',
      'security',
      'healthData',
      'siteRules',
      'autoRotation',
      'onboarding'
    ]);

    // Load settings
    if (result.settings) {
      settings = { ...settings, ...result.settings };
    }

    // Load favorites and recently used
    favorites = result.favorites || [];
    recentlyUsed = result.recentlyUsed || [];

    // Load stats
    proxyStats = result.proxyStats || {};
    dailyStats = result.dailyStats || { proxiesUsed: 0, connectionTime: 0, attempts: 0, successes: 0 };

    // Load connection state
    currentProxy = result.activeProxy || null;
    if (result.connectionStartTime) {
      connectionStartTime = result.connectionStartTime;
    }

    // Load security state
    if (result.security) {
      securityStatus = { ...securityStatus, ...result.security };
    }

    // Load health state
    if (result.healthData) {
      healthStatus = { ...healthStatus, ...result.healthData };
    }

    // Load site rules
    if (result.siteRules) {
      siteRules = result.siteRules.map(rule => ({
        id: rule.id || Date.now(),
        url: rule.url || '',
        country: rule.country || '',
        proxyIps: rule.proxyIps || [],
        enabled: rule.enabled !== undefined ? rule.enabled : true,
        priority: rule.priority || 999,
        patternType: rule.patternType || 'exact'
      }));
    }

    // Load auto-rotation
    if (result.autoRotation) {
      autoRotation = { ...autoRotation, ...result.autoRotation };
    }

    // Load onboarding state
    if (result.onboarding) {
      onboardingState = { ...onboardingState, ...result.onboarding };
    }

    // Set connection state
    if (currentProxy) {
      connectionStartTime = result.connectionStartTime;
    }
  } catch (error) {
    console.error('Error loading all state:', error);
  }
}

async function saveAllState() {
  try {
    await chrome.storage.local.set({
      settings,
      favorites,
      recentlyUsed,
      proxyStats,
      dailyStats,
      activeProxy: currentProxy,
      connectionStartTime,
      security: securityStatus,
      healthData: healthStatus,
      siteRules,
      autoRotation,
      onboarding: onboardingState
    });
  } catch (error) {
    console.error('Error saving all state:', error);
  }
}

// ============================================================================
// STATE GETTERS AND SETTERS
// ============================================================================

function getCurrentProxy() {
  return currentProxy;
}

function setCurrentProxy(proxy) {
  currentProxy = proxy;
}

function getConnectionStartTime() {
  return connectionStartTime;
}

function setConnectionStartTime(time) {
  connectionStartTime = time;
}

function getSettings() {
  return settings;
}

function setSettings(newSettings) {
  settings = { ...settings, ...newSettings };
}

function getFavorites() {
  return favorites;
}

function getRecentlyUsed() {
  return recentlyUsed;
}

function getProxyStats() {
  return proxyStats;
}

function getDailyStats() {
  return dailyStats;
}

function updateDailyStats(updates) {
  dailyStats = { ...dailyStats, ...updates };
  chrome.storage.local.set({ dailyStats }).catch(console.error);
}

function getSecurityStatus() {
  return securityStatus;
}

function setSecurityStatus(status) {
  securityStatus = { ...securityStatus, ...status };
}

function getHealthStatus() {
  return healthStatus;
}

function setHealthStatus(status) {
  healthStatus = { ...healthStatus, ...status };
}

function getConnectionQuality() {
  return connectionQuality;
}

function setConnectionQuality(quality) {
  connectionQuality = { ...connectionQuality, ...quality };
}

function getIpInfo() {
  return ipInfo;
}

function setIpInfo(info) {
  ipInfo = { ...ipInfo, ...info };
}

function getCurrentTab() {
  return currentTab;
}

function setCurrentTab(tab) {
  currentTab = tab;
}

function getSiteRules() {
  return siteRules;
}

function setSiteRules(rules) {
  siteRules = rules;
}

function getAutoRotation() {
  return autoRotation;
}

function setAutoRotation(rotation) {
  autoRotation = { ...autoRotation, ...rotation };
}

function getOnboardingState() {
  return onboardingState;
}

function setOnboardingState(state) {
  onboardingState = { ...onboardingState, ...state };
}

// ============================================================================
// PROXY OPERATIONS
// ============================================================================

function setProxies(newProxies) {
  proxies = newProxies;
}

function getProxies() {
  return proxies;
}

function addProxy(proxy) {
  proxies.push(proxy);
}

function removeProxy(proxyIpPort) {
  proxies = proxies.filter(p => p.ipPort !== proxyIpPort);
}

// Favorite operations
async function toggleFavorite(proxy) {
  const idx = favorites.findIndex(f => f.ipPort === proxy.ipPort);
  if (idx === -1) {
    favorites.push({ ...proxy, favoritedAt: Date.now() });
  } else {
    favorites.splice(idx, 1);
  }
  await chrome.storage.local.set({ favorites });
  return idx === -1; // Returns true if added, false if removed
}

function isFavorite(proxy) {
  return favorites.some(f => f.ipPort === proxy.ipPort);
}

// Recently used operations
async function addToRecentlyUsed(proxy) {
  try {
    const filtered = recentlyUsed.filter(r => r && r.proxy && r.proxy.ipPort !== proxy.ipPort);
    filtered.unshift({ proxy: { ...proxy }, lastUsed: Date.now() });
    recentlyUsed = filtered.slice(0, 10);
    await chrome.storage.local.set({ recentlyUsed });
  } catch (error) {
    console.error(error);
  }
}

// Proxy reputation operations
function getProxyReputation() {
  return proxyReputation;
}

function setProxyReputation(reputation) {
  proxyReputation = { ...proxyReputation, ...reputation };
}

// Export state for testing
export {
  // State variables
  proxies,
  currentProxy,
  settings,
  favorites,
  recentlyUsed,
  proxyStats,
  dailyStats,
  securityStatus,
  healthStatus,
  connectionQuality,
  ipInfo,
  currentTab,
  siteRules,
  autoRotation,
  onboardingState,
  
  // Functions
  loadAllState,
  saveAllState,
  getCurrentProxy,
  setCurrentProxy,
  getConnectionStartTime,
  setConnectionStartTime,
  getSettings,
  setSettings,
  getFavorites,
  getRecentlyUsed,
  getProxyStats,
  getDailyStats,
  updateDailyStats,
  getSecurityStatus,
  setSecurityStatus,
  getHealthStatus,
  setHealthStatus,
  getConnectionQuality,
  setConnectionQuality,
  getIpInfo,
  setIpInfo,
  getCurrentTab,
  setCurrentTab,
  getSiteRules,
  setSiteRules,
  getAutoRotation,
  setAutoRotation,
  getOnboardingState,
  setOnboardingState,
  setProxies,
  getProxies,
  addProxy,
  removeProxy,
  toggleFavorite,
  isFavorite,
  addToRecentlyUsed,
  getProxyReputation,
  setProxyReputation
};
