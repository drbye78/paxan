// ProxyMania VPN - Auto-Refresh Module
// Periodic proxy list refresh

import { getSettings } from './state.js';
import { loadProxies } from './proxy-list.js';

let refreshTimer = null;

// ============================================================================
// AUTO-REFRESH
// ============================================================================

/**
 * Start auto-refresh timer
 */
export function startAutoRefresh() {
  stopAutoRefresh();
  
  const { refreshInterval } = getSettings();
  
  if (!refreshInterval || refreshInterval <= 0) {
    return;
  }
  
  refreshTimer = setInterval(() => {
    loadProxies(false); // Don't force refresh, use cache
  }, refreshInterval);
}

/**
 * Stop auto-refresh timer
 */
export function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Check if auto-refresh is active
 * @returns {boolean} - Whether auto-refresh is active
 */
export function isAutoRefreshActive() {
  return refreshTimer !== null;
}

/**
 * Get next refresh time
 * @returns {number} - Milliseconds until next refresh
 */
export function getNextRefreshTime() {
  if (!refreshTimer) return 0;
  
  const { refreshInterval } = getSettings();
  return refreshInterval;
}
