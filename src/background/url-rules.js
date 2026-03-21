// PeasyProxy - URL Rules Module
// Implements proxy whitelist/blacklist by URL patterns

const { THRESHOLDS } = require('../popup/constants.js');

// ============================================================================
// RULE TYPES
// ============================================================================

const RULE_TYPES = {
  EXACT: 'exact',
  WILDCARD: 'wildcard',
  REGEX: 'regex',
  DOMAIN: 'domain'
};

const RULE_ACTIONS = {
  WHITELIST: 'whitelist',
  BLACKLIST: 'blacklist',
  BLOCK: 'block',
  PROXY: 'proxy'
};

// ============================================================================
// URL RULE ENGINE
// ============================================================================

// Match URL against rule pattern
function matchUrl(url, pattern, ruleType) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    const fullUrl = url;
    
    switch (ruleType) {
      case RULE_TYPES.EXACT:
        return fullUrl === pattern || hostname === pattern;
      
      case RULE_TYPES.DOMAIN:
        return hostname === pattern || hostname.endsWith('.' + pattern);
      
      case RULE_TYPES.WILDCARD:
        return matchWildcard(fullUrl, pattern) || matchWildcard(hostname, pattern);
      
      case RULE_TYPES.REGEX:
        return matchRegex(fullUrl, pattern);
      
      default:
        return hostname === pattern;
    }
  } catch (error) {
    console.error('URL matching error:', error);
    return false;
  }
}

// Wildcard matching
function matchWildcard(str, pattern) {
  if (!str || !pattern) return false;
  
  // Convert wildcard pattern to regex
  let regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  regex = `^${regex}$`;
  
  try {
    return new RegExp(regex, 'i').test(str);
  } catch {
    return false;
  }
}

// Regex matching
function matchRegex(str, pattern) {
  try {
    return new RegExp(pattern, 'i').test(str);
  } catch {
    return false;
  }
}

// ============================================================================
// RULE MANAGER
// ============================================================================

const RULES_KEY = 'urlRules';

// Add URL rule
async function addUrlRule(rule) {
  try {
    const { urlRules = [] } = await chrome.storage.local.get([RULES_KEY]);
    
    // Validate rule
    if (!rule.pattern || !rule.action) {
      return {
        success: false,
        error: 'Rule must have pattern and action'
      };
    }

    // Check for duplicate
    const existing = urlRules.find(r => 
      r.pattern === rule.pattern && 
      r.type === (rule.type || RULE_TYPES.EXACT)
    );
    
    if (existing) {
      return {
        success: false,
        error: 'Rule already exists'
      };
    }

    const newRule = {
      id: `rule-${Date.now()}`,
      pattern: rule.pattern,
      type: rule.type || RULE_TYPES.EXACT,
      action: rule.action,
      proxyIpPort: rule.proxyIpPort || null,
      priority: rule.priority || 999,
      enabled: rule.enabled !== false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    urlRules.push(newRule);
    
    // Sort by priority
    urlRules.sort((a, b) => a.priority - b.priority);
    
    await chrome.storage.local.set({ urlRules });

    return {
      success: true,
      rule: newRule,
      message: 'URL rule added'
    };
  } catch (error) {
    console.error('Failed to add URL rule:', error);
    return { success: false, error: error.message };
  }
}

// Get URL rule by ID
async function getUrlRule(ruleId) {
  try {
    const { urlRules = [] } = await chrome.storage.local.get([RULES_KEY]);
    
    const rule = urlRules.find(r => r.id === ruleId);
    if (!rule) {
      return {
        success: false,
        error: 'Rule not found'
      };
    }

    return {
      success: true,
      rule
    };
  } catch (error) {
    console.error('Failed to get URL rule:', error);
    return { success: false, error: error.message };
  }
}

// List all URL rules
async function listUrlRules() {
  try {
    const { urlRules = [] } = await chrome.storage.local.get([RULES_KEY]);
    
    return {
      success: true,
      rules: urlRules
    };
  } catch (error) {
    console.error('Failed to list URL rules:', error);
    return { success: false, error: error.message, rules: [] };
  }
}

// Update URL rule
async function updateUrlRule(ruleId, updates) {
  try {
    const { urlRules = [] } = await chrome.storage.local.get([RULES_KEY]);
    
    const index = urlRules.findIndex(r => r.id === ruleId);
    if (index === -1) {
      return {
        success: false,
        error: 'Rule not found'
      };
    }

    urlRules[index] = {
      ...urlRules[index],
      ...updates,
      updatedAt: Date.now()
    };

    // Re-sort if priority changed
    if (updates.priority !== undefined) {
      urlRules.sort((a, b) => a.priority - b.priority);
    }

    await chrome.storage.local.set({ urlRules });

    return {
      success: true,
      rule: urlRules[index],
      message: 'URL rule updated'
    };
  } catch (error) {
    console.error('Failed to update URL rule:', error);
    return { success: false, error: error.message };
  }
}

// Delete URL rule
async function deleteUrlRule(ruleId) {
  try {
    const { urlRules = [] } = await chrome.storage.local.get([RULES_KEY]);
    
    const index = urlRules.findIndex(r => r.id === ruleId);
    if (index === -1) {
      return {
        success: false,
        error: 'Rule not found'
      };
    }

    urlRules.splice(index, 1);
    await chrome.storage.local.set({ urlRules });

    return {
      success: true,
      message: 'URL rule deleted'
    };
  } catch (error) {
    console.error('Failed to delete URL rule:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// RULE APPLICATION
// ============================================================================

// Apply rules to URL
async function applyRulesToUrl(url) {
  try {
    const { urlRules = [] } = await chrome.storage.local.get([RULES_KEY]);
    
    // Filter enabled rules
    const enabledRules = urlRules.filter(r => r.enabled !== false);
    
    // Find matching rule
    for (const rule of enabledRules) {
      if (matchUrl(url, rule.pattern, rule.type)) {
        return {
          success: true,
          matched: true,
          rule,
          action: rule.action,
          proxyIpPort: rule.proxyIpPort
        };
      }
    }
    
    return {
      success: true,
      matched: false,
      action: null
    };
  } catch (error) {
    console.error('Failed to apply rules:', error);
    return { success: false, error: error.message };
  }
}

// Get proxy for URL based on rules
async function getProxyForUrl(url) {
  try {
    const result = await applyRulesToUrl(url);
    
    if (!result.matched) {
      return {
        success: true,
        proxy: null,
        action: null
      };
    }

    // Handle different actions
    switch (result.action) {
      case RULE_ACTIONS.WHITELIST:
      case RULE_ACTIONS.PROXY:
        return {
          success: true,
          proxy: result.proxyIpPort,
          action: result.action,
          rule: result.rule
        };
      
      case RULE_ACTIONS.BLACKLIST:
      case RULE_ACTIONS.BLOCK:
        return {
          success: true,
          proxy: null,
          action: result.action,
          rule: result.rule,
          blocked: true
        };
      
      default:
        return {
          success: true,
          proxy: result.proxyIpPort,
          action: result.action
        };
    }
  } catch (error) {
    console.error('Failed to get proxy for URL:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// RULE TESTING
// ============================================================================

// Test URL against rules
async function testUrlAgainstRules(url) {
  try {
    const { urlRules = [] } = await chrome.storage.local.get([RULES_KEY]);
    
    const matches = [];
    
    for (const rule of urlRules) {
      if (matchUrl(url, rule.pattern, rule.type)) {
        matches.push({
          rule,
          pattern: rule.pattern,
          type: rule.type,
          action: rule.action,
          enabled: rule.enabled
        });
      }
    }
    
    return {
      success: true,
      url,
      matches,
      matchedCount: matches.length
    };
  } catch (error) {
    console.error('Failed to test URL against rules:', error);
    return { success: false, error: error.message };
  }
}

// Test pattern matching
function testPattern(pattern, ruleType, testUrl) {
  return matchUrl(testUrl, pattern, ruleType);
}

// ============================================================================
// RULE IMPORT/EXPORT
// ============================================================================

// Export rules
async function exportRules() {
  try {
    const { urlRules = [] } = await chrome.storage.local.get([RULES_KEY]);
    
    return {
      success: true,
      rules: urlRules,
      exportedAt: Date.now()
    };
  } catch (error) {
    console.error('Failed to export rules:', error);
    return { success: false, error: error.message };
  }
}

// Import rules
async function importRules(rules, options = {}) {
  try {
    const { urlRules = [] } = await chrome.storage.local.get([RULES_KEY]);
    
    const merge = options.merge !== false;
    let importedCount = 0;
    
    if (merge) {
      // Merge with existing rules
      for (const rule of rules) {
        const exists = urlRules.some(r => 
          r.pattern === rule.pattern && r.type === rule.type
        );
        
        if (!exists) {
          urlRules.push({
            ...rule,
            id: rule.id || `rule-${Date.now()}-${importedCount}`,
            createdAt: rule.createdAt || Date.now(),
            updatedAt: Date.now()
          });
          importedCount++;
        }
      }
    } else {
      // Replace all rules
      urlRules.length = 0;
      rules.forEach((rule, index) => {
        urlRules.push({
          ...rule,
          id: rule.id || `rule-${Date.now()}-${index}`,
          createdAt: rule.createdAt || Date.now(),
          updatedAt: Date.now()
        });
      });
      importedCount = rules.length;
    }
    
    // Sort by priority
    urlRules.sort((a, b) => a.priority - b.priority);
    
    await chrome.storage.local.set({ urlRules });
    
    return {
      success: true,
      importedCount,
      totalRules: urlRules.length,
      message: `Imported ${importedCount} rules`
    };
  } catch (error) {
    console.error('Failed to import rules:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// RULE STATISTICS
// ============================================================================

// Get rule statistics
async function getRuleStats() {
  try {
    const { urlRules = [] } = await chrome.storage.local.get([RULES_KEY]);
    
    const stats = {
      total: urlRules.length,
      enabled: urlRules.filter(r => r.enabled !== false).length,
      disabled: urlRules.filter(r => r.enabled === false).length,
      byType: {},
      byAction: {}
    };
    
    // Count by type
    Object.values(RULE_TYPES).forEach(type => {
      stats.byType[type] = urlRules.filter(r => r.type === type).length;
    });
    
    // Count by action
    Object.values(RULE_ACTIONS).forEach(action => {
      stats.byAction[action] = urlRules.filter(r => r.action === action).length;
    });
    
    return {
      success: true,
      stats
    };
  } catch (error) {
    console.error('Failed to get rule stats:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Constants
  RULE_TYPES,
  RULE_ACTIONS,
  
  // Matching
  matchUrl,
  matchWildcard,
  matchRegex,
  
  // Rule manager
  addUrlRule,
  getUrlRule,
  listUrlRules,
  updateUrlRule,
  deleteUrlRule,
  
  // Rule application
  applyRulesToUrl,
  getProxyForUrl,
  
  // Testing
  testUrlAgainstRules,
  testPattern,
  
  // Import/Export
  exportRules,
  importRules,
  
  // Statistics
  getRuleStats
};