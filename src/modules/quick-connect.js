// PeasyProxy VPN - Quick Connect Module
// Quick connect grid and recommended proxies

import { getProxies, getCurrentProxy, getProxyStats } from './state.js';
import { quickConnectGrid, quickConnectSection, bestProxyBtn } from './dom.js';
import { calculateProxyScore, escapeHtml, getFlag } from './utils.js';
import { connectToProxy, getRecommendedProxies } from './connection.js';

// ============================================================================
// QUICK CONNECT RENDERING
// ============================================================================

/**
 * Render quick connect grid
 */
export function renderQuickConnect() {
  if (!quickConnectGrid) return;
  
  const currentProxy = getCurrentProxy();
  const recommended = getRecommendedProxies(currentProxy);
  
  if (recommended.length === 0) {
    if (quickConnectSection) {
      quickConnectSection.style.display = 'none';
    }
    return;
  }
  
  if (quickConnectSection) {
    quickConnectSection.style.display = 'block';
  }
  
  quickConnectGrid.innerHTML = recommended.map(proxy => `
    <div class="quick-connect-item" data-ip-port="${escapeHtml(proxy.ipPort)}">
      <div class="quick-connect-flag">${getFlag(proxy.country)}</div>
      <div class="quick-connect-info">
        <div class="quick-connect-country">${escapeHtml(proxy.country)}</div>
        <div class="quick-connect-speed">${getSpeedLabel(proxy)}</div>
      </div>
      <button class="quick-connect-btn">Connect</button>
    </div>
  `).join('');
  
  // Attach event listeners
  quickConnectGrid.querySelectorAll('.quick-connect-btn').forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      connectToProxy(recommended[index]);
    });
  });
  
  quickConnectGrid.querySelectorAll('.quick-connect-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      connectToProxy(recommended[index]);
    });
  });
}

/**
 * Get speed label for proxy
 * @param {Object} proxy - Proxy object
 * @returns {string} - Speed label
 */
function getSpeedLabel(proxy) {
  const latency = proxy.avgLatency || parseInt(proxy.speed) || 0;
  
  if (latency < 50) return '⚡ Ultra';
  if (latency < 100) return '🚀 Fast';
  if (latency < 200) return '✓ Good';
  return '○ Slow';
}

// ============================================================================
// RECOMMENDED PROXIES
// ============================================================================

/**
 * Render recommended proxies section
 */
export function renderRecommended() {
  const recommendedSection = document.getElementById('recommendedSection');
  const recommendedList = document.getElementById('recommendedList');
  
  if (!recommendedSection || !recommendedList) return;
  
  const currentProxy = getCurrentProxy();
  const recommended = getRecommendedProxies(currentProxy);
  
  if (recommended.length === 0) {
    recommendedSection.style.display = 'none';
    return;
  }
  
  recommendedSection.style.display = 'block';
  
  recommendedList.innerHTML = recommended.map((proxy, index) => `
    <div class="recommended-item ${index < 3 ? 'top-recommended' : ''}" data-ip-port="${escapeHtml(proxy.ipPort)}">
      <div class="recommended-badge">${index < 3 ? '⭐' : '✓'}</div>
      <div class="recommended-flag">${getFlag(proxy.country)}</div>
      <div class="recommended-info">
        <div class="recommended-country">${escapeHtml(proxy.country)}</div>
        <div class="recommended-address">${escapeHtml(proxy.ipPort)}</div>
      </div>
      <div class="recommended-score">
        <div class="score-badge ${getScoreClass(proxy.score)}">${proxy.score || 0}</div>
      </div>
      <button class="recommended-connect-btn">Connect</button>
    </div>
  `).join('');
  
  // Attach event listeners
  recommendedList.querySelectorAll('.recommended-connect-btn').forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      connectToProxy(recommended[index]);
    });
  });
}

/**
 * Get score badge class
 * @param {number} score - Proxy score
 * @returns {string} - CSS class
 */
function getScoreClass(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

// ============================================================================
// BEST PROXY BUTTON
// ============================================================================

/**
 * Setup best proxy button
 */
export function setupBestProxyButton() {
  if (!bestProxyBtn) return;
  
  bestProxyBtn.addEventListener('click', () => {
    const { connectToBestProxy } = require('./connection.js');
    connectToBestProxy();
  });
}

// Helper for require
function require(module) {
  console.warn(`Dynamic import not implemented: ${module}`);
  return {};
}
