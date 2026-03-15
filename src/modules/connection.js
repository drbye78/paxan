// PeasyProxy VPN - Connection Module
// Connect/disconnect logic, failover, proxy selection

import { 
  getState, 
  setState, 
  getCurrentProxy, 
  setCurrentProxy, 
  setConnectionStartTime,
  resetConnectionState,
  getSettings,
  getProxyStats
} from './state.js';
import { updateUI, updateFab, updateConnectionQuality, startConnectionTimer, stopConnectionTimer, setFabLoading } from './ui-core.js';
import { showToast, showSuccess, showError, showWarning } from './toast.js';
import { saveCurrentProxy, clearCurrentProxy, updateProxyStats, addToRecentlyUsed, updateDailyStats } from './storage.js';
import { calculateProxyScore } from './utils.js';

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Connect to a proxy
 * @param {Object} proxy - Proxy object to connect to
 * @param {Event} event - Click event (optional)
 * @returns {Promise<boolean>} - Success status
 */
export async function connectToProxy(proxy, event) {
  if (!proxy) {
    showError('No proxy selected');
    return false;
  }
  
  const { testBeforeConnect, autoFailover } = getSettings();
  
  try {
    // Set loading state
    setFabLoading(true);
    
    // Test proxy first if enabled
    if (testBeforeConnect) {
      const testResult = await testProxy(proxy);
      
      if (!testResult.success) {
        setFabLoading(false);
        showError(`Proxy test failed: ${testResult.error || 'Timeout'}`);
        
        // Update stats
        await updateProxyStats(proxy.ipPort, { success: false, latency: testResult.latency });
        
        // Auto-failover: try next best proxy
        if (autoFailover && event) {
          showToast('Trying next best proxy...', 'info');
          const nextProxy = await getNextBestProxy(proxy);
          if (nextProxy) {
            return connectToProxy(nextProxy, event);
          }
        }
        
        return false;
      }
      
      // Update stats with successful test
      await updateProxyStats(proxy.ipPort, { success: true, latency: testResult.latency });
    }
    
    // Set proxy in Chrome
    await chrome.runtime.sendMessage({ 
      action: 'setProxy', 
      proxy 
    });
    
    // Update state
    setCurrentProxy(proxy);
    setConnectionStartTime(Date.now());
    
    // Save to storage
    await saveCurrentProxy(proxy);
    await addToRecentlyUsed(proxy);
    await updateDailyStats({ proxiesUsed: 1, attempts: 1, successes: 1 });
    
    // Start monitoring
    startConnectionTimer();
    startMonitoring();
    startSpeedGraph();
    
    // Update UI
    updateUI();
    updateFab();
    
    // Show success
    showSuccess(`Connected to ${proxy.country}`, () => {
      // Undo callback
      disconnectProxy();
    });
    
    setFabLoading(false);
    return true;
    
  } catch (error) {
    console.error('Connection error:', error);
    setFabLoading(false);
    showError(`Connection failed: ${error.message}`);
    
    // Update stats
    await updateProxyStats(proxy.ipPort, { success: false });
    await updateDailyStats({ attempts: 1 });
    
    return false;
  }
}

/**
 * Disconnect from current proxy
 * @returns {Promise<boolean>} - Success status
 */
export async function disconnectProxy() {
  const currentProxy = getCurrentProxy();
  
  if (!currentProxy) {
    return false;
  }
  
  try {
    // Save for undo
    setState({ lastDisconnectedProxy: currentProxy });
    
    // Clear proxy in Chrome
    await chrome.runtime.sendMessage({ action: 'clearProxy' });
    
    // Stop monitoring
    stopMonitoring();
    stopConnectionTimer();
    stopSpeedGraph();
    
    // Clear state
    resetConnectionState();
    
    // Clear storage
    await clearCurrentProxy();
    
    // Update UI
    updateUI();
    updateFab();
    
    // Show undo toast
    showSuccess('Disconnected', () => {
      // Undo callback
      reconnectToLastProxy();
    });
    
    // Auto-clear after 5 seconds
    const timeoutId = setTimeout(() => {
      setState({ lastDisconnectedProxy: null });
    }, 5000);
    
    setState({ disconnectTimeout: timeoutId });
    
    return true;
    
  } catch (error) {
    console.error('Disconnect error:', error);
    showError('Disconnect failed');
    return false;
  }
}

/**
 * Reconnect to last disconnected proxy
 * @returns {Promise<boolean>} - Success status
 */
export async function reconnectToLastProxy() {
  const { lastDisconnectedProxy } = getState();
  
  if (!lastDisconnectedProxy) {
    return false;
  }
  
  const proxy = lastDisconnectedProxy;
  setState({ lastDisconnectedProxy: null });
  
  try {
    await chrome.runtime.sendMessage({ action: 'setProxy', proxy });
    
    setCurrentProxy(proxy);
    setConnectionStartTime(Date.now());
    
    await saveCurrentProxy(proxy);
    
    startConnectionTimer();
    startMonitoring();
    startSpeedGraph();
    
    updateUI();
    updateFab();
    
    showSuccess(`Reconnected to ${proxy.country}`);
    return true;
    
  } catch (error) {
    console.error('Reconnect error:', error);
    showError('Reconnect failed');
    return false;
  }
}

/**
 * Connect to best available proxy
 * @returns {Promise<boolean>} - Success status
 */
export async function connectToBestProxy() {
  const bestProxy = getBestProxy();
  
  if (!bestProxy) {
    showError('No proxies available');
    return false;
  }
  
  return connectToProxy(bestProxy);
}

/**
 * Get best proxy based on score
 * @returns {Object|null} - Best proxy or null
 */
export function getBestProxy() {
  const { proxies } = getState();
  const { countryBlacklist } = getSettings();
  
  if (!proxies || proxies.length === 0) {
    return null;
  }
  
  // Filter out blacklisted countries
  let available = proxies;
  if (countryBlacklist && countryBlacklist.length > 0) {
    available = proxies.filter(p => !countryBlacklist.includes(p.country));
  }
  
  if (available.length === 0) {
    return proxies[0]; // Fallback to first if all filtered
  }
  
  // Score and sort
  const scored = available.map(proxy => ({
    ...proxy,
    score: calculateProxyScore(proxy)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored[0];
}

/**
 * Get next best proxy (for failover)
 * @param {Object} excludeProxy - Proxy to exclude
 * @returns {Promise<Object|null>} - Next best proxy or null
 */
export async function getNextBestProxy(excludeProxy) {
  const { proxies } = getState();
  
  if (!proxies || proxies.length <= 1) {
    return null;
  }
  
  // Filter out excluded proxy
  const available = proxies.filter(p => p.ipPort !== excludeProxy.ipPort);
  
  if (available.length === 0) {
    return null;
  }
  
  // Score and sort
  const scored = available.map(proxy => ({
    ...proxy,
    score: calculateProxyScore(proxy)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored[0];
}

/**
 * Get recommended proxies (fast and reliable)
 * @param {Object} excludeProxy - Proxy to exclude
 * @returns {Array} - Array of recommended proxies
 */
export function getRecommendedProxies(excludeProxy = null) {
  const { proxies } = getState();
  const proxyStats = getProxyStats();
  
  if (!proxies || proxies.length === 0) {
    return [];
  }
  
  // Filter for fast proxies (< 150ms)
  let recommended = proxies.filter(p => {
    const stats = proxyStats[p.ipPort];
    const latency = stats?.avgLatency || parseInt(p.speed) || 1000;
    return latency < 150;
  });
  
  // Exclude current proxy
  if (excludeProxy) {
    recommended = recommended.filter(p => p.ipPort !== excludeProxy.ipPort);
  }
  
  // Limit to 4
  return recommended.slice(0, 4);
}

// ============================================================================
// PROXY TESTING
// ============================================================================

/**
 * Test proxy connectivity
 * @param {Object} proxy - Proxy to test
 * @returns {Promise<Object>} - Test result
 */
export async function testProxy(proxy) {
  const timeout = 5000; // 5 second timeout
  
  try {
    const result = await chrome.runtime.sendMessage({ 
      action: 'testProxy', 
      proxy,
      timeout 
    });
    
    return {
      success: result?.success || false,
      latency: result?.latency || 0,
      error: result?.error
    };
    
  } catch (error) {
    return {
      success: false,
      latency: 0,
      error: error.message || 'Test failed'
    };
  }
}

// ============================================================================
// MONITORING
// ============================================================================

/**
 * Start connection monitoring
 */
export function startMonitoring() {
  const { monitoringActive } = getState();
  
  if (monitoringActive) return;
  
  setState({ monitoringActive: true });
  
  // Request background to start monitoring
  chrome.runtime.sendMessage({ action: 'startMonitoring' })
    .catch(console.error);
}

/**
 * Stop connection monitoring
 */
export function stopMonitoring() {
  const { monitoringActive } = getState();
  
  if (!monitoringActive) return;
  
  setState({ monitoringActive: false });
  
  // Request background to stop monitoring
  chrome.runtime.sendMessage({ action: 'stopMonitoring' })
    .catch(console.error);
}

/**
 * Start speed graph
 */
export function startSpeedGraph() {
  const { speedGraphInterval } = getState();
  
  if (speedGraphInterval) return;
  
  // Update speed data every 2 seconds
  const interval = setInterval(() => {
    updateSpeedData();
  }, 2000);
  
  setState({ speedGraphInterval: interval });
}

/**
 * Stop speed graph
 */
export function stopSpeedGraph() {
  const { speedGraphInterval } = getState();
  
  if (speedGraphInterval) {
    clearInterval(speedGraphInterval);
    setState({ speedGraphInterval: null });
  }
}

/**
 * Update speed data
 */
async function updateSpeedData() {
  const currentProxy = getCurrentProxy();
  
  if (!currentProxy) {
    return;
  }
  
  try {
    // Test latency
    const start = Date.now();
    await fetch('https://www.google.com/favicon.ico', { 
      method: 'HEAD',
      cache: 'no-store'
    });
    const latency = Date.now() - start;
    
    // Update connection quality
    updateConnectionQuality(latency);
    
    // Update speed data
    const { speedData } = getState();
    speedData.push({ time: Date.now(), latency });
    
    // Keep last 30 data points
    if (speedData.length > 30) {
      speedData.shift();
    }
    
    setState({ speedData });
    
  } catch (error) {
    // Ignore errors in speed testing
  }
}

// ============================================================================
// FAILover HANDLING
// ============================================================================

/**
 * Handle proxy degradation
 * @param {Object} message - Degradation message from background
 */
export function handleProxyDegraded(message) {
  const { autoFailover } = getSettings();
  
  if (!autoFailover) {
    showWarning('Proxy connection degraded', () => {
      disconnectProxy();
    });
    return;
  }
  
  // Auto-failover: find and connect to better proxy
  showToast('Proxy degraded, finding better...', 'warning');
  
  const nextProxy = getNextBestProxy(getCurrentProxy());
  if (nextProxy) {
    connectToProxy(nextProxy);
  }
}

/**
 * Handle connection degradation
 * @param {Object} message - Degradation message
 */
export function handleConnectionDegraded(message) {
  const { latency, packetLoss } = message;
  
  updateConnectionQuality(latency, packetLoss);
  
  if (latency > 1000 || packetLoss > 20) {
    showWarning('Connection quality poor', () => {
      disconnectProxy();
    });
  }
}
