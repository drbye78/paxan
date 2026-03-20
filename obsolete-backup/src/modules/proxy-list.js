// ProxyMania VPN - Proxy List Module
// Proxy list rendering, filtering, virtual scrolling

import { 
  getState, 
  setState, 
  getProxies, 
  getSettings, 
  getCountryBlacklist,
  getProxyStats,
  getProxyReputation,
  getFavorites,
  setCurrentFilteredProxies,
  countryFlags
} from './state.js';
import { 
  proxyList, 
  proxyCount, 
  listTitle, 
  loading, 
  emptyState, 
  countryFilter,
  typeFilter,
  proxySearch,
  filterChips,
  virtualScroller
} from './dom.js';
import { showLoading, hideEmptyState, showEmptyState, updateProxyCount } from './ui-core.js';
import { showToast } from './toast.js';
import { calculateProxyScore, getTrustBadge, getWorkingStatus, escapeHtml } from './utils.js';
import { loadProxies as loadProxiesFromBackground } from './storage.js';

// ============================================================================
// PROXY LOADING
// ============================================================================

/**
 * Load proxies from background
 * @param {boolean} forceRefresh - Force refresh from server
 * @returns {Promise<Array>} - Loaded proxies
 */
export async function loadProxies(forceRefresh = false) {
  showLoading(true);
  
  try {
    const result = await chrome.runtime.sendMessage({ 
      action: 'fetchProxies',
      forceRefresh 
    });
    
    const newProxies = result?.proxies || [];
    
    if (newProxies.length === 0) {
      showEmptyState('no_proxies');
      showLoading(false);
      return [];
    }
    
    // Merge with stats
    const mergedProxies = await mergeProxiesWithStats(newProxies);
    
    setState({ proxies: mergedProxies });
    
    // Populate country filter
    populateCountryFilter();
    
    // Filter and render
    await filterProxies();
    
    showLoading(false);
    return mergedProxies;
    
  } catch (error) {
    console.error('Error loading proxies:', error);
    showEmptyState('no_proxies');
    showLoading(false);
    showToast('Failed to load proxies', 'error');
    return [];
  }
}

/**
 * Merge proxies with stats and reputation data
 * @param {Array} newProxies - Fresh proxy list
 * @returns {Promise<Array>} - Merged proxy list
 */
export async function mergeProxiesWithStats(newProxies) {
  const proxyStats = getProxyStats();
  const proxyReputation = getProxyReputation();
  const favorites = getFavorites();
  
  return newProxies.map(proxy => {
    const stats = proxyStats[proxy.ipPort] || {};
    const rep = proxyReputation[proxy.ipPort] || {};
    const isFavorite = favorites.some(f => f.ipPort === proxy.ipPort);
    
    return {
      ...proxy,
      score: calculateProxyScore(proxy),
      successRate: stats.successRate || 0,
      avgLatency: stats.avgLatency || 0,
      latencies: stats.latencies || [],
      lastCheck: rep.lastCheck || null,
      isFavorite,
      workingStatus: getWorkingStatus(proxy),
      trustBadge: getTrustBadge(proxy)
    };
  });
}

/**
 * Populate country filter dropdown
 */
export function populateCountryFilter() {
  if (!countryFilter) return;
  
  const proxies = getProxies();
  const countries = [...new Set(proxies.map(p => p.country))].sort();
  
  const currentValue = countryFilter.value;
  
  countryFilter.innerHTML = '<option value="">All Countries</option>' +
    countries.map(country => 
      `<option value="${escapeHtml(country)}">${getFlag(country)} ${country}</option>`
    ).join('');
  
  countryFilter.value = currentValue;
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter proxies based on current filters
 * @returns {Promise<void>}
 */
export async function filterProxies() {
  const proxies = getProxies();
  const { countryBlacklist } = getSettings();
  
  if (!proxyList) return;
  
  // Get filter values
  const country = countryFilter?.value || '';
  const type = typeFilter?.value || '';
  const searchQuery = proxySearch?.value?.toLowerCase() || '';
  
  // Get active speed filter from chips
  let speedFilter = null;
  if (filterChips) {
    const activeChip = filterChips.querySelector('.chip-active');
    if (activeChip) {
      speedFilter = activeChip.dataset.speed;
    }
  }
  
  // Get active trust filter from chips
  let trustFilter = null;
  if (filterChips) {
    const activeChip = filterChips.querySelector('.chip-active');
    if (activeChip) {
      trustFilter = activeChip.dataset.trust;
    }
  }
  
  // Apply filters
  let filtered = [...proxies];
  
  // Country filter
  if (country) {
    filtered = filtered.filter(p => p.country === country);
  }
  
  // Type filter
  if (type) {
    filtered = filtered.filter(p => p.type === type);
  }
  
  // Blacklist filter
  if (countryBlacklist && countryBlacklist.length > 0) {
    filtered = filtered.filter(p => !countryBlacklist.includes(p.country));
  }
  
  // Search filter
  if (searchQuery) {
    filtered = filtered.filter(p => 
      p.country.toLowerCase().includes(searchQuery) ||
      p.ipPort.includes(searchQuery) ||
      p.type.toLowerCase().includes(searchQuery)
    );
  }
  
  // Speed filter
  if (speedFilter) {
    const maxSpeed = parseInt(speedFilter);
    if (maxSpeed) {
      filtered = filtered.filter(p => {
        const latency = p.avgLatency || parseInt(p.speed) || 1000;
        return latency <= maxSpeed;
      });
    }
  }
  
  // Trust filter
  if (trustFilter) {
    filtered = filtered.filter(p => {
      const badge = p.trustBadge?.type || 'unverified';
      return badge === trustFilter;
    });
  }
  
  // Sort by score
  filtered.sort((a, b) => b.score - a.score);
  
  // Update state
  setCurrentFilteredProxies(filtered);
  
  // Update UI
  updateProxyCount(filtered.length, proxies.length);
  
  // Render
  if (filtered.length === 0) {
    showEmptyState(proxies.length === 0 ? 'no_proxies' : 'filtered_empty');
    proxyList.innerHTML = '';
  } else {
    hideEmptyState();
    renderProxyList(filtered);
  }
}

/**
 * Apply multiple filters to proxy list
 * @param {Array} filtered - Proxy list to filter
 * @param {string} country - Country filter
 * @param {string} type - Type filter
 * @param {string} speed - Speed filter
 * @param {string} trust - Trust filter
 * @returns {Array} - Filtered proxies
 */
export function applyFilters(filtered, country, type, speed, trust) {
  // Country
  if (country) {
    filtered = filtered.filter(p => p.country === country);
  }
  
  // Type
  if (type) {
    filtered = filtered.filter(p => p.type === type);
  }
  
  // Speed
  if (speed) {
    const maxSpeed = parseInt(speed);
    if (maxSpeed) {
      filtered = filtered.filter(p => {
        const latency = p.avgLatency || parseInt(p.speed) || 1000;
        return latency <= maxSpeed;
      });
    }
  }
  
  // Trust
  if (trust) {
    filtered = filtered.filter(p => {
      const badge = p.trustBadge?.type || 'unverified';
      return badge === trust;
    });
  }
  
  return filtered;
}

// ============================================================================
// RENDERING
// ============================================================================

/**
 * Render proxy list
 * @param {Array} proxyItems - Proxies to render
 */
export function renderProxyList(proxyItems) {
  if (!proxyList) return;
  
  // Use virtual scroller for large lists
  if (proxyItems.length > 50) {
    renderVirtualList(proxyItems);
  } else {
    renderFullList(proxyItems);
  }
}

/**
 * Render full list (for small lists)
 * @param {Array} proxyItems - Proxies to render
 */
function renderFullList(proxyItems) {
  if (!proxyList) return;
  
  proxyList.innerHTML = proxyItems.map((proxy, index) => 
    createProxyItemHTML(proxy, index)
  ).join('');
  
  // Attach event listeners
  proxyList.querySelectorAll('.proxy-item').forEach((el, index) => {
    attachProxyItemEvents(el, proxyItems[index]);
  });
}

/**
 * Render virtual list (for large lists)
 * @param {Array} proxyItems - Proxies to render
 */
function renderVirtualList(proxyItems) {
  initVirtualScroller();
  
  if (virtualScroller) {
    virtualScroller.render(proxyItems);
  }
}

/**
 * Create proxy item HTML
 * @param {Object} proxy - Proxy object
 * @param {number} index - Item index
 * @returns {string} - HTML string
 */
export function createProxyItemHTML(proxy, index) {
  const flag = getFlag(proxy.country);
  const score = proxy.score || 0;
  const successRate = proxy.successRate || 0;
  const latency = proxy.avgLatency || parseInt(proxy.speed) || 0;
  const trustBadge = proxy.trustBadge || { type: 'unverified', text: 'Unverified' };
  const isFavorite = proxy.isFavorite || false;
  
  return `
    <div class="proxy-item" data-index="${index}" data-ip-port="${escapeHtml(proxy.ipPort)}">
      <div class="proxy-header">
        <div class="proxy-flag">${flag}</div>
        <div class="proxy-info">
          <div class="proxy-country">${escapeHtml(proxy.country)}</div>
          <div class="proxy-address">${escapeHtml(proxy.ipPort)}</div>
        </div>
        <div class="proxy-score">
          <div class="score-badge ${getScoreClass(score)}">${score}</div>
        </div>
      </div>
      <div class="proxy-details">
        <div class="proxy-meta">
          <span class="proxy-type">${proxy.type}</span>
          <span class="proxy-latency">${latency}ms</span>
          <span class="proxy-success">${successRate}%</span>
        </div>
        <div class="trust-badge ${trustBadge.type}">${trustBadge.text}</div>
        ${renderSparkline(proxy.latencies)}
      </div>
      <div class="proxy-actions">
        <button class="favorite-btn ${isFavorite ? 'active' : ''}" title="Add to favorites">
          <svg viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <button class="connect-btn">Connect</button>
      </div>
    </div>
  `;
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

/**
 * Render sparkline chart for latency
 * @param {Array} latencies - Latency values
 * @returns {string} - SVG HTML
 */
export function renderSparkline(latencies) {
  if (!latencies || latencies.length === 0) return '';
  
  const width = 60;
  const height = 20;
  const maxLatency = Math.max(...latencies, 100);
  
  const points = latencies.slice(-10).map((latency, i) => {
    const x = (i / (latencies.length - 1)) * width;
    const y = height - (latency / maxLatency) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return `
    <svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>
  `;
}

/**
 * Attach event listeners to proxy item
 * @param {HTMLElement} el - Proxy item element
 * @param {Object} proxy - Proxy object
 */
export function attachProxyItemEvents(el, proxy) {
  if (!el) return;
  
  // Favorite button
  const favoriteBtn = el.querySelector('.favorite-btn');
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFavorite(proxy);
    });
  }
  
  // Connect button
  const connectBtn = el.querySelector('.connect-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { connectToProxy } = await import('./connection.js');
      await connectToProxy(proxy, e);
    });
  }
  
  // Item click
  el.addEventListener('click', async (e) => {
    if (e.target.closest('.favorite-btn') || e.target.closest('.connect-btn')) {
      return;
    }
    
    const { connectToProxy } = await import('./connection.js');
    await connectToProxy(proxy, e);
  });
}

// ============================================================================
// VIRTUAL SCROLLER
// ============================================================================

class VirtualScroller {
  constructor(container, options = {}) {
    this.container = container;
    this.items = [];
    this.itemHeight = options.itemHeight || 80;
    this.bufferSize = options.bufferSize || 5;
    this.renderItem = options.renderItem || (() => '');
    this.onItemClick = options.onItemClick || (() => {});
    
    this.scrollTop = 0;
    this.containerHeight = 0;
    this.visibleStartIndex = 0;
    this.visibleEndIndex = 0;
    this.totalHeight = 0;
    
    this.isScrolling = false;
    this.scrollTimeout = null;
    
    this.init();
  }
  
  init() {
    if (!this.container) return;
    
    this.container.addEventListener('scroll', this.handleScroll.bind(this));
    window.addEventListener('resize', this.handleResize.bind(this));
    
    this.updateDimensions();
  }
  
  updateDimensions() {
    this.containerHeight = this.container.clientHeight;
    this.render();
  }
  
  handleResize() {
    this.updateDimensions();
  }
  
  handleScroll() {
    if (this.isScrolling) return;
    
    this.isScrolling = true;
    this.scrollTop = this.container.scrollTop;
    
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    this.scrollTimeout = setTimeout(() => {
      this.render();
      this.isScrolling = false;
    }, 16);
    
    this.render();
  }
  
  setItems(items) {
    this.items = items;
    this.totalHeight = this.items.length * this.itemHeight;
    this.render();
  }
  
  getVisibleRange() {
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const endIndex = Math.min(this.items.length - 1, startIndex + visibleCount + this.bufferSize * 2);
    
    return { startIndex, endIndex, visibleCount };
  }
  
  render() {
    if (!this.items.length) {
      this.container.innerHTML = '';
      this.container.style.height = '0px';
      return;
    }
    
    const { startIndex, endIndex } = this.getVisibleRange();
    
    this.visibleStartIndex = startIndex;
    this.visibleEndIndex = endIndex;
    
    const spacerHeight = startIndex * this.itemHeight;
    const visibleItems = this.items.slice(startIndex, endIndex + 1);
    
    let html = `<div style="height: ${spacerHeight}px;"></div>`;
    
    visibleItems.forEach((item, i) => {
      const actualIndex = startIndex + i;
      html += this.renderItem(item, actualIndex);
    });
    
    const remainingHeight = Math.max(0, (this.items.length - 1 - endIndex) * this.itemHeight);
    html += `<div style="height: ${remainingHeight}px;"></div>`;
    
    this.container.innerHTML = html;
    
    this.attachEventListeners();
  }
  
  attachEventListeners() {
    const items = this.container.querySelectorAll('.proxy-item');
    items.forEach((item, i) => {
      item.addEventListener('click', (e) => {
        const actualIndex = this.visibleStartIndex + i;
        if (this.items[actualIndex]) {
          this.onItemClick(this.items[actualIndex], e);
        }
      });
    });
  }
  
  scrollToIndex(index) {
    const scrollPosition = index * this.itemHeight;
    this.container.scrollTop = scrollPosition;
  }
  
  destroy() {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.container?.removeEventListener('scroll', this.handleScroll);
    window?.removeEventListener('resize', this.handleResize);
  }
}

let virtualScrollerInstance = null;

export function initVirtualScroller() {
  const container = document.getElementById('proxyListContainer');
  if (!container) return null;
  
  if (virtualScrollerInstance) {
    virtualScrollerInstance.destroy();
  }
  
  virtualScrollerInstance = new VirtualScroller(container, {
    itemHeight: 80,
    bufferSize: 5,
    renderItem: (proxy, index) => createProxyItemHTML(proxy, index),
    onItemClick: (proxy, e) => {
      if (e.ctrlKey || e.metaKey) {
        window.open(`http://${proxy.ip}:${proxy.port}`, '_blank');
      } else {
        connectToProxy(proxy, e);
      }
    }
  });
  
  return virtualScrollerInstance;
}

export function updateVirtualScroller(proxies) {
  if (virtualScrollerInstance) {
    virtualScrollerInstance.setItems(proxies);
  }
}

export function destroyVirtualScroller() {
  if (virtualScrollerInstance) {
    virtualScrollerInstance.destroy();
    virtualScrollerInstance = null;
  }
}

// ============================================================================
// FAVORITES
// ============================================================================

/**
 * Toggle proxy favorite status
 * @param {Object} proxy - Proxy object
 * @returns {Promise<void>}
 */
export async function toggleFavorite(proxy) {
  const favorites = getFavorites();
  const isFavorite = favorites.some(f => f.ipPort === proxy.ipPort);
  
  if (isFavorite) {
    await removeFromFavorites(proxy.ipPort);
    showToast('Removed from favorites', 'info');
  } else {
    await addToFavorites(proxy);
    showToast('Added to favorites', 'success');
  }
  
  // Re-render list
  await filterProxies();
}

/**
 * Add proxy to favorites
 * @param {Object} proxy - Proxy object
 * @returns {Promise<void>}
 */
async function addToFavorites(proxy) {
  const favorites = getFavorites();
  favorites.push(proxy);
  setState({ favorites });
  
  await chrome.storage.local.set({ favorites });
}

/**
 * Remove proxy from favorites
 * @param {string} ipPort - Proxy IP:Port
 * @returns {Promise<void>}
 */
async function removeFromFavorites(ipPort) {
  const favorites = getFavorites();
  const filtered = favorites.filter(f => f.ipPort !== ipPort);
  setState({ favorites: filtered });
  
  await chrome.storage.local.set({ favorites: filtered });
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get flag emoji for country
 * @param {string} country - Country name
 * @returns {string} - Flag emoji
 */
function getFlag(country) {
  if (!country) return '🌍';
  return countryFlags[country] || countryFlags[country.split(' ')[0]] || '🌍';
}
