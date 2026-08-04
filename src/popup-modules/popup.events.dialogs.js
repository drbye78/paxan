// PeasyProxy - Dialog & Bulk Action Functions
// Extracted from popup.events.js — self-contained functions that create dialogs
// and handle bulk operations on proxies.

import { escapeHtml } from '../shared/utils.js';

import {
  getSettings,
  setSettings,
  getProxies,
  setProxies,
  getProxyStats,
  getSiteRules,
  setSiteRules,
} from './popup.state.js';

import {
  showToast,
  renderSiteRules,
  renderBlacklistChips,
  getFlag,
} from './popup.ui.js';

import {
  loadProxies,
  updateSelectionState,
} from './popup.proxy-list.js';

// ============================================================================
// Import / Export
// ============================================================================

function importProxies() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      if (Array.isArray(imported)) {
        const validProxies = imported.filter(p =>
          p && typeof p === 'object' &&
          typeof p.ip === 'string' && p.ip.trim() &&
          typeof p.port === 'number' && p.port > 0 && p.port <= 65535
        );
        if (validProxies.length === 0) {
          showToast('No valid proxies found in file', 'warning');
          return;
        }
        const currentProxies = getProxies();
        setProxies([...currentProxies, ...validProxies]);
        await chrome.storage.local.set({ proxies: getProxies() });
        showToast(`Imported ${validProxies.length} proxies`, 'success');
        loadProxies();
      }
    } catch {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      const imported = lines.map(line => {
        const [ip, portStr] = line.split(':');
        const port = parseInt(portStr, 10);
        if (!ip || !portStr || isNaN(port) || port <= 0 || port > 65535) return null;
        return { ip: ip.trim(), port, ipPort: `${ip.trim()}:${port}`, country: 'Unknown', type: 'HTTPS', speedMs: 9999 };
      }).filter(p => p !== null);
      if (imported.length === 0) {
        showToast('No valid proxies found in file', 'warning');
        return;
      }
      const currentProxies = getProxies();
      setProxies([...currentProxies, ...imported]);
      await chrome.storage.local.set({ proxies: getProxies() });
      showToast(`Imported ${imported.length} proxies`, 'success');
      loadProxies();
    }
  };
  input.click();
}

function exportProxies() {
  const currentProxies = getProxies();
  const proxyStats = getProxyStats();
  const working = currentProxies.filter(p => {
    const stats = proxyStats[p.ipPort];
    return stats && stats.successRate > 50;
  });
  const data = JSON.stringify(working, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `proxies-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${working.length} proxies`, 'success');
}

async function clearAllData() {
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.innerHTML = `
    <div class="confirm-dialog-content">
      <h3>Clear All Data</h3>
      <p>Clear all extension data? This cannot be undone.</p>
      <div class="confirm-dialog-actions">
        <button class="btn btn-secondary" id="confirmCancel">Cancel</button>
        <button class="btn btn-danger" id="confirmClear">Clear All</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  return new Promise((resolve) => {
    document.getElementById('confirmCancel').addEventListener('click', () => {
      dialog.remove();
      resolve(false);
    });
    document.getElementById('confirmClear').addEventListener('click', async () => {
      dialog.remove();
      await chrome.storage.local.clear();
      location.reload();
      resolve(true);
    });
  });
}

// ============================================================================
// Site Rules
// ============================================================================

function showAddSiteRuleDialog() {
  const currentProxies = getProxies();
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
          ${[...new Set(currentProxies.map(p => p.country))].sort().map(c =>
            `<option value="${escapeHtml(c)}">${getFlag(c)} ${escapeHtml(c)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="rule-actions">
        <button class="btn btn-primary" id="saveRuleBtn">Save</button>
        <button class="btn btn-secondary" id="cancelRuleBtn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const saveRuleBtn = document.getElementById('saveRuleBtn');
  const cancelRuleBtn = document.getElementById('cancelRuleBtn');
  const ruleUrl = document.getElementById('ruleUrl');
  const rulePatternType = document.getElementById('rulePatternType');
  const rulePriority = document.getElementById('rulePriority');
  const ruleCountry = document.getElementById('ruleCountry');

  if (saveRuleBtn) {
    saveRuleBtn.addEventListener('click', async () => {
      const url = ruleUrl?.value?.trim();
      const patternType = rulePatternType?.value || 'exact';
      const priority = parseInt(rulePriority?.value) || 100;
      const country = ruleCountry?.value;

      if (!url || !country) {
        showToast('Please fill all fields', 'warning');
        return;
      }

      const countryProxies = currentProxies.filter(p => p.country === country);
      if (countryProxies.length === 0) {
        showToast('No proxies available for ' + country, 'warning');
        return;
      }

      const siteRules = getSiteRules();
      siteRules.push({
        id: Date.now(),
        url,
        patternType,
        priority,
        country,
        proxyIps: countryProxies.map(p => p.ipPort),
        enabled: true
      });

      siteRules.sort((a, b) => a.priority - b.priority);
      setSiteRules(siteRules);
      await chrome.storage.local.set({ siteRules });
      renderSiteRules();
      dialog.remove();
      showToast('Rule added', 'success');
    });
  }

  if (cancelRuleBtn) {
    cancelRuleBtn.addEventListener('click', () => dialog.remove());
  }
}

function handleSiteRuleAction(e) {
  const siteRules = getSiteRules();
  const deleteBtn = e.target.closest('.delete-rule-btn');
  const toggleBtn = e.target.closest('.rule-toggle');

  if (deleteBtn) {
    const ruleId = parseInt(deleteBtn.dataset.id);
    const filtered = siteRules.filter(r => r.id !== ruleId);
    setSiteRules(filtered);
    chrome.storage.local.set({ siteRules: filtered });
    renderSiteRules();
    showToast('Rule deleted', 'info');
  }

  if (toggleBtn) {
    const ruleId = parseInt(toggleBtn.dataset.id);
    const rule = siteRules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = !rule.enabled;
      chrome.storage.local.set({ siteRules });
      renderSiteRules();
      showToast(`Rule ${rule.enabled ? 'enabled' : 'disabled'}`, 'info');
    }
  }

  const priorityBtn = e.target.closest('.priority-up-btn, .priority-down-btn');
  if (priorityBtn) {
    const ruleId = parseInt(priorityBtn.dataset.id);
    const ruleIndex = siteRules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return;

    const direction = priorityBtn.classList.contains('priority-up-btn') ? -1 : 1;
    const newIndex = ruleIndex + direction;

    if (newIndex >= 0 && newIndex < siteRules.length) {
      const temp = siteRules[ruleIndex].priority;
      siteRules[ruleIndex].priority = siteRules[newIndex].priority;
      siteRules[newIndex].priority = temp;

      siteRules.sort((a, b) => a.priority - b.priority);
      setSiteRules(siteRules);
      chrome.storage.local.set({ siteRules });
      renderSiteRules();
    }
  }
}

// ============================================================================
// Bulk Actions
// ============================================================================

async function deleteSelectedProxies() {
  // Note: We can't actually delete proxies from the source, but we can blacklist them
  const selectedCheckboxes = document.querySelectorAll('.proxy-select-checkbox:checked');
  if (selectedCheckboxes.length === 0) return;

  const settings = getSettings();
  const countryBlacklist = settings.countryBlacklist || [];

  // Get selected proxy countries
  const selectedCountries = Array.from(selectedCheckboxes)
    .map(checkbox => {
      const item = checkbox.closest('.proxy-item');
      return item ? item.querySelector('.proxy-details span').textContent.trim() : null;
    })
    .filter(country => country !== null);

  // Add to blacklist
  const newBlacklist = [...new Set([...countryBlacklist, ...selectedCountries])];
  settings.countryBlacklist = newBlacklist;

  try {
    await chrome.storage.local.set({ settings });
    await loadProxies(true); // Reload proxies with new blacklist
    showToast(`Added ${selectedCountries.length} countries to blacklist`, 'info');
  } catch (error) {
    console.error('Error updating blacklist:', error);
    showToast('Failed to update blacklist', 'error');
  }

  // Clear selection
  updateSelectionState();
}

async function exportSelectedProxies() {
  const selectedCheckboxes = document.querySelectorAll('.proxy-select-checkbox:checked');
  if (selectedCheckboxes.length === 0) return;

  // Get selected proxy data
  const selectedProxies = Array.from(selectedCheckboxes)
    .map(checkbox => {
      const item = checkbox.closest('.proxy-item');
      if (!item) return null;

      const flagEl = item.querySelector('.proxy-flag');
      const ipPortEl = item.querySelector('.proxy-ip span:nth-child(2)');
      const countryEl = item.querySelector('.proxy-details span');
      const typeEl = item.querySelector('.proxy-type');
      const speedEl = item.querySelector('.proxy-speed');

      return {
        ipPort: ipPortEl ? ipPortEl.textContent : '',
        country: countryEl ? countryEl.textContent : '',
        type: typeEl ? typeEl.textContent : '',
        speed: speedEl ? speedEl.textContent.replace('⚡ ', '') : '',
        flag: flagEl ? flagEl.textContent : ''
      };
    })
    .filter(proxy => proxy !== null);

  if (selectedProxies.length === 0) {
    showToast('No valid proxies selected', 'warning');
    return;
  }

  // Create CSV content
  const csvHeaders = ['Flag', 'Country', 'Type', 'IP:Port', 'Speed (ms)'];
  const csvRows = selectedProxies.map(proxy => [
    proxy.flag,
    proxy.country,
    proxy.type,
    proxy.ipPort,
    proxy.speed
  ]);

  const csvContent = [
    csvHeaders.join(','),
    ...csvRows.map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const filename = `peasyproxy_selected_proxies_${new Date().toISOString().slice(0,10)}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`Exported ${selectedProxies.length} proxies to ${filename}`, 'success');
}

function toggleSelectAll(e) {
  const isChecked = e.target.checked;
  const checkboxes = document.querySelectorAll('.proxy-select-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = isChecked;
    const item = checkbox.closest('.proxy-item');
    if (item) {
      item.classList.toggle('selected', isChecked);
    }
  });
  updateSelectionState();
}

function toggleBlacklistPanel() {
  const blacklistContainer = document.getElementById('blacklistContainer');
  if (!blacklistContainer) return;

  const isVisible = blacklistContainer.style.display !== 'none';
  blacklistContainer.style.display = isVisible ? 'none' : 'block';

  if (!isVisible) {
    renderBlacklistChips();
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  importProxies,
  exportProxies,
  clearAllData,
  showAddSiteRuleDialog,
  handleSiteRuleAction,
  deleteSelectedProxies,
  exportSelectedProxies,
  toggleSelectAll,
  toggleBlacklistPanel,
};
