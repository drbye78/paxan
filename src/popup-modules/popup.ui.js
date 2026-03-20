// ProxyMania VPN - Popup UI Rendering
// Handles all UI rendering and updates

import {
  getCurrentProxy,
  setCurrentProxy,
  getConnectionStartTime,
  getSettings,
  getSecurityStatus,
  getHealthStatus,
  getConnectionQuality,
  setConnectionQuality,
  getIpInfo,
  getFavorites,
  getProxyStats,
  getDailyStats,
  getSiteRules,
  getAutoRotation,
  getCurrentTab
} from './popup.state.js';

import {
  filterProxies,
  renderQuickConnect,
  renderRecommended,
  connectToBestProxy
} from './popup.proxy-list.js';

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

// ============================================================================
// UI UPDATE FUNCTIONS
// ============================================================================

function updateUI() {
  const currentProxy = getCurrentProxy();
  const statusIndicator = document.getElementById('statusBadge');
  const statusText = statusIndicator?.querySelector('.status-text');
  const currentProxyDisplay = document.getElementById('currentProxyDisplay');
  const proxyFlag = document.getElementById('proxyFlag');
  const proxyAddress = document.getElementById('proxyAddress');
  const proxyCountry = document.getElementById('proxyCountry');
  const connectionTimer = document.getElementById('connectionTimer');
  const connectionQualityInline = document.getElementById('connectionQualityInline');
  
  if (currentProxy) {
    // Status badge
    if (statusIndicator) statusIndicator.classList.add('connected');
    if (statusText) statusText.textContent = 'Connected';
    
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
    
    updateFab();
    
  } else {
    // Status badge
    if (statusIndicator) statusIndicator.classList.remove('connected');
    if (statusText) statusText.textContent = 'Disconnected';
    
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
    const ipRealValue = document.getElementById('ipRealValue');
    const ipProxyValue = document.getElementById('ipProxyValue');
    const ipDetectorContent = document.getElementById('ipDetectorContent');
    
    if (ipRealValue) ipRealValue.textContent = '--';
    if (ipProxyValue) ipProxyValue.textContent = '--';
    if (ipDetectorContent) ipDetectorContent.style.display = 'none';
    
    const ipInfo = getIpInfo();
    ipInfo.expanded = false;
    
    updateFab();
  }
  
  updateSecurityUI();
  updateFab();
}

function updateFab() {
  const fab = document.getElementById('fab');
  if (!fab) return;
  
  const currentProxy = getCurrentProxy();
  
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

function updateSecurityUI() {
  const securityStatus = getSecurityStatus();
  const settings = getSettings();
  
  const securityIndicator = document.getElementById('securityIndicator');
  const healthIndicator = document.getElementById('healthIndicator');
  const dnsIndicator = document.getElementById('dnsIndicator');
  const webrtcIndicator = document.getElementById('webrtcIndicator');
  const failoverIndicator = document.getElementById('failoverIndicator');
  
  const dnsToggle = document.getElementById('dnsLeakToggle');
  const webRtcToggle = document.getElementById('webRtcToggle');
  
  if (securityIndicator) {
    securityIndicator.classList.toggle('active', securityStatus.status === 'secure');
    const indicatorText = securityIndicator.querySelector('.indicator-text');
    if (indicatorText) {
      indicatorText.textContent = securityStatus.status === 'secure' ? 'Secure' : 'Warning';
    }
  }
  
  const healthStatus = getHealthStatus();
  if (healthIndicator) {
    healthIndicator.classList.toggle('active', healthStatus.active);
    const indicatorText = healthIndicator.querySelector('.indicator-text');
    if (indicatorText) {
      indicatorText.textContent = healthStatus.active ? healthStatus.quality : 'Offline';
    }
  }
  
  // Update DNS indicator
  if (dnsIndicator) {
    const dnsEnabled = securityStatus.dnsLeakProtection !== false;
    dnsIndicator.classList.toggle('active', dnsEnabled);
    dnsIndicator.classList.toggle('inactive', !dnsEnabled);
    const indicatorText = dnsIndicator.querySelector('.indicator-text');
    if (indicatorText) {
      indicatorText.textContent = dnsEnabled ? 'DNS: On' : 'DNS: Off';
    }
  }
  
  // Update WebRTC indicator
  if (webrtcIndicator) {
    const webrtcEnabled = securityStatus.webRtcProtection !== false;
    webrtcIndicator.classList.toggle('active', webrtcEnabled);
    webrtcIndicator.classList.toggle('inactive', !webrtcEnabled);
    const indicatorText = webrtcIndicator.querySelector('.indicator-text');
    if (indicatorText) {
      indicatorText.textContent = webrtcEnabled ? 'WebRTC: On' : 'WebRTC: Off';
    }
  }
  
  // Update failover indicator
  if (failoverIndicator && settings.autoFailover) {
    failoverIndicator.style.display = 'flex';
    failoverIndicator.classList.toggle('active', getCurrentProxy() !== null);
  }
  
  if (dnsToggle) {
    dnsToggle.classList.toggle('active', securityStatus.dnsLeakProtection);
  }
  
  if (webRtcToggle) {
    webRtcToggle.classList.toggle('active', securityStatus.webRtcProtection);
  }
}

function updateHealthUI() {
  const healthStatus = getHealthStatus();
  
  const healthIndicator = document.getElementById('healthIndicator');
  const qualityBadge = document.getElementById('qualityBadge');
  const latencyValue = document.getElementById('latencyValue');
  
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

function updateConnectionQuality(latency, packetLoss = 0) {
  const connectionQuality = getConnectionQuality();
  connectionQuality.latency = latency || 0;
  connectionQuality.packetLoss = packetLoss;
  connectionQuality.quality = calculateConnectionQuality(latency, packetLoss);
  connectionQuality.lastUpdate = Date.now();
  
  // Update inline quality badge
  const qualityBadgeInline = document.getElementById('qualityBadge');
  if (qualityBadgeInline) {
    qualityBadgeInline.className = `quality-badge ${connectionQuality.quality}`;
    qualityBadgeInline.textContent = connectionQuality.quality.charAt(0).toUpperCase() + connectionQuality.quality.slice(1);
  }
  
  const qualityStats = document.getElementById('qualityStats');
  if (qualityStats) {
    qualityStats.textContent = `${connectionQuality.latency}ms`;
  }
  
  // Show quality inline when connected
  const connectionQualityInline = document.getElementById('connectionQualityInline');
  if (connectionQualityInline && getCurrentProxy()) {
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

// ============================================================================
// PANEL & MODAL FUNCTIONS
// ============================================================================

function showPanel(name) {
  let panel;
  let closeButton;
  
  if (name === 'settings') {
    panel = document.getElementById('settingsPanel');
    closeButton = document.getElementById('settingsClose');
  } else if (name === 'stats') {
    panel = document.getElementById('statsPanel');
    closeButton = document.getElementById('statsClose');
  }
  
  if (panel) {
    panel.style.display = 'flex';
    closeButton?.focus();
    const proxyList = document.getElementById('proxyList');
    if (proxyList) proxyList.setAttribute('aria-hidden', 'true');
    announceToScreenReader(`${name} panel opened`);
  }
  
  if (name === 'settings') {
    renderSiteRules();
  } else if (name === 'stats') {
    updateStatsDisplay();
  }
}

function hidePanel(name) {
  let panel;
  let returnFocus;
  
  if (name === 'settings') {
    panel = document.getElementById('settingsPanel');
    returnFocus = document.getElementById('settingsBtn');
  } else if (name === 'stats') {
    panel = document.getElementById('statsPanel');
  }
  
  if (panel) {
    panel.style.display = 'none';
    returnFocus?.focus();
    const proxyList = document.getElementById('proxyList');
    if (proxyList) proxyList.removeAttribute('aria-hidden');
    announceToScreenReader(`${name} panel closed`);
  }
}

function announceToScreenReader(message) {
  const liveRegion = document.getElementById('liveRegion');
  if (liveRegion) {
    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion.textContent = message;
    }, 50);
  }
}

// ============================================================================
// SITE RULES RENDERING
// ============================================================================

function renderSiteRules() {
  const container = document.getElementById('siteRulesList');
  if (!container) return;
  
  const siteRules = getSiteRules();
  
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

// ============================================================================
// BLACKLIST RENDERING
// ============================================================================

function renderBlacklistChips() {
  const blacklistChips = document.getElementById('blacklistChips');
  if (!blacklistChips) return;
  
  const settings = getSettings();
  const proxies = getProxies();
  
  const blacklist = settings.countryBlacklist || [];
  const availableCountries = [...new Set(proxies.map(p => p.country))].sort();
  const availableToAdd = availableCountries.filter(c => !blacklist.includes(c));
  
  let html = blacklist.map(country => `
    <span class="chip chip-active blacklist-chip">
      ${getFlag(country)} ${country}
      <button class="remove-btn" data-country="${country}">×</button>
    </span>
  `).join('');
  
  // Add dropdown to add countries
  if (availableToAdd.length > 0) {
    html += `
      <select class="blacklist-add-select" id="blacklistAddSelect">
        <option value="">+ Add country...</option>
        ${availableToAdd.map(c => `<option value="${c}">${getFlag(c)} ${c}</option>`).join('')}
      </select>
    `;
  }
  
  blacklistChips.innerHTML = html;
  
  // Add click handlers for remove buttons
  blacklistChips.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const country = btn.dataset.country;
      removeFromBlacklist(country);
    });
  });
  
  // Add handler for add dropdown
  const addSelect = document.getElementById('blacklistAddSelect');
  if (addSelect) {
    addSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        addToBlacklist(e.target.value);
        e.target.value = '';
      }
    });
  }
}

async function removeFromBlacklist(country) {
  const settings = getSettings();
  settings.countryBlacklist = settings.countryBlacklist.filter(c => c !== country);
  await chrome.storage.local.set({ settings });
  renderBlacklistChips();
  filterProxies();
  showToast(`Removed ${country} from blacklist`, 'info');
}

async function addToBlacklist(country) {
  const settings = getSettings();
  if (!settings.countryBlacklist.includes(country)) {
    settings.countryBlacklist.push(country);
    await chrome.storage.local.set({ settings });
    renderBlacklistChips();
    filterProxies();
    showToast(`Added ${country} to blacklist`, 'info');
  }
}

// ============================================================================
// STATS DISPLAY
// ============================================================================

function updateStatsDisplay() {
  const dailyStats = getDailyStats();
  const proxies = getProxies();
  const proxyStats = getProxyStats();
  
  const statProxiesUsed = document.getElementById('statProxiesUsed');
  const statConnectionTime = document.getElementById('statConnectionTime');
  const statSuccessRate = document.getElementById('statSuccessRate');
  
  if (statProxiesUsed) statProxiesUsed.textContent = dailyStats.proxiesUsed;
  
  if (statConnectionTime) {
    const hours = Math.floor(dailyStats.connectionTime / 3600);
    const mins = Math.floor((dailyStats.connectionTime % 3600) / 60);
    statConnectionTime.textContent = `${hours}h ${mins}m`;
  }
  
  const rate = dailyStats.attempts > 0 
    ? Math.round((dailyStats.successes / dailyStats.attempts) * 100) 
    : 0;
  if (statSuccessRate) statSuccessRate.textContent = rate + '%';
  
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
  
  const topCountriesList = document.getElementById('topCountriesList');
  if (topCountriesList) {
    topCountriesList.innerHTML = topCountries.map(([country, count]) => `
      <div class="setting">
        <span>${getFlag(country)} ${country}</span>
        <span style="color: var(--accent-primary); font-weight: 600;">${count} connections</span>
      </div>
    `).join('') || '<p style="color: var(--text-secondary); text-align: center;">No data yet</p>';
  }
  
  // Connection history (recent proxies) - Enhanced with reputation
  const recentProxies = Object.entries(proxyStats)
    .filter(([, s]) => s.lastSuccess)
    .sort((a, b) => b[1].lastSuccess - a[1].lastSuccess)
    .slice(0, 10);
  
  const connectionHistoryList = document.getElementById('connectionHistoryList');
  if (connectionHistoryList) {
    connectionHistoryList.innerHTML = recentProxies.map(([ipPort, stats]) => {
      const proxy = proxies.find(p => p.ipPort === ipPort);
      const country = proxy?.country || 'Unknown';
      const flag = getFlag(country);
      const lastUsed = stats.lastSuccess ? new Date(stats.lastSuccess).toLocaleString() : 'Unknown';
      
      return `
        <div class="setting">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div>
              <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                ${flag} ${ipPort}
              </div>
              <div style="font-size: 10px; color: var(--text-secondary);">
                ${country} • Success: ${stats.successRate}% • Avg: ${stats.avgLatency || 0}ms
              </div>
            </div>
            <div style="font-size: 9px; color: var(--text-muted); text-align: right;">
              ${lastUsed}
            </div>
          </div>
        </div>
      `;
    }).join('') || '<p style="color: var(--text-secondary); text-align: center;">No connections yet</p>';
  }
  
  // Suspicious proxies section
  const suspiciousSection = document.getElementById('suspiciousProxiesSection');
  const suspiciousList = document.getElementById('suspiciousProxiesList');
  
  if (suspiciousSection && suspiciousList) {
    const proxyReputation = {}; // Would need to load from storage
    const tamperedProxies = Object.entries(proxyReputation)
      .filter(([, rep]) => rep.tamperDetected)
      .slice(0, 10);
    
    if (tamperedProxies.length > 0) {
      suspiciousSection.style.display = 'block';
      suspiciousList.innerHTML = tamperedProxies.map(([ipPort, rep]) => {
        const proxy = proxies.find(p => p.ipPort === ipPort);
        const country = proxy?.country || rep.country || 'Unknown';
        const flag = getFlag(country);
        return `
          <div class="setting" style="border-left: 3px solid #ff5252;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <div>
                <div style="font-weight: 600;">${flag} ${ipPort}</div>
                <div style="font-size: 10px; color: var(--text-secondary);">
                  ${country} • Score: ${rep.reputationScore || 0}
                </div>
              </div>
              <button class="btn btn-danger btn-sm" onclick="removeFromBlacklist('${country}')">Clear</button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      suspiciousSection.style.display = 'none';
    }
  }
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function showToast(message, type = 'info', onUndo = null) {
  const settings = getSettings();
  if (!settings.notifications && type !== 'error') return;
  
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
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
  setTimeout(() => { 
    toast.classList.add('toast-hide'); 
    setTimeout(() => toast.remove(), 300); 
  }, 3000);
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function hideEmptyState() {
  const emptyState = document.getElementById('emptyState');
  if (!emptyState) return;
  emptyState.style.display = 'none';
}

function showEmptyState(type) {
  const emptyState = document.getElementById('emptyState');
  const loading = document.getElementById('loading');
  const proxyList = document.getElementById('proxyList');
  
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
  
  if (loading) loading.style.display = 'none';
  if (proxyList) proxyList.innerHTML = '';
  emptyState.style.display = 'flex';
  
  // Add action handler
  const actionBtn = document.getElementById('emptyActionBtn');
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      if (type === 'noProxies') {
        loadProxies();
      } else if (type === 'noResults') {
        // Clear all filters including search
        const proxySearch = document.getElementById('proxySearch');
        const countryFilter = document.getElementById('countryFilter');
        const typeFilter = document.getElementById('typeFilter');
        const filterChips = document.getElementById('filterChips');
        
        if (proxySearch) proxySearch.value = '';
        if (countryFilter) countryFilter.value = '';
        if (typeFilter) typeFilter.value = '';
        
        if (filterChips) {
          filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
          const allChip = filterChips.querySelector('[data-value="all"]');
          if (allChip) allChip.classList.add('chip-active');
        }
        
        filterProxies();
      } else if (type === 'noFavorites') {
        switchToTab('all');
      }
    });
  }
}

// Helper function for switching tabs (defined in popup.proxy-list.js but needed here)
function switchToTab(tabName) {
  // This will be handled by the proxy-list module
  setCurrentTab(tabName);
  filterProxies();
}

// Export functions for testing
export {
  getFlag,
  updateUI,
  updateFab,
  updateSecurityUI,
  updateHealthUI,
  updateConnectionQuality,
  showPanel,
  hidePanel,
  announceToScreenReader,
  renderSiteRules,
  renderBlacklistChips,
  removeFromBlacklist,
  addToBlacklist,
  updateStatsDisplay,
  showToast,
  hideEmptyState,
  showEmptyState,
  switchToTab
};
