// ProxyMania VPN - Country Blacklist Module
// Filter out countries from proxy list

import { getState, setState, getCountryBlacklist, getProxies, updateCountryBlacklist, addToCountryBlacklist, removeFromCountryBlacklist } from './state.js';
import { blacklistContainer, blacklistChips } from './dom.js';
import { showToast } from './toast.js';
import { saveSettings } from './storage.js';
import { filterProxies } from './proxy-list.js';
import { escapeHtml } from './utils.js';

// ============================================================================
// BLACKLIST MANAGEMENT
// ============================================================================

/**
 * Toggle blacklist panel visibility
 */
export function toggleBlacklistPanel() {
  if (!blacklistContainer) return;
  
  const isVisible = blacklistContainer.style.display !== 'none';
  blacklistContainer.style.display = isVisible ? 'none' : 'block';
  
  if (!isVisible) {
    renderBlacklistChips();
  }
}

/**
 * Render blacklist chips
 */
export function renderBlacklistChips() {
  if (!blacklistChips) return;
  
  const blacklist = getCountryBlacklist();
  const proxies = getProxies();
  const availableCountries = [...new Set(proxies.map(p => p.country))].sort();
  const availableToAdd = availableCountries.filter(c => !blacklist.includes(c));
  
  let html = blacklist.map(country => `
    <span class="chip chip-active blacklist-chip">
      ${getFlag(country)} ${country}
      <button class="remove-btn" data-country="${escapeHtml(country)}">×</button>
    </span>
  `).join('');
  
  // Add dropdown to add countries
  if (availableToAdd.length > 0) {
    html += `
      <select class="blacklist-add-select" id="blacklistAddSelect">
        <option value="">+ Add country...</option>
        ${availableToAdd.map(c => `<option value="${escapeHtml(c)}">${getFlag(c)} ${c}</option>`).join('')}
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
  
  // Add handler for add select
  const addSelect = blacklistChips.querySelector('#blacklistAddSelect');
  if (addSelect) {
    addSelect.addEventListener('change', (e) => {
      const country = e.target.value;
      if (country) {
        addToBlacklist(country);
      }
    });
  }
}

/**
 * Add country to blacklist
 * @param {string} country - Country to add
 */
export async function addToBlacklist(country) {
  if (!country) return;
  
  addToCountryBlacklist(country);
  await saveSettings();
  
  renderBlacklistChips();
  filterProxies();
  
  showToast(`${country} added to blacklist`, 'info');
}

/**
 * Remove country from blacklist
 * @param {string} country - Country to remove
 */
export async function removeFromBlacklist(country) {
  if (!country) return;
  
  removeFromCountryBlacklist(country);
  await saveSettings();
  
  renderBlacklistChips();
  filterProxies();
  
  showToast(`${country} removed from blacklist`, 'info');
}

/**
 * Clear blacklist
 */
export async function clearBlacklist() {
  updateCountryBlacklist([]);
  await saveSettings();
  
  renderBlacklistChips();
  filterProxies();
  
  showToast('Blacklist cleared', 'success');
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
  const { countryFlags } = require('./state.js');
  if (!country) return '🌍';
  return countryFlags[country] || countryFlags[country.split(' ')[0]] || '🌍';
}

/**
 * Escape HTML
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
