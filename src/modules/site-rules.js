// ProxyMania VPN - Site Rules Module
// Per-site proxy rules management

import { getState, setState, getSiteRules, getCurrentProxy, getProxies } from './state.js';
import { showToast, showSuccess, showWarning, showError } from './toast.js';
import { saveSiteRules } from './storage.js';
import { matchesPattern } from './utils.js';

// ============================================================================
// SITE RULES MANAGEMENT
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
    
    setState({ siteRules: rules });
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
    setState({ siteRules: rules });
    showSuccess('Site rules saved');
    return true;
  } catch (error) {
    console.error('Error saving site rules:', error);
    showError('Failed to save rules');
    return false;
  }
}

/**
 * Add site rule
 * @param {Object} rule - Rule to add
 * @returns {Promise<boolean>} - Success status
 */
export async function addSiteRule(rule) {
  const rules = getSiteRules();
  
  // Find proxies from that country
  const proxies = getProxies();
  const countryProxies = proxies.filter(p => p.country === rule.country);
  
  if (countryProxies.length === 0) {
    showWarning('No proxies available for ' + rule.country);
    return false;
  }
  
  const newRule = {
    id: Date.now(),
    url: rule.url,
    patternType: rule.patternType || 'exact',
    priority: rule.priority || 999,
    country: rule.country,
    proxyIps: countryProxies.map(p => p.ipPort),
    enabled: true
  };
  
  rules.push(newRule);
  
  // Sort by priority
  rules.sort((a, b) => a.priority - b.priority);
  
  await saveSiteRules(rules);
  renderSiteRules();
  
  showSuccess('Rule added');
  return true;
}

/**
 * Remove site rule
 * @param {number} ruleId - Rule ID to remove
 * @returns {Promise<boolean>} - Success status
 */
export async function removeSiteRule(ruleId) {
  const rules = getSiteRules();
  const filtered = rules.filter(r => r.id !== ruleId);
  
  await saveSiteRules(filtered);
  renderSiteRules();
  
  showSuccess('Rule deleted');
  return true;
}

/**
 * Toggle site rule enabled state
 * @param {number} ruleId - Rule ID to toggle
 * @returns {Promise<boolean>} - Success status
 */
export async function toggleSiteRule(ruleId) {
  const rules = getSiteRules();
  const rule = rules.find(r => r.id === ruleId);
  
  if (!rule) {
    return false;
  }
  
  rule.enabled = !rule.enabled;
  
  await saveSiteRules(rules);
  renderSiteRules();
  
  showSuccess(`Rule ${rule.enabled ? 'enabled' : 'disabled'}`);
  return true;
}

/**
 * Update rule priority
 * @param {number} ruleId - Rule ID
 * @param {number} direction - Direction: -1 (up) or 1 (down)
 * @returns {Promise<boolean>} - Success status
 */
export async function updateRulePriority(ruleId, direction) {
  const rules = getSiteRules();
  const ruleIndex = rules.findIndex(r => r.id === ruleId);
  
  if (ruleIndex === -1) {
    return false;
  }
  
  const newIndex = ruleIndex + direction;
  
  if (newIndex < 0 || newIndex >= rules.length) {
    return false;
  }
  
  // Swap priorities
  const temp = rules[ruleIndex].priority;
  rules[ruleIndex].priority = rules[newIndex].priority;
  rules[newIndex].priority = temp;
  
  // Re-sort
  rules.sort((a, b) => a.priority - b.priority);
  
  await saveSiteRules(rules);
  renderSiteRules();
  
  return true;
}

// ============================================================================
// RULE APPLICATION
// ============================================================================

/**
 * Apply site rule for a URL
 * @param {string} url - URL to match
 * @returns {Promise<void>}
 */
export async function applySiteRule(url) {
  if (!url || getSiteRules().length === 0) {
    return;
  }
  
  const currentProxy = getCurrentProxy();
  if (!currentProxy) {
    return;
  }
  
  // Find first matching enabled rule (sorted by priority)
  const rules = getSiteRules().filter(r => r.enabled).sort((a, b) => a.priority - b.priority);
  const rule = rules.find(r => matchesPattern(r.url, url, r.patternType));
  
  if (!rule) {
    return;
  }
  
  // Check if current proxy matches the rule
  const matchingProxies = rule.proxyIps.filter(ip => ip === currentProxy.ipPort);
  
  if (matchingProxies.length === 0) {
    // Find a new proxy from the rule's country
    const proxies = getProxies();
    const newProxy = proxies.find(p => rule.proxyIps.includes(p.ipPort));
    
    if (newProxy) {
      showWarning(`Auto-switching to ${rule.country} proxy for ${url}`, () => {
        const { connectToProxy } = require('./connection.js');
        connectToProxy(newProxy);
      });
      
      await require('./connection.js').connectToProxy(newProxy);
    }
  }
}

/**
 * Apply rule for current tab
 * @returns {Promise<void>}
 */
export async function applyRuleForCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.url) {
      showWarning('No active tab found');
      return;
    }
    
    let hostname;
    try {
      hostname = new URL(tab.url).hostname;
    } catch (e) {
      showError('Invalid tab URL');
      return;
    }
    
    // Find matching rule
    const rules = getSiteRules().filter(r => r.enabled).sort((a, b) => a.priority - b.priority);
    const rule = rules.find(r => matchesPattern(r.url, hostname, r.patternType));
    
    if (!rule) {
      showWarning('No rule for this site. Create one in Settings.');
      return;
    }
    
    // Apply the rule's proxy
    const proxies = getProxies();
    const proxy = proxies.find(p => rule.proxyIps.includes(p.ipPort));
    
    if (!proxy) {
      showWarning('No available proxies for ' + rule.country);
      return;
    }
    
    const { connectToProxy } = require('./connection.js');
    await connectToProxy(proxy);
    
    showSuccess(`Applied ${rule.country} proxy for ${hostname}`);
    
  } catch (error) {
    console.error('Error applying rule:', error);
    showError('Failed to apply rule: ' + error.message);
  }
}

// ============================================================================
// UI MANAGEMENT
// ============================================================================

/**
 * Render site rules list
 */
export function renderSiteRules() {
  const container = document.getElementById('siteRulesList');
  if (!container) return;
  
  const rules = getSiteRules();
  
  // Sort by priority
  rules.sort((a, b) => a.priority - b.priority);
  
  if (rules.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No rules yet. Click "Manage Rules" to add one.</p>';
    return;
  }
  
  container.innerHTML = rules.map((rule, index) => `
    <div class="site-rule-item" data-id="${rule.id}">
      <div class="rule-priority-controls">
        <button class="priority-btn priority-up-btn" data-id="${rule.id}" ${index === 0 ? 'disabled' : ''}>▲</button>
        <span class="rule-priority">#${index + 1}</span>
        <button class="priority-btn priority-down-btn" data-id="${rule.id}" ${index === rules.length - 1 ? 'disabled' : ''}>▼</button>
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
  
  // Attach event listeners
  container.querySelectorAll('.delete-rule-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const ruleId = parseInt(btn.dataset.id);
      removeSiteRule(ruleId);
    });
  });
  
  container.querySelectorAll('.rule-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      const ruleId = parseInt(toggle.dataset.id);
      toggleSiteRule(ruleId);
    });
  });
  
  container.querySelectorAll('.priority-up-btn, .priority-down-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const ruleId = parseInt(btn.dataset.id);
      const direction = btn.classList.contains('priority-up-btn') ? -1 : 1;
      updateRulePriority(ruleId, direction);
    });
  });
}

/**
 * Show add site rule dialog
 */
export function showAddSiteRuleDialog() {
  const dialog = document.createElement('div');
  dialog.className = 'rule-dialog';
  dialog.innerHTML = `
    <div class="rule-dialog-content">
      <h3>Add Site Rule</h3>
      <div class="rule-input-group">
        <label>Website URL (e.g., netflix.com)</label>
        <input type="text" id="ruleUrl" placeholder="netflix.com or *.netflix.com" />
      </div>
      <div class="rule-input-group">
        <label>Pattern Type</label>
        <select id="rulePatternType">
          <option value="exact">Exact Match (netflix.com)</option>
          <option value="wildcard">Wildcard (*.netflix.com)</option>
          <option value="contains">Contains (*netflix*)</option>
          <option value="regex">Regex Pattern</option>
        </select>
      </div>
      <div class="rule-input-group">
        <label>Priority (1 = highest)</label>
        <input type="number" id="rulePriority" min="1" max="999" value="100" />
      </div>
      <div class="rule-input-group">
        <label>Proxy Country</label>
        <select id="ruleCountry">
          ${getCountryOptions()}
        </select>
      </div>
      <div class="rule-actions">
        <button class="btn btn-primary" id="saveRuleBtn">Save</button>
        <button class="btn btn-secondary" id="cancelRuleBtn">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  document.getElementById('saveRuleBtn')?.addEventListener('click', async () => {
    const url = document.getElementById('ruleUrl')?.value?.trim();
    const patternType = document.getElementById('rulePatternType')?.value || 'exact';
    const priority = parseInt(document.getElementById('rulePriority')?.value) || 100;
    const country = document.getElementById('ruleCountry')?.value;
    
    if (!url || !country) {
      showWarning('Please fill all fields');
      return;
    }
    
    await addSiteRule({ url, patternType, priority, country });
    dialog.remove();
  });
  
  document.getElementById('cancelRuleBtn')?.addEventListener('click', () => dialog.remove());
}

/**
 * Handle site rule action from events
 * @param {Event} e - Click event
 */
export function handleSiteRuleAction(e) {
  const deleteBtn = e.target.closest('.delete-rule-btn');
  const toggleBtn = e.target.closest('.rule-toggle');
  
  if (deleteBtn) {
    const ruleId = parseInt(deleteBtn.dataset.id);
    removeSiteRule(ruleId);
  }
  
  if (toggleBtn) {
    const ruleId = parseInt(toggleBtn.dataset.id);
    toggleSiteRule(ruleId);
  }
  
  const priorityBtn = e.target.closest('.priority-up-btn, .priority-down-btn');
  if (priorityBtn) {
    const ruleId = parseInt(priorityBtn.dataset.id);
    const direction = priorityBtn.classList.contains('priority-up-btn') ? -1 : 1;
    updateRulePriority(ruleId, direction);
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get country options for dropdown
 * @returns {string} - HTML options
 */
function getCountryOptions() {
  const { getProxies } = require('./state.js');
  const { getFlag } = require('./utils.js');
  
  const proxies = getProxies();
  const countries = [...new Set(proxies.map(p => p.country))].sort();
  
  return countries.map(country => 
    `<option value="${country}">${getFlag(country)} ${country}</option>`
  ).join('');
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

/**
 * Get flag emoji
 * @param {string} country - Country name
 * @returns {string} - Flag emoji
 */
function getFlag(country) {
  const { countryFlags } = require('./state.js');
  if (!country) return '🌍';
  return countryFlags[country] || countryFlags[country.split(' ')[0]] || '🌍';
}

// Helper for require
function require(module) {
  console.warn(`Dynamic import not implemented: ${module}`);
  return {};
}
