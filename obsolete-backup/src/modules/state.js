// ProxyMania VPN - State Management Module
// Centralized global application state

// ============================================================================
// STATE - Global application state
// ============================================================================

let proxies = [];
let currentProxy = null;
let connectionStartTime = null;
let timerInterval = null;
let proxyStats = {};
let proxyReputation = {};
let favorites = [];
let currentTab = 'all';
let monitoringActive = false;
let settings = {
  theme: 'dark',
  language: 'ru',
  autoFailover: true,
  testBeforeConnect: true,
  autoConnect: false,
  notifications: true,
  refreshInterval: 300000,
  proxySource: 'proxymania',
  countryBlacklist: []
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

// Speed graph state
let speedData = [];
let speedGraphInterval = null;

// Current filtered proxies for virtual scroller
let currentFilteredProxies = [];

// Country flag mapping
export const countryFlags = {
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

// ============================================================================
// GETTERS - Access state
// ============================================================================

export function getState() {
  return {
    proxies,
    currentProxy,
    connectionStartTime,
    timerInterval,
    proxyStats,
    proxyReputation,
    favorites,
    currentTab,
    monitoringActive,
    settings,
    dailyStats,
    securityStatus,
    onboardingState,
    healthStatus,
    connectionQuality,
    ipInfo,
    lastDisconnectedProxy,
    disconnectTimeout,
    siteRules,
    autoRotation,
    detailsExpanded,
    speedData,
    speedGraphInterval,
    currentFilteredProxies
  };
}

// Individual getters for common access patterns
export function getProxies() { return proxies; }
export function getCurrentProxy() { return currentProxy; }
export function getSettings() { return settings; }
export function getFavorites() { return favorites; }
export function getCurrentTab() { return currentTab; }
export function getSiteRules() { return siteRules; }
export function getCountryBlacklist() { return settings.countryBlacklist; }
export function getProxyStats() { return proxyStats; }
export function getProxyReputation() { return proxyReputation; }
export function getDailyStats() { return dailyStats; }
export function getSecurityStatus() { return securityStatus; }
export function getHealthStatus() { return healthStatus; }
export function getConnectionQuality() { return connectionQuality; }
export function getIpInfo() { return ipInfo; }
export function getAutoRotation() { return autoRotation; }
export function getSpeedData() { return speedData; }
export function getCurrentFilteredProxies() { return currentFilteredProxies; }

// ============================================================================
// SETTERS - Update state
// ============================================================================

export function setState(newState) {
  if (newState.proxies !== undefined) proxies = newState.proxies;
  if (newState.currentProxy !== undefined) currentProxy = newState.currentProxy;
  if (newState.connectionStartTime !== undefined) connectionStartTime = newState.connectionStartTime;
  if (newState.timerInterval !== undefined) timerInterval = newState.timerInterval;
  if (newState.proxyStats !== undefined) proxyStats = newState.proxyStats;
  if (newState.proxyReputation !== undefined) proxyReputation = newState.proxyReputation;
  if (newState.favorites !== undefined) favorites = newState.favorites;
  if (newState.currentTab !== undefined) currentTab = newState.currentTab;
  if (newState.monitoringActive !== undefined) monitoringActive = newState.monitoringActive;
  if (newState.settings !== undefined) settings = { ...settings, ...newState.settings };
  if (newState.dailyStats !== undefined) dailyStats = { ...dailyStats, ...newState.dailyStats };
  if (newState.securityStatus !== undefined) securityStatus = { ...securityStatus, ...newState.securityStatus };
  if (newState.onboardingState !== undefined) onboardingState = { ...onboardingState, ...newState.onboardingState };
  if (newState.healthStatus !== undefined) healthStatus = { ...healthStatus, ...newState.healthStatus };
  if (newState.connectionQuality !== undefined) connectionQuality = { ...connectionQuality, ...newState.connectionQuality };
  if (newState.ipInfo !== undefined) ipInfo = { ...ipInfo, ...newState.ipInfo };
  if (newState.lastDisconnectedProxy !== undefined) lastDisconnectedProxy = newState.lastDisconnectedProxy;
  if (newState.disconnectTimeout !== undefined) disconnectTimeout = newState.disconnectTimeout;
  if (newState.siteRules !== undefined) siteRules = newState.siteRules;
  if (newState.autoRotation !== undefined) autoRotation = { ...autoRotation, ...newState.autoRotation };
  if (newState.detailsExpanded !== undefined) detailsExpanded = newState.detailsExpanded;
  if (newState.speedData !== undefined) speedData = newState.speedData;
  if (newState.speedGraphInterval !== undefined) speedGraphInterval = newState.speedGraphInterval;
  if (newState.currentFilteredProxies !== undefined) currentFilteredProxies = newState.currentFilteredProxies;
}

// Individual setters for common updates
export function setCurrentProxy(proxy) { currentProxy = proxy; }
export function setConnectionStartTime(time) { connectionStartTime = time; }
export function setCurrentTab(tab) { currentTab = tab; }
export function setSiteRules(rules) { siteRules = rules; }
export function setFavorites(favs) { favorites = favs; }
export function setProxyStats(stats) { proxyStats = stats; }
export function setProxyReputation(rep) { proxyReputation = rep; }
export function setDailyStats(stats) { dailyStats = stats; }
export function setSecurityStatus(status) { securityStatus = status; }
export function setHealthStatus(status) { healthStatus = status; }
export function setConnectionQuality(quality) { connectionQuality = quality; }
export function setIpInfo(info) { ipInfo = info; }
export function setAutoRotation(config) { autoRotation = { ...autoRotation, ...config }; }
export function setSpeedData(data) { speedData = data; }
export function setCurrentFilteredProxies(list) { currentFilteredProxies = list; }

// Settings updates
export function updateSetting(key, value) {
  settings[key] = value;
}

export function updateCountryBlacklist(list) {
  settings.countryBlacklist = list;
}

export function addToCountryBlacklist(country) {
  if (!settings.countryBlacklist.includes(country)) {
    settings.countryBlacklist.push(country);
  }
}

export function removeFromCountryBlacklist(country) {
  settings.countryBlacklist = settings.countryBlacklist.filter(c => c !== country);
}

// ============================================================================
// UTILITIES - State helpers
// ============================================================================

export function getFlag(country) {
  if (!country) return '🌍';
  return countryFlags[country] || countryFlags[country.split(' ')[0]] || '🌍';
}

export function resetConnectionState() {
  currentProxy = null;
  connectionStartTime = null;
  lastDisconnectedProxy = null;
  if (disconnectTimeout) {
    clearTimeout(disconnectTimeout);
    disconnectTimeout = null;
  }
}
