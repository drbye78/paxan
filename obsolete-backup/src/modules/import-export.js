// ProxyMania VPN - Import/Export Module
// Data import/export and cleanup

import { showToast, showSuccess, showError } from './toast.js';
import { clearAllData as clearStorage } from './storage.js';
import { loadProxies } from './proxy-list.js';

const ALLOWED_SETTINGS_KEYS = [
  'theme', 'language', 'autoFailover', 'testBeforeConnect', 'autoConnect',
  'notifications', 'refreshInterval', 'proxySource', 'countryBlacklist',
  'autoRotation', 'siteRules', 'dnsLeakProtection', 'webRtcProtection'
];

const ALLOWED_SETTINGS_VALUES = {
  theme: ['dark', 'light'],
  language: ['en', 'ru', 'es', 'de', 'fr'],
  autoFailover: [true, false],
  testBeforeConnect: [true, false],
  autoConnect: [true, false],
  notifications: [true, false],
  proxySource: ['proxymania', 'proxyscrape'],
  dnsLeakProtection: [true, false],
  webRtcProtection: [true, false]
};

function validateSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    throw new Error('Invalid settings format');
  }
  
  for (const [key, value] of Object.entries(settings)) {
    if (!ALLOWED_SETTINGS_KEYS.includes(key)) {
      throw new Error(`Unknown setting: ${key}`);
    }
    
    if (key in ALLOWED_SETTINGS_VALUES) {
      if (!ALLOWED_SETTINGS_VALUES[key].includes(value)) {
        throw new Error(`Invalid value for ${key}: ${value}`);
      }
    }
    
    if (key === 'refreshInterval' && (typeof value !== 'number' || value < 60000)) {
      throw new Error('refreshInterval must be >= 60000');
    }
    
    if (key === 'countryBlacklist' && !Array.isArray(value)) {
      throw new Error('countryBlacklist must be an array');
    }
  }
  
  return true;
}

// ============================================================================
// IMPORT
// ============================================================================

/**
 * Import proxies from file
 */
export function importProxies() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.txt';
  
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      let proxies;
      
      if (file.name.endsWith('.json')) {
        proxies = JSON.parse(text);
      } else {
        proxies = parseTextProxies(text);
      }
      
      if (!Array.isArray(proxies)) {
        throw new Error('Invalid file format');
      }
      
      // Send to background to import
      await chrome.runtime.sendMessage({
        action: 'importProxies',
        proxies
      });
      
      showSuccess(`Imported ${proxies.length} proxies`);
      
      loadProxies(true);
      
    } catch (error) {
      showError('Failed to import: ' + error.message);
    }
  });
  
  input.click();
}

/**
 * Parse text format proxies
 * @param {string} text - Text content
 * @returns {Array} - Proxy array
 */
function parseTextProxies(text) {
  const lines = text.split('\n');
  const proxies = [];
  
  lines.forEach(line => {
    const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+):(\w+):([\w-]+)/);
    if (match) {
      proxies.push({
        ip: match[1],
        port: parseInt(match[2]),
        type: match[3].toUpperCase(),
        country: match[4],
        ipPort: `${match[1]}:${match[2]}`
      });
    }
  });
  
  return proxies;
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Export proxies to file
 */
export function exportProxies() {
  chrome.runtime.sendMessage({ action: 'getProxies' })
    .then(result => {
      const proxies = result?.proxies || [];
      
      if (proxies.length === 0) {
        showError('No proxies to export');
        return;
      }
      
      // Export as JSON
      const dataStr = JSON.stringify(proxies, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proxymania-proxies-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      showSuccess(`Exported ${proxies.length} proxies`);
    })
    .catch(error => {
      showError('Failed to export: ' + error.message);
    });
}

/**
 * Export proxies as text
 */
export function exportProxiesAsText() {
  chrome.runtime.sendMessage({ action: 'getProxies' })
    .then(result => {
      const proxies = result?.proxies || [];
      
      if (proxies.length === 0) {
        showError('No proxies to export');
        return;
      }
      
      // Export as text (IP:PORT:TYPE:COUNTRY)
      const text = proxies.map(p => 
        `${p.ip}:${p.port}:${p.type.toLowerCase()}:${p.country}`
      ).join('\n');
      
      const dataBlob = new Blob([text], { type: 'text/plain' });
      
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proxymania-proxies-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      showSuccess(`Exported ${proxies.length} proxies`);
    })
    .catch(error => {
      showError('Failed to export: ' + error.message);
    });
}

// ============================================================================
// CLEAR DATA
// ============================================================================

/**
 * Clear all extension data
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  try {
    await clearStorage();
    
    // Clear Chrome proxy settings
    await chrome.proxy.settings.clear({ scope: 'regular' });
    
    showSuccess('All data cleared');
    
    // Reload extension
    setTimeout(() => {
      location.reload();
    }, 1000);
    
  } catch (error) {
    showError('Failed to clear data: ' + error.message);
  }
}

// ============================================================================
// IMPORT/EXPORT SETTINGS
// ============================================================================

/**
 * Export settings to file
 */
export function exportSettings() {
  chrome.storage.local.get(['settings'])
    .then(result => {
      const settings = result.settings || {};
      
      const dataStr = JSON.stringify(settings, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proxymania-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      showSuccess('Settings exported');
    })
    .catch(error => {
      showError('Failed to export settings: ' + error.message);
    });
}

/**
 * Import settings from file
 */
export function importSettings() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const settings = JSON.parse(text);
      
      validateSettings(settings);
      
      await chrome.storage.local.set({ settings });
      
      showSuccess('Settings imported');
      
      // Reload to apply settings
      setTimeout(() => {
        location.reload();
      }, 1000);
      
    } catch (error) {
      showError('Failed to import settings: ' + error.message);
    }
  });
  
  input.click();
}
