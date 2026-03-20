// ProxyMania VPN - Storage Module
// All Chrome storage interactions

import { 
  setState, 
  setSettings, 
  setFavorites, 
  setProxyStats, 
  setProxyReputation, 
  setDailyStats, 
  setSecurityStatus, 
  setOnboardingState, 
  setHealthStatus, 
  setSiteRules, 
  setAutoRotation,
  setCurrentProxy,
  setConnectionStartTime
} from './state.js';

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Load settings from storage
 * @returns {Promise<Object>} - Settings object
 */
export async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    if (result.settings) {
      setSettings(result.settings);
    }
    return result.settings;
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

/**
 * Save settings to storage
 * @returns {Promise<boolean>} - Success status
 */
export async function saveSettings() {
  try {
    const { getState } = await import('./state.js');
    const { settings } = getState();
    await chrome.storage.local.set({ settings });
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

// ============================================================================
// FAVORITES
// ============================================================================

/**
 * Load favorites from storage
 * @returns {Promise<Array>} - Favorites array
 */
export async function loadFavorites() {
  try {
    const result = await chrome.storage.local.get(['favorites']);
    if (result.favorites) {
      setFavorites(result.favorites);
    }
    return result.favorites || [];
  } catch (error) {
    console.error('Error loading favorites:', error);
    return [];
  }
}

/**
 * Save favorites to storage
 * @param {Array} favorites - Favorites to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveFavorites(favorites) {
  try {
    await chrome.storage.local.set({ favorites });
    setFavorites(favorites);
    return true;
  } catch (error) {
    console.error('Error saving favorites:', error);
    return false;
  }
}

/**
 * Add proxy to favorites
 * @param {Object} proxy - Proxy to add
 * @returns {Promise<boolean>} - Success status
 */
export async function addToFavorites(proxy) {
  try {
    const favorites = await loadFavorites();
    if (!favorites.some(f => f.ipPort === proxy.ipPort)) {
      favorites.push(proxy);
      await saveFavorites(favorites);
    }
    return true;
  } catch (error) {
    console.error('Error adding to favorites:', error);
    return false;
  }
}

/**
 * Remove proxy from favorites
 * @param {string} ipPort - Proxy IP:Port
 * @returns {Promise<boolean>} - Success status
 */
export async function removeFromFavorites(ipPort) {
  try {
    const favorites = await loadFavorites();
    const filtered = favorites.filter(f => f.ipPort !== ipPort);
    await saveFavorites(filtered);
    return true;
  } catch (error) {
    console.error('Error removing from favorites:', error);
    return false;
  }
}

// ============================================================================
// PROXY STATS
// ============================================================================

/**
 * Load proxy stats from storage
 * @returns {Promise<Object>} - Stats object
 */
export async function loadProxyStats() {
  try {
    const result = await chrome.storage.local.get(['proxyStats']);
    if (result.proxyStats) {
      setProxyStats(result.proxyStats);
    }
    return result.proxyStats || {};
  } catch (error) {
    console.error('Error loading proxy stats:', error);
    return {};
  }
}

/**
 * Save proxy stats to storage
 * @param {Object} stats - Stats to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveProxyStats(stats) {
  try {
    await chrome.storage.local.set({ proxyStats: stats });
    setProxyStats(stats);
    return true;
  } catch (error) {
    console.error('Error saving proxy stats:', error);
    return false;
  }
}

/**
 * Update stats for a specific proxy
 * @param {string} ipPort - Proxy IP:Port
 * @param {Object} updates - Updates to apply
 * @returns {Promise<boolean>} - Success status
 */
export async function updateProxyStats(ipPort, updates) {
  try {
    const stats = await loadProxyStats();
    if (!stats[ipPort]) {
      stats[ipPort] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        latencies: [],
        successRate: 0,
        avgLatency: 0,
        lastSuccess: null,
        lastFailure: null
      };
    }
    
    const proxyStats = stats[ipPort];
    
    // Apply updates
    Object.assign(proxyStats, updates);
    
    // Update attempts
    if (updates.success !== undefined) {
      proxyStats.attempts++;
      if (updates.success) {
        proxyStats.successes++;
        proxyStats.lastSuccess = Date.now();
      } else {
        proxyStats.failures++;
        proxyStats.lastFailure = Date.now();
      }
      // Recalculate success rate
      proxyStats.successRate = Math.round((proxyStats.successes / proxyStats.attempts) * 100);
    }
    
    // Update latencies (keep last 20)
    if (updates.latency !== undefined) {
      proxyStats.latencies.push(updates.latency);
      if (proxyStats.latencies.length > 20) {
        proxyStats.latencies.shift();
      }
      // Recalculate average
      proxyStats.avgLatency = Math.round(
        proxyStats.latencies.reduce((a, b) => a + b, 0) / proxyStats.latencies.length
      );
    }
    
    await saveProxyStats(stats);
    return true;
  } catch (error) {
    console.error('Error updating proxy stats:', error);
    return false;
  }
}

// ============================================================================
// PROXY REPUTATION
// ============================================================================

/**
 * Load proxy reputation from storage
 * @returns {Promise<Object>} - Reputation object
 */
export async function loadProxyReputation() {
  try {
    const result = await chrome.storage.local.get(['proxyReputation']);
    if (result.proxyReputation) {
      setProxyReputation(result.proxyReputation);
    }
    return result.proxyReputation || {};
  } catch (error) {
    console.error('Error loading proxy reputation:', error);
    return {};
  }
}

/**
 * Save proxy reputation to storage
 * @param {Object} reputation - Reputation to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveProxyReputation(reputation) {
  try {
    await chrome.storage.local.set({ proxyReputation: reputation });
    setProxyReputation(reputation);
    return true;
  } catch (error) {
    console.error('Error saving proxy reputation:', error);
    return false;
  }
}

// ============================================================================
// SECURITY STATUS
// ============================================================================

/**
 * Load security status from storage
 * @returns {Promise<Object>} - Security status object
 */
export async function loadSecurityStatus() {
  try {
    const result = await chrome.storage.local.get(['security']);
    if (result.security) {
      setSecurityStatus(result.security);
    }
    return result.security;
  } catch (error) {
    console.error('Error loading security status:', error);
    return null;
  }
}

/**
 * Save security status to storage
 * @param {Object} status - Status to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveSecurityStatus(status) {
  try {
    await chrome.storage.local.set({ security: status });
    setSecurityStatus(status);
    return true;
  } catch (error) {
    console.error('Error saving security status:', error);
    return false;
  }
}

// ============================================================================
// ONBOARDING STATE
// ============================================================================

/**
 * Load onboarding state from storage
 * @returns {Promise<Object>} - Onboarding state object
 */
export async function loadOnboardingState() {
  try {
    const result = await chrome.storage.local.get(['onboarding']);
    if (result.onboarding) {
      setOnboardingState(result.onboarding);
    }
    return result.onboarding;
  } catch (error) {
    console.error('Error loading onboarding state:', error);
    return null;
  }
}

/**
 * Save onboarding state to storage
 * @param {Object} state - State to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveOnboardingState(state) {
  try {
    await chrome.storage.local.set({ onboarding: state });
    setOnboardingState(state);
    return true;
  } catch (error) {
    console.error('Error saving onboarding state:', error);
    return false;
  }
}

// ============================================================================
// HEALTH STATUS
// ============================================================================

/**
 * Load health status from storage
 * @returns {Promise<Object>} - Health status object
 */
export async function loadHealthStatus() {
  try {
    const result = await chrome.storage.local.get(['healthData']);
    if (result.healthData) {
      setHealthStatus(result.healthData);
    }
    return result.healthData;
  } catch (error) {
    console.error('Error loading health status:', error);
    return null;
  }
}

/**
 * Save health status to storage
 * @param {Object} status - Status to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveHealthStatus(status) {
  try {
    await chrome.storage.local.set({ healthData: status });
    setHealthStatus(status);
    return true;
  } catch (error) {
    console.error('Error saving health status:', error);
    return false;
  }
}

// ============================================================================
// SITE RULES
// ============================================================================

/**
 * Load site rules from storage
 * @returns {Promise<Array>} - Site rules array
 */
export async function loadSiteRules() {
  try {
    const result = await chrome.storage.local.get(['siteRules']);
    let rules = result.siteRules || [];
    // Ensure all rules have required fields (migration)
    rules = rules.map(rule => ({
      id: rule.id || Date.now(),
      url: rule.url || '',
      country: rule.country || '',
      proxyIps: rule.proxyIps || [],
      enabled: rule.enabled !== undefined ? rule.enabled : true,
      priority: rule.priority || 999,
      patternType: rule.patternType || 'exact'
    }));
    setSiteRules(rules);
    return rules;
  } catch (error) {
    console.error('Error loading site rules:', error);
    return [];
  }
}

/**
 * Save site rules to storage
 * @param {Array} rules - Rules to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveSiteRules(rules) {
  try {
    await chrome.storage.local.set({ siteRules: rules });
    setSiteRules(rules);
    return true;
  } catch (error) {
    console.error('Error saving site rules:', error);
    return false;
  }
}

// ============================================================================
// AUTO-ROTATION
// ============================================================================

/**
 * Load auto-rotation settings from storage
 * @returns {Promise<Object>} - Auto-rotation config
 */
export async function loadAutoRotationSettings() {
  try {
    const result = await chrome.storage.local.get(['autoRotation']);
    if (result.autoRotation) {
      setAutoRotation(result.autoRotation);
    }
    return result.autoRotation;
  } catch (error) {
    console.error('Error loading auto-rotation:', error);
    return null;
  }
}

/**
 * Save auto-rotation settings to storage
 * @param {Object} config - Config to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveAutoRotationSettings(config) {
  try {
    await chrome.storage.local.set({ autoRotation: config });
    setAutoRotation(config);
    return true;
  } catch (error) {
    console.error('Error saving auto-rotation:', error);
    return false;
  }
}

// ============================================================================
// CURRENT PROXY
// ============================================================================

/**
 * Load current active proxy from storage
 * @returns {Promise<Object|null>} - Current proxy or null
 */
export async function loadCurrentProxy() {
  try {
    const result = await chrome.storage.local.get(['activeProxy', 'connectionStartTime']);
    if (result.activeProxy) {
      setCurrentProxy(result.activeProxy);
      setConnectionStartTime(result.connectionStartTime);
    }
    return result.activeProxy || null;
  } catch (error) {
    console.error('Error loading current proxy:', error);
    return null;
  }
}

/**
 * Save current proxy to storage
 * @param {Object} proxy - Proxy to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveCurrentProxy(proxy) {
  try {
    await chrome.storage.local.set({ 
      activeProxy: proxy, 
      connectionStartTime: Date.now() 
    });
    setCurrentProxy(proxy);
    setConnectionStartTime(Date.now());
    return true;
  } catch (error) {
    console.error('Error saving current proxy:', error);
    return false;
  }
}

/**
 * Clear current proxy from storage
 * @returns {Promise<boolean>} - Success status
 */
export async function clearCurrentProxy() {
  try {
    await chrome.storage.local.remove(['activeProxy', 'connectionStartTime']);
    setCurrentProxy(null);
    setConnectionStartTime(null);
    return true;
  } catch (error) {
    console.error('Error clearing current proxy:', error);
    return false;
  }
}

// ============================================================================
// RECENTLY USED
// ============================================================================

/**
 * Add proxy to recently used list
 * @param {Object} proxy - Proxy to add
 * @returns {Promise<boolean>} - Success status
 */
export async function addToRecentlyUsed(proxy) {
  try {
    const result = await chrome.storage.local.get(['recentlyUsed']);
    let recentlyUsed = result.recentlyUsed || [];
    
    // Remove if already exists
    recentlyUsed = recentlyUsed.filter(r => r.proxy.ipPort !== proxy.ipPort);
    
    // Add to front
    recentlyUsed.unshift({ proxy, lastUsed: Date.now() });
    
    // Keep only last 10
    recentlyUsed = recentlyUsed.slice(0, 10);
    
    await chrome.storage.local.set({ recentlyUsed });
    return true;
  } catch (error) {
    console.error('Error adding to recently used:', error);
    return false;
  }
}

/**
 * Load recently used proxies
 * @returns {Promise<Array>} - Recently used array
 */
export async function loadRecentlyUsed() {
  try {
    const result = await chrome.storage.local.get(['recentlyUsed']);
    return result.recentlyUsed || [];
  } catch (error) {
    console.error('Error loading recently used:', error);
    return [];
  }
}

// ============================================================================
// CLEAR ALL DATA
// ============================================================================

/**
 * Clear all extension data from storage
 * @returns {Promise<boolean>} - Success status
 */
export async function clearAllData() {
  try {
    await chrome.storage.local.clear();
    return true;
  } catch (error) {
    console.error('Error clearing all data:', error);
    return false;
  }
}
