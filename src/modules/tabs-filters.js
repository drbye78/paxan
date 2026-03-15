// PeasyProxy VPN - Tabs & Filters Module
// Tab switching and filter management

import { getState, setState, getCurrentTab, setCurrentTab } from './state.js';
import { proxyList, listTitle } from './dom.js';
import { getProxies, getFavorites, getCountryBlacklist } from './state.js';
import { filterProxies } from './proxy-list.js';
import { escapeHtml, getFlag } from './utils.js';

// ============================================================================
// TAB SWITCHING
// ============================================================================

/**
 * Switch to a different tab
 * @param {string} tabName - Tab name: all, favorites, recent
 */
export function switchToTab(tabName) {
  setCurrentTab(tabName);
  
  // Update tab UI
  updateTabUI(tabName);
  
  // Filter and render proxies for this tab
  renderTabContent(tabName);
}

/**
 * Update tab UI to show active tab
 * @param {string} tabName - Active tab name
 */
function updateTabUI(tabName) {
  const tabContainer = document.getElementById('tabChips') || document.getElementById('mainTabs');
  if (!tabContainer) return;
  
  const tabs = tabContainer.querySelectorAll('[data-tab]');
  tabs.forEach(tab => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle('chip-active', isActive);
    tab.setAttribute('aria-pressed', isActive);
  });
}

/**
 * Render content for current tab
 * @param {string} tabName - Tab name
 */
function renderTabContent(tabName) {
  let proxies = [];
  let title = '';
  
  switch (tabName) {
    case 'all':
      proxies = getProxies();
      title = 'All Proxies';
      break;
      
    case 'favorites':
      proxies = getFavorites();
      title = `Favorites (${proxies.length})`;
      break;
      
    case 'recent':
      const { getRecentlyUsed } = require('./storage.js');
      const recent = getRecentlyUsed();
      proxies = recent.map(r => r.proxy);
      title = `Recently Used (${proxies.length})`;
      break;
  }
  
  // Update list title
  if (listTitle) {
    listTitle.textContent = title;
  }
  
  // Render proxies
  if (proxies.length === 0) {
    showEmptyStateForTab(tabName);
  } else {
    renderProxiesForTab(proxies);
  }
}

/**
 * Show empty state for tab
 * @param {string} tabName - Tab name
 */
function showEmptyStateForTab(tabName) {
  const emptyState = document.getElementById('emptyState');
  if (!emptyState) return;
  
  const messages = {
    all: {
      title: 'No Proxies Available',
      message: 'Click refresh to load proxies from the server',
      icon: '📡'
    },
    favorites: {
      title: 'No Favorites',
      message: 'Star your favorite proxies to quickly access them',
      icon: '⭐'
    },
    recent: {
      title: 'No Recent Proxies',
      message: 'Recently used proxies will appear here',
      icon: '🕐'
    }
  };
  
  const config = messages[tabName] || messages.all;
  
  const titleEl = emptyState.querySelector('.empty-title');
  const messageEl = emptyState.querySelector('.empty-message');
  const iconEl = emptyState.querySelector('.empty-icon');
  
  if (titleEl) titleEl.textContent = config.title;
  if (messageEl) messageEl.textContent = config.message;
  if (iconEl) iconEl.textContent = config.icon;
  
  emptyState.style.display = 'flex';
  
  if (proxyList) {
    proxyList.innerHTML = '';
  }
}

/**
 * Render proxies for tab
 * @param {Array} proxies - Proxies to render
 */
function renderProxiesForTab(proxies) {
  const { hideEmptyState } = require('./ui-core.js');
  const { createProxyItemHTML, attachProxyItemEvents } = require('./proxy-list.js');
  
  hideEmptyState();
  
  if (!proxyList) return;
  
  // Score and sort proxies
  const { calculateProxyScore } = require('./utils.js');
  
  const scored = proxies.map(proxy => ({
    ...proxy,
    score: calculateProxyScore(proxy)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  // Render
  proxyList.innerHTML = scored.map((proxy, index) => 
    createProxyItemHTML(proxy, index)
  ).join('');
  
  // Attach event listeners
  proxyList.querySelectorAll('.proxy-item').forEach((el, index) => {
    attachProxyItemEvents(el, scored[index]);
  });
}

// ============================================================================
// FILTER MANAGEMENT
// ============================================================================

/**
 * Apply filters to proxy list
 * @returns {Promise<void>}
 */
export async function applyFilters() {
  await filterProxies();
}

/**
 * Clear all filters
 */
export function clearFilters() {
  const countryFilter = document.getElementById('countryFilter');
  const typeFilter = document.getElementById('typeFilter');
  const proxySearch = document.getElementById('proxySearch');
  const filterChips = document.getElementById('filterChips');
  
  if (countryFilter) countryFilter.value = '';
  if (typeFilter) typeFilter.value = '';
  if (proxySearch) proxySearch.value = '';
  
  // Reset filter chips
  if (filterChips) {
    filterChips.querySelectorAll('.chip').forEach(chip => {
      chip.classList.remove('chip-active');
      chip.setAttribute('aria-pressed', 'false');
    });
  }
  
  // Re-filter
  filterProxies();
}

/**
 * Get active filters
 * @returns {Object} - Active filter values
 */
export function getActiveFilters() {
  const countryFilter = document.getElementById('countryFilter');
  const typeFilter = document.getElementById('typeFilter');
  const proxySearch = document.getElementById('proxySearch');
  
  return {
    country: countryFilter?.value || '',
    type: typeFilter?.value || '',
    search: proxySearch?.value || ''
  };
}

/**
 * Set filter values
 * @param {Object} filters - Filter values
 */
export function setFilters(filters) {
  const countryFilter = document.getElementById('countryFilter');
  const typeFilter = document.getElementById('typeFilter');
  const proxySearch = document.getElementById('proxySearch');
  
  if (filters.country && countryFilter) countryFilter.value = filters.country;
  if (filters.type && typeFilter) typeFilter.value = filters.type;
  if (filters.search && proxySearch) proxySearch.value = filters.search;
}

// ============================================================================
// COUNTRY FLAGS
// ============================================================================

/**
 * Get flag emoji for country
 * @param {string} country - Country name
 * @returns {string} - Flag emoji
 */
export function getCountryFlag(country) {
  if (!country) return '🌍';
  
  const { countryFlags } = require('./state.js');
  return countryFlags[country] || countryFlags[country.split(' ')[0]] || '🌍';
}

// Helper for require
function require(module) {
  console.warn(`Dynamic import not implemented: ${module}`);
  return {};
}
