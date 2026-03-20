// ProxyMania VPN - Stats Module
// Statistics display and management

import { getDailyStats, getProxyStats } from './state.js';
import { formatTime, formatNumber } from './utils.js';

// ============================================================================
// STATS DISPLAY
// ============================================================================

/**
 * Update stats display panel
 */
export function updateStatsDisplay() {
  const dailyStats = getDailyStats();
  
  if (!dailyStats) return;
  
  // Update stats elements
  const proxiesUsedEl = document.getElementById('statsProxiesUsed');
  const connectionTimeEl = document.getElementById('statsConnectionTime');
  const successRateEl = document.getElementById('statsSuccessRate');
  const topCountriesEl = document.getElementById('statsTopCountries');
  
  if (proxiesUsedEl) {
    proxiesUsedEl.textContent = dailyStats.proxiesUsed || 0;
  }
  
  if (connectionTimeEl) {
    connectionTimeEl.textContent = formatTime((dailyStats.connectionTime || 0) * 1000);
  }
  
  if (successRateEl) {
    const rate = dailyStats.attempts > 0 
      ? Math.round((dailyStats.successes / dailyStats.attempts) * 100) 
      : 0;
    successRateEl.textContent = `${rate}%`;
  }
  
  if (topCountriesEl) {
    updateTopCountries(topCountriesEl);
  }
}

/**
 * Update top countries display
 * @param {HTMLElement} el - Element to update
 */
function updateTopCountries(el) {
  const proxyStats = getProxyStats();
  
  // Count proxies by country
  const countryCounts = {};
  
  Object.values(proxyStats).forEach(stats => {
    if (stats.country) {
      countryCounts[stats.country] = (countryCounts[stats.country] || 0) + 1;
    }
  });
  
  // Sort and get top 5
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  if (topCountries.length === 0) {
    el.textContent = 'No data yet';
    return;
  }
  
  el.innerHTML = topCountries.map(([country, count]) => {
    const { getFlag } = require('./utils.js');
    return `
      <div class="country-stat">
        <span class="country-flag">${getFlag(country)}</span>
        <span class="country-name">${country}</span>
        <span class="country-count">${count}</span>
      </div>
    `;
  }).join('');
}

/**
 * Get connection history
 * @returns {Array} - Connection history
 */
export function getConnectionHistory() {
  const { getRecentlyUsed } = require('./storage.js');
  const recentlyUsed = getRecentlyUsed();
  
  return recentlyUsed.map(r => ({
    proxy: r.proxy,
    lastUsed: r.lastUsed,
    duration: r.duration || 0
  }));
}

/**
 * Render connection history
 */
export function renderConnectionHistory() {
  const container = document.getElementById('connectionHistory');
  if (!container) return;
  
  const history = getConnectionHistory();
  
  if (history.length === 0) {
    container.innerHTML = '<p class="empty-history">No connection history yet</p>';
    return;
  }
  
  container.innerHTML = history.slice(0, 10).map(item => {
    const { getFlag, formatRelativeTime } = require('./utils.js');
    
    return `
      <div class="history-item">
        <div class="history-flag">${getFlag(item.proxy.country)}</div>
        <div class="history-info">
          <div class="history-country">${item.proxy.country}</div>
          <div class="history-address">${item.proxy.ipPort}</div>
        </div>
        <div class="history-time">${formatRelativeTime(item.lastUsed)}</div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// STATS HELPERS
// ============================================================================

/**
 * Calculate total connection time
 * @returns {number} - Total connection time in seconds
 */
export function getTotalConnectionTime() {
  const dailyStats = getDailyStats();
  return dailyStats.connectionTime || 0;
}

/**
 * Calculate success rate
 * @returns {number} - Success rate percentage
 */
export function getSuccessRate() {
  const dailyStats = getDailyStats();
  
  if (dailyStats.attempts === 0) return 0;
  
  return Math.round((dailyStats.successes / dailyStats.attempts) * 100);
}

/**
 * Get most used country
 * @returns {string|null} - Country name
 */
export function getMostUsedCountry() {
  const proxyStats = getProxyStats();
  
  const countryCounts = {};
  
  Object.values(proxyStats).forEach(stats => {
    if (stats.country) {
      countryCounts[stats.country] = (countryCounts[stats.country] || 0) + 1;
    }
  });
  
  const topCountry = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])[0];
  
  return topCountry ? topCountry[0] : null;
}
