// ProxyMania VPN - Popup Proxy List Management
// Handles proxy filtering, sorting, scoring, and rendering

import {
  getCurrentProxy,
  getSettings,
  getFavorites,
  getProxyStats,
  getProxyReputation,
  setProxies,
  getProxies,
  getCurrentTab,
  setCurrentTab,
  toggleFavorite
} from './popup.state.js';

import { SCORING_WEIGHTS, THRESHOLDS, TRUST_THRESHOLDS } from '../popup/constants.js';

import {
  getFlag,
  updateUI,
  showToast,
  showEmptyState,
  hideEmptyState
} from './popup.ui.js';

import {
  connectToProxy
} from './popup.connection.js';

// Virtual scroller instance
let virtualScroller = null;

// ============================================================================
// PROXY LOADING & PROCESSING
// ============================================================================

async function loadProxies(forceRefresh = false) {
  const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
  
  // If force refresh, clear cache first
  if (forceRefresh) {
    await chrome.storage.local.remove(['proxies', 'proxiesTimestamp']);
  }
  
  // Try to load cached proxies first
  try {
    const cached = await chrome.storage.local.get(['proxies', 'proxiesTimestamp', 'proxyStats']);
    const cacheAge = cached.proxiesTimestamp ? Date.now() - cached.proxiesTimestamp : Infinity;
    const isCacheFresh = cacheAge < CACHE_MAX_AGE;
    
    if (cached.proxies?.length > 0 && !forceRefresh) {
      setProxies(cached.proxies);
      await loadProxyStats();
      populateCountryFilter();
      filterProxies();
      updateProxyCount();
      renderQuickConnect();
      renderRecommended();
      showLoading(false);
      
      // If cache is fresh, skip fetching
      if (isCacheFresh) {
        console.log('Using fresh cache, skipping fetch');
        return;
      }
      
      // Cache is stale - show indicator and refresh in background
      showToast(`Using cached proxies (refreshing...)`, 'info');
    } else {
      showLoading(true);
    }
  } catch (error) { 
    console.error('Error loading cached:', error); 
    showLoading(true); // Show loading on error to trigger fetch
  }
  
  // Fetch fresh proxies
  try {
    showLoading(true);
    const response = await chrome.runtime.sendMessage({ action: 'fetchProxies' });
    if (response?.proxies) {
      // Merge new proxies with existing stats
      const mergedProxies = await mergeProxiesWithStats(response.proxies);
      setProxies(mergedProxies);
      await chrome.storage.local.set({ 
        proxies: mergedProxies, 
        proxiesTimestamp: Date.now() 
      });
      await loadProxyStats();
      populateCountryFilter();
      filterProxies();
      updateProxyCount();
      renderQuickConnect();
      renderRecommended();
      if (mergedProxies.length > 0) showToast(`Loaded ${mergedProxies.length} proxies`, 'info');
    }
  } catch (error) {
    // Check if offline
    const currentProxies = getProxies();
    if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
      if (!currentProxies.length) {
        showEmptyState('noProxies');
        showToast('You appear to be offline', 'warning');
      } else {
        showToast('Offline - using cached proxies', 'warning');
      }
    } else {
      if (!currentProxies.length) showEmptyState('noProxies');
      else showToast('Using cached proxies', 'warning');
    }
  } finally {
    showLoading(false);
  }
}

async function mergeProxiesWithStats(newProxies) {
  try {
    const { proxyStats = {} } = await chrome.storage.local.get(['proxyStats']);
    
    return newProxies.map(proxy => {
      const historicalStats = proxyStats[proxy.ipPort];
      
      if (historicalStats) {
        // Use historical avgLatency if current speedMs is missing or seems wrong
        const effectiveSpeedMs = proxy.speedMs > 5000 && historicalStats.avgLatency 
          ? historicalStats.avgLatency 
          : proxy.speedMs;
        
        // Boost score for proxies with good historical success rate
        const historicalBonus = historicalStats.successRate > 80 ? 5 : 0;
        
        return {
          ...proxy,
          speedMs: effectiveSpeedMs,
          historicalSuccessRate: historicalStats.successRate,
          historicalAvgLatency: historicalStats.avgLatency,
          historicalAttempts: historicalStats.attempts,
          historicalBonus
        };
      }
      
      return proxy;
    });
  } catch (error) {
    console.error('Error merging proxies with stats:', error);
    return newProxies;
  }
}

async function loadProxyStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getProxyStats' });
    const proxyStats = response.stats || {};
    return proxyStats;
  } catch (error) { 
    return {}; 
  }
}

async function loadProxyReputation() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAllReputation' });
    return response || {};
  } catch (error) { 
    return {}; 
  }
}

// ============================================================================
// FILTERING & SORTING
// ============================================================================

function populateCountryFilter() {
  const countryFilter = document.getElementById('countryFilter');
  if (!countryFilter) return;
  
  const proxies = getProxies();
  const countries = [...new Set(proxies.map(p => p.country))].sort();
  countryFilter.innerHTML = '<option value="">🌍 All Countries</option>';
  countries.forEach(country => {
    const opt = document.createElement('option');
    opt.value = country;
    opt.textContent = `${getFlag(country)} ${country}`;
    countryFilter.appendChild(opt);
  });
}

async function filterProxies() {
  const countryFilter = document.getElementById('countryFilter');
  const typeFilter = document.getElementById('typeFilter');
  const filterChips = document.getElementById('filterChips');
  const proxySearch = document.getElementById('proxySearch');
  
  const selectedCountry = countryFilter?.value || '';
  const selectedType = typeFilter?.value || '';
  const activeChip = filterChips?.querySelector('.chip-active');
  const speedFilter = activeChip?.dataset?.filter === 'speed' ? activeChip.dataset.value : 'all';
  const trustFilter = activeChip?.dataset?.filter === 'trust' ? activeChip.dataset.value : 'all';
  const searchQuery = proxySearch?.value?.toLowerCase() || '';
  
  const proxies = getProxies();
  const settings = getSettings();
  let filtered = proxies;
  
  // Apply country blacklist filter
  const blacklist = settings.countryBlacklist || [];
  if (blacklist.length > 0) {
    filtered = filtered.filter(p => !blacklist.includes(p.country));
  }
  
  // Apply search filter
  if (searchQuery) {
    filtered = filtered.filter(p =>
      p.ipPort.toLowerCase().includes(searchQuery) ||
      p.country.toLowerCase().includes(searchQuery) ||
      p.type.toLowerCase().includes(searchQuery) ||
      p.ip.toLowerCase().includes(searchQuery)
    );
  }
  
  const currentTab = getCurrentTab();
  if (currentTab === 'favorites') {
    const favorites = getFavorites();
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
  
  applyFilters(filtered, selectedCountry, selectedType, speedFilter, trustFilter);
}

function applyFilters(filtered, country, type, speed, trust) {
  const proxyList = document.getElementById('proxyList');
  if (!proxyList) return;
  
  if (country) filtered = filtered.filter(p => p.country === country);
  if (type) filtered = filtered.filter(p => p.type === type);
  if (speed === 'fast') filtered = filtered.filter(p => p.speedMs < 100);
  if (speed === 'medium') filtered = filtered.filter(p => p.speedMs < 300);
  
  const proxyReputation = getProxyReputation();
  
  // Trust filter
  if (trust === 'trusted') {
    filtered = filtered.filter(p => {
      const rep = proxyReputation[p.ipPort];
      return rep && rep.reputationScore >= TRUST_THRESHOLDS.TRUSTED;
    });
  } else if (trust === 'risky') {
    filtered = filtered.filter(p => {
      const rep = proxyReputation[p.ipPort];
      return rep && rep.reputationScore < TRUST_THRESHOLDS.UNVERIFIED;
    });
  } else if (trust === 'tampered') {
    filtered = filtered.filter(p => {
      const rep = proxyReputation[p.ipPort];
      return rep && rep.tamperDetected === true;
    });
  }
  
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
  if (!proxy) return 0;
  
  const proxyStats = getProxyStats();
  const favorites = getFavorites();
  const stats = proxyStats[proxy.ipPort] || { successRate: 50, avgLatency: 100 };
  
  // Use historical avgLatency if available and current seems wrong
  const latencyToUse = proxy.historicalAvgLatency && proxy.speedMs > 5000 
    ? proxy.historicalAvgLatency 
    : proxy.speedMs;
  
  const speedScore = Math.max(0, 100 - latencyToUse / 5);
  const reliabilityScore = stats.successRate || 50;
  
  let freshnessScore = 50;
  if (proxy.lastCheck) {
    const lastCheck = proxy.lastCheck.toLowerCase();
    // Russian
    if (lastCheck.includes('только что') || lastCheck.includes('1 мин')) freshnessScore = 100;
    else if (lastCheck.includes('2 мин')) freshnessScore = 90;
    else if (lastCheck.includes('3 мин')) freshnessScore = 80;
    else if (lastCheck.includes('4 мин') || lastCheck.includes('5 мин')) freshnessScore = 70;
    // English
    else if (lastCheck.includes('recent') || lastCheck.includes('just now')) freshnessScore = 100;
    else if (lastCheck.includes('minute')) freshnessScore = 80;
  }
  
  // Boost for favorites and good historical performance
  const favoriteBonus = favorites.some(f => f.ipPort === proxy.ipPort) ? (SCORING_WEIGHTS.FAVORITE_BONUS * 100) : 0;
  const historicalBonus = proxy.historicalBonus || 0;
  
  // Extra boost for proxies with proven track record (many attempts)
  const experienceBonus = (proxy.historicalAttempts > 10) ? (SCORING_WEIGHTS.ATTEMPTS_BONUS * 100) : 0;
  
  return (speedScore * SCORING_WEIGHTS.SPEED) + (reliabilityScore * SCORING_WEIGHTS.RELIABILITY) + (freshnessScore * SCORING_WEIGHTS.FRESHNESS) + favoriteBonus + historicalBonus + experienceBonus;
}

// Get recommended proxies
function getRecommendedProxies(excludeProxy = null) {
  const proxies = getProxies();
  return proxies
    .filter(p => !excludeProxy || p.ipPort !== excludeProxy.ipPort)
    .map(p => ({ ...p, score: calculateProxyScore(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function getBestProxy() {
  const proxies = getProxies();
  const proxyStats = getProxyStats();
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
    // Create a mock event object that works with connectToProxy
    const mockEvent = {
      target: document.createElement('div'),
      stopPropagation: () => {}
    };
    mockEvent.target.closest = () => null;
    mockEvent.target.querySelector = () => null;
    await connectToProxy(best, mockEvent);
  } else {
    showToast('No suitable proxy found', 'warning');
  }
}

// ============================================================================
// RENDERING
// ============================================================================

function renderProxyList(proxyItems) {
  const proxyList = document.getElementById('proxyList');
  if (!proxyList) return;
  
  window.currentFilteredProxies = proxyItems;
  
  if (!proxyItems.length) {
    hideEmptyState();
    showEmptyState(getCurrentTab() === 'favorites' ? 'noFavorites' : 'noResults');
    return;
  }
  hideEmptyState();
  
  if (virtualScroller) {
    virtualScroller.setItems(proxyItems);
  } else {
    // Render all items (fallback)
    proxyList.innerHTML = '';
    proxyItems.forEach((proxy, index) => {
      const item = createProxyItem(proxy, proxyItems);
      proxyList.appendChild(item);
    });
  }
}

function createProxyItem(proxy, proxyItemsList) {
  const item = document.createElement('div');
  const currentProxy = getCurrentProxy();
  item.className = 'proxy-item' + (currentProxy?.ipPort === proxy.ipPort ? ' active' : '');
  const proxyStats = getProxyStats();
  const stats = proxyStats[proxy.ipPort] || {};
  const flag = getFlag(proxy.country);
  const favorites = getFavorites();
  const isFav = favorites.some(f => f.ipPort === proxy.ipPort);
  const workingStatus = getWorkingStatus(proxy);
  const trustBadge = getTrustBadge(proxy);
  const isActive = currentProxy?.ipPort === proxy.ipPort;
  
  item.setAttribute('role', 'listitem');
  item.setAttribute('tabindex', '0');
  item.setAttribute('aria-label', `${proxy.country}, ${proxy.type}, ${proxy.speedMs}ms${isActive ? ', connected' : ''}`);
  
  item.innerHTML = `
    <div class="proxy-info">
      <div class="proxy-ip">
        <span class="proxy-flag">${flag}</span>
        <span>${proxy.ipPort}</span>
        ${trustBadge}
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
      <button class="icon-btn fav-btn ${isFav ? 'active' : ''}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">${isFav ? '⭐' : '☆'}</button>
      <button class="connect-btn ${isActive ? 'active' : ''}" aria-label="${isActive ? 'Connected to' : 'Connect to'} ${proxy.ipPort}">
        ${isActive ? 'Connected' : 'Connect'}
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
  
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      connectToProxy(proxy, { target: item });
    }
  });
  
  return item;
}

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

function getWorkingStatus(proxy) {
  if (!proxy || !proxy.lastCheck) return 'unknown';
  const lastCheck = proxy.lastCheck.toLowerCase();
  const recent = ['только что', '1 мин', '2 мин', '3 мин', 'recent', 'just now', 'minute'].some(t => lastCheck.includes(t));
  return recent ? 'good' : 'warning';
}

function getTrustBadge(proxy) {
  const proxyReputation = getProxyReputation();
  const rep = proxyReputation[proxy.ipPort];
  if (!rep) return '';
  
  const score = rep.reputationScore || 0;
  const tampered = rep.tamperDetected;
  
  // Tamper detection takes priority
  if (tampered) {
    return '<span class="trust-badge tampered" title="Tampering detected! This proxy may be intercepting your traffic">⚠️ Tampered</span>';
  }
  
  if (score >= TRUST_THRESHOLDS.TRUSTED) {
    return '<span class="trust-badge trusted" title="Trust Score: ' + score + '">🟢 Trusted</span>';
  } else if (score >= TRUST_THRESHOLDS.UNVERIFIED) {
    return '<span class="trust-badge unverified" title="Trust Score: ' + score + '">🟡 Unverified</span>';
  } else {
    return '<span class="trust-badge risky" title="Trust Score: ' + score + '">🔴 Risky</span>';
  }
}

function updateProxyCount() {
  const proxyCount = document.getElementById('proxyCount');
  if (proxyCount) {
    proxyCount.textContent = getProxies().length;
  }
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  const proxyList = document.getElementById('proxyList');
  const emptyState = document.getElementById('emptyState');
  
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

// ============================================================================
// QUICK CONNECT & RECOMMENDED
// ============================================================================

function renderQuickConnect() {
  const quickConnectGrid = document.getElementById('quickConnectGrid');
  const quickConnectSection = document.getElementById('quickConnectSection');
  if (!quickConnectGrid || !quickConnectSection) return;
  
  const proxies = getProxies();
  const settings = getSettings();
  
  // Filter out blacklisted countries
  const blacklist = settings.countryBlacklist || [];
  const fastest = proxies
    .filter(p => 
      p.speedMs < 150 && 
      getWorkingStatus(p) === 'good' &&
      !blacklist.includes(p.country)
    )
    .sort((a, b) => a.speedMs - b.speedMs).slice(0, 4);
  
  if (!fastest.length) { 
    quickConnectSection.style.display = 'none'; 
    return; 
  }
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

function renderRecommended() {
  const recommendedSection = document.getElementById('recommendedSection');
  const recommendedList = document.getElementById('recommendedList');
  if (!recommendedSection || !recommendedList) return;
  
  const recommended = getRecommendedProxies();
  if (!recommended.length || recommended[0].score < 60) {
    recommendedSection.style.display = 'none';
    return;
  }
  recommendedSection.style.display = 'block';
  
  const proxyStats = getProxyStats();
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
    const proxies = getProxies();
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

// ============================================================================
// TAB SWITCHING
// ============================================================================

function switchToTab(tabName) {
  setCurrentTab(tabName);
  
  const mainTabs = document.getElementById('mainTabs');
  const tabChips = document.getElementById('tabChips');
  const listTitle = document.getElementById('listTitle');
  
  // Update old tabs if they exist
  if (mainTabs) {
    mainTabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('tab-active', t.dataset.tab === tabName));
  }
  
  // Update new tab chips if they exist
  if (tabChips) {
    tabChips.querySelectorAll('.chip').forEach(t => t.classList.toggle('chip-active', t.dataset.tab === tabName));
  }
  
  if (listTitle) {
    listTitle.textContent = { all: 'Available Proxies', favorites: '⭐ Favorites', recent: '🕐 Recently Used' }[tabName];
  }
  
  filterProxies();
}

// Export functions for testing
export {
  loadProxies,
  loadProxyStats,
  loadProxyReputation,
  mergeProxiesWithStats,
  filterProxies,
  populateCountryFilter,
  applyFilters,
  calculateProxyScore,
  getRecommendedProxies,
  getBestProxy,
  connectToBestProxy,
  renderProxyList,
  createProxyItem,
  renderSparkline,
  getWorkingStatus,
  getTrustBadge,
  updateProxyCount,
  showLoading,
  renderQuickConnect,
  renderRecommended,
  switchToTab
};
