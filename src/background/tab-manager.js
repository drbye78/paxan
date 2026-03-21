// PeasyProxy - Tab Manager Module
// Implements per-tab proxy settings and domain-based rules

const { THRESHOLDS } = require('../popup/constants.js');

// ============================================================================
// TAB TRACKING
// ============================================================================

let activeTabs = new Map();
let tabProxyMappings = new Map();

// Initialize tab tracking
async function initTabTracking() {
  try {
    // Load existing mappings
    const { tabProxies = {} } = await chrome.storage.local.get(['tabProxies']);
    tabProxyMappings = new Map(Object.entries(tabProxies));
    
    // Get current tabs
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      activeTabs.set(tab.id, {
        id: tab.id,
        url: tab.url,
        hostname: getHostname(tab.url),
        title: tab.title,
        active: tab.active
      });
    });
    
    console.log(`Tab tracking initialized: ${activeTabs.size} tabs`);
    return { success: true, tabCount: activeTabs.size };
  } catch (error) {
    console.error('Failed to initialize tab tracking:', error);
    return { success: false, error: error.message };
  }
}

// Get hostname from URL
function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// ============================================================================
// TAB EVENTS
// ============================================================================

// Handle tab creation
function onTabCreated(tab) {
  activeTabs.set(tab.id, {
    id: tab.id,
    url: tab.url,
    hostname: getHostname(tab.url),
    title: tab.title,
    active: tab.active
  });
  
  // Check for domain rules
  applyDomainRule(tab.id, tab.url);
}

// Handle tab removal
function onTabRemoved(tabId) {
  activeTabs.delete(tabId);
  tabProxyMappings.delete(tabId.toString());
  saveTabMappings();
}

// Handle tab update (URL change)
function onTabUpdated(tabId, changeInfo, tab) {
  if (changeInfo.url) {
    const tabInfo = activeTabs.get(tabId) || {};
    tabInfo.url = changeInfo.url;
    tabInfo.hostname = getHostname(changeInfo.url);
    activeTabs.set(tabId, tabInfo);
    
    // Check for domain rules
    applyDomainRule(tabId, changeInfo.url);
  }
  
  if (changeInfo.title) {
    const tabInfo = activeTabs.get(tabId) || {};
    tabInfo.title = changeInfo.title;
    activeTabs.set(tabId, tabInfo);
  }
}

// Handle tab activation
function onTabActivated(activeInfo) {
  const tabId = activeInfo.tabId;
  const tabInfo = activeTabs.get(tabId);
  
  if (tabInfo) {
    tabInfo.active = true;
    activeTabs.set(tabId, tabInfo);
  }
}

// ============================================================================
// TAB PROXY MAPPINGS
// ============================================================================

// Assign proxy to tab
async function assignProxyToTab(tabId, proxyIpPort) {
  try {
    const tabIdStr = tabId.toString();
    tabProxyMappings.set(tabIdStr, {
      proxyIpPort,
      assignedAt: Date.now()
    });
    
    await saveTabMappings();
    
    return {
      success: true,
      message: `Proxy assigned to tab ${tabId}`
    };
  } catch (error) {
    console.error('Failed to assign proxy to tab:', error);
    return { success: false, error: error.message };
  }
}

// Remove proxy from tab
async function removeProxyFromTab(tabId) {
  try {
    const tabIdStr = tabId.toString();
    tabProxyMappings.delete(tabIdStr);
    
    await saveTabMappings();
    
    return {
      success: true,
      message: `Proxy removed from tab ${tabId}`
    };
  } catch (error) {
    console.error('Failed to remove proxy from tab:', error);
    return { success: false, error: error.message };
  }
}

// Get proxy for tab
function getProxyForTab(tabId) {
  const tabIdStr = tabId.toString();
  return tabProxyMappings.get(tabIdStr) || null;
}

// Get all tab proxy mappings
function getAllTabMappings() {
  return Object.fromEntries(tabProxyMappings);
}

// Save tab mappings to storage
async function saveTabMappings() {
  try {
    const mappings = Object.fromEntries(tabProxyMappings);
    await chrome.storage.local.set({ tabProxies: mappings });
    return { success: true };
  } catch (error) {
    console.error('Failed to save tab mappings:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DOMAIN RULES
// ============================================================================

// Apply domain-based rule
async function applyDomainRule(tabId, url) {
  try {
    const hostname = getHostname(url);
    if (!hostname) return;
    
    const { domainRules = {} } = await chrome.storage.local.get(['domainRules']);
    
    // Find matching rule
    const matchingRule = findMatchingRule(hostname, domainRules);
    
    if (matchingRule) {
      // Apply proxy from rule
      await assignProxyToTab(tabId, matchingRule.proxyIpPort);
      
      console.log(`Applied domain rule for ${hostname}: ${matchingRule.proxyIpPort}`);
      
      // Notify popup
      chrome.runtime.sendMessage({
        action: 'domainRuleApplied',
        tabId,
        hostname,
        rule: matchingRule
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Failed to apply domain rule:', error);
  }
}

// Find matching domain rule
function findMatchingRule(hostname, domainRules) {
  // Sort rules by priority
  const sortedRules = Object.entries(domainRules)
    .filter(([_, rule]) => rule.enabled !== false)
    .sort((a, b) => (a[1].priority || 999) - (b[1].priority || 999));
  
  for (const [domain, rule] of sortedRules) {
    if (matchDomain(hostname, domain, rule.patternType || 'exact')) {
      return { domain, ...rule };
    }
  }
  
  return null;
}

// Match domain based on pattern type
function matchDomain(hostname, pattern, patternType) {
  switch (patternType) {
    case 'exact':
      return hostname === pattern;
    
    case 'wildcard':
      if (pattern.startsWith('*.')) {
        const domain = pattern.slice(2);
        return hostname === domain || hostname.endsWith('.' + domain);
      }
      if (pattern.startsWith('*') && pattern.endsWith('*')) {
        return hostname.includes(pattern.slice(1, -1));
      }
      return hostname.endsWith(pattern);
    
    case 'contains':
      return hostname.includes(pattern);
    
    case 'regex':
      try {
        return new RegExp(pattern).test(hostname);
      } catch {
        return false;
      }
    
    default:
      return hostname === pattern;
  }
}

// ============================================================================
// DOMAIN RULE MANAGER
// ============================================================================

// Add domain rule
async function addDomainRule(domain, proxyIpPort, options = {}) {
  try {
    const { domainRules = {} } = await chrome.storage.local.get(['domainRules']);
    
    domainRules[domain] = {
      proxyIpPort,
      patternType: options.patternType || 'exact',
      priority: options.priority || 999,
      enabled: options.enabled !== false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    await chrome.storage.local.set({ domainRules });
    
    return {
      success: true,
      message: `Domain rule added for ${domain}`
    };
  } catch (error) {
    console.error('Failed to add domain rule:', error);
    return { success: false, error: error.message };
  }
}

// Update domain rule
async function updateDomainRule(domain, updates) {
  try {
    const { domainRules = {} } = await chrome.storage.local.get(['domainRules']);
    
    if (!domainRules[domain]) {
      return {
        success: false,
        error: `Rule for ${domain} not found`
      };
    }
    
    domainRules[domain] = {
      ...domainRules[domain],
      ...updates,
      updatedAt: Date.now()
    };
    
    await chrome.storage.local.set({ domainRules });
    
    return {
      success: true,
      message: `Domain rule updated for ${domain}`
    };
  } catch (error) {
    console.error('Failed to update domain rule:', error);
    return { success: false, error: error.message };
  }
}

// Delete domain rule
async function deleteDomainRule(domain) {
  try {
    const { domainRules = {} } = await chrome.storage.local.get(['domainRules']);
    
    if (!domainRules[domain]) {
      return {
        success: false,
        error: `Rule for ${domain} not found`
      };
    }
    
    delete domainRules[domain];
    await chrome.storage.local.set({ domainRules });
    
    return {
      success: true,
      message: `Domain rule deleted for ${domain}`
    };
  } catch (error) {
    console.error('Failed to delete domain rule:', error);
    return { success: false, error: error.message };
  }
}

// List domain rules
async function listDomainRules() {
  try {
    const { domainRules = {} } = await chrome.storage.local.get(['domainRules']);
    
    const rules = Object.entries(domainRules).map(([domain, rule]) => ({
      domain,
      proxyIpPort: rule.proxyIpPort,
      patternType: rule.patternType,
      priority: rule.priority,
      enabled: rule.enabled,
      createdAt: rule.createdAt
    }));
    
    return {
      success: true,
      rules: rules.sort((a, b) => a.priority - b.priority)
    };
  } catch (error) {
    console.error('Failed to list domain rules:', error);
    return { success: false, error: error.message, rules: [] };
  }
}

// ============================================================================
// TAB PROXY PERSISTENCE
// ============================================================================

// Export tab mappings
async function exportTabMappings() {
  try {
    const mappings = getAllTabMappings();
    const { domainRules = {} } = await chrome.storage.local.get(['domainRules']);
    
    return {
      success: true,
      data: {
        tabProxies: mappings,
        domainRules,
        exportedAt: Date.now()
      }
    };
  } catch (error) {
    console.error('Failed to export tab mappings:', error);
    return { success: false, error: error.message };
  }
}

// Import tab mappings
async function importTabMappings(data) {
  try {
    if (data.tabProxies) {
      tabProxyMappings = new Map(Object.entries(data.tabProxies));
      await saveTabMappings();
    }
    
    if (data.domainRules) {
      await chrome.storage.local.set({ domainRules: data.domainRules });
    }
    
    return {
      success: true,
      message: 'Tab mappings imported'
    };
  } catch (error) {
    console.error('Failed to import tab mappings:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// TAB INFORMATION
// ============================================================================

// Get tab info
function getTabInfo(tabId) {
  return activeTabs.get(tabId) || null;
}

// Get all active tabs
function getActiveTabs() {
  return Array.from(activeTabs.values());
}

// Get tabs by hostname
function getTabsByHostname(hostname) {
  return Array.from(activeTabs.values())
    .filter(tab => tab.hostname === hostname);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Initialization
  initTabTracking,
  
  // Tab events
  onTabCreated,
  onTabRemoved,
  onTabUpdated,
  onTabActivated,
  
  // Tab proxy mappings
  assignProxyToTab,
  removeProxyFromTab,
  getProxyForTab,
  getAllTabMappings,
  
  // Domain rules
  applyDomainRule,
  addDomainRule,
  updateDomainRule,
  deleteDomainRule,
  listDomainRules,
  
  // Persistence
  exportTabMappings,
  importTabMappings,
  
  // Tab information
  getTabInfo,
  getActiveTabs,
  getTabsByHostname
};