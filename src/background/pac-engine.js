// PeasyProxy - PAC Script Engine
// Implements PAC (Proxy Auto-Config) script parsing and execution

const { THRESHOLDS } = require('../popup/constants.js');

// ============================================================================
// PAC SCRIPT PARSER
// ============================================================================

// Parse PAC script content
function parsePacScript(scriptContent) {
  try {
    // Validate script has FindProxyForURL function
    if (!scriptContent.includes('FindProxyForURL')) {
      throw new Error('PAC script must contain FindProxyForURL function');
    }

    // Extract function body
    const functionMatch = scriptContent.match(
      /function\s+FindProxyForURL\s*\(\s*url\s*,\s*host\s*\)\s*\{([\s\S]*)\}/i
    );

    if (!functionMatch) {
      throw new Error('Invalid PAC script format');
    }

    return {
      success: true,
      functionBody: functionMatch[1],
      fullScript: scriptContent
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Validate PAC script syntax
function validatePacScript(scriptContent) {
  try {
    // Check for required function
    if (!scriptContent.includes('FindProxyForURL')) {
      return {
        valid: false,
        error: 'Missing FindProxyForURL function'
      };
    }

    // Check for dangerous functions
    const dangerousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /document\./i,
      /window\./i,
      /XMLHttpRequest/i,
      /fetch\s*\(/i,
      /WebSocket/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(scriptContent)) {
        return {
          valid: false,
          error: `PAC script contains forbidden function: ${pattern.source}`
        };
      }
    }

    // Check script length
    if (scriptContent.length > 100000) {
      return {
        valid: false,
        error: 'PAC script exceeds maximum length (100KB)'
      };
    }

    return {
      valid: true,
      message: 'PAC script is valid'
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

// ============================================================================
// PAC SCRIPT EXECUTION ENGINE
// ============================================================================

// PAC helper functions
const PAC_HELPERS = {
  // Check if host matches domain pattern
  shExpMatch: function(str, pattern) {
    if (!str || !pattern) return false;
    
    // Convert pattern to regex
    let regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    regex = `^${regex}$`;
    
    try {
      return new RegExp(regex, 'i').test(str);
    } catch (e) {
      return false;
    }
  },

  // Check if host is in domain
  dnsDomainIs: function(host, domain) {
    return host === domain || host.endsWith('.' + domain);
  },

  // Check if host is localhost
  isPlainHostName: function(host) {
    return !host.includes('.');
  },

  // Check if host is resolvable
  isResolvable: function(host) {
    // In browser context, assume all hosts are resolvable
    return true;
  },

  // Get host IP address
  dnsResolve: function(host) {
    // Cannot resolve DNS in browser context
    return null;
  },

  // Check if IP is in range
  isInNet: function(ip, pattern, mask) {
    // Simplified check - would need actual IP range calculation
    return false;
  },

  // Get local host IP
  myIpAddress: function() {
    return '127.0.0.1';
  },

  // Convert weekday to number
  weekdayRange: function() {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const today = days[new Date().getDay()];
    
    if (arguments.length === 1) {
      return today === arguments[0].toUpperCase();
    }
    
    let start = arguments[0].toUpperCase();
    let end = arguments[1].toUpperCase();
    
    let startIdx = days.indexOf(start);
    let endIdx = days.indexOf(end);
    let todayIdx = days.indexOf(today);
    
    if (startIdx <= endIdx) {
      return todayIdx >= startIdx && todayIdx <= endIdx;
    } else {
      return todayIdx >= startIdx || todayIdx <= endIdx;
    }
  },

  // Convert date range
  dateRange: function() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    
    if (arguments.length === 1) {
      return day === arguments[0];
    }
    
    if (arguments.length === 2) {
      // Day range
      if (typeof arguments[0] === 'number' && typeof arguments[1] === 'number') {
        return day >= arguments[0] && day <= arguments[1];
      }
      // Month and day
      return month === arguments[0] && day === arguments[1];
    }
    
    if (arguments.length === 3) {
      // Month, day, year
      return month === arguments[0] && day === arguments[1] && year === arguments[2];
    }
    
    return false;
  },

  // Convert time range
  timeRange: function() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentMinutes = hour * 60 + minute;
    
    if (arguments.length === 1) {
      return hour === arguments[0];
    }
    
    if (arguments.length === 2) {
      const startMinutes = arguments[0] * 60;
      const endMinutes = arguments[1] * 60;
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }
    
    if (arguments.length === 4) {
      const startMinutes = arguments[0] * 60 + arguments[1];
      const endMinutes = arguments[2] * 60 + arguments[3];
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }
    
    return false;
  }
};

// Execute PAC script for a URL
function executePacScript(scriptContent, url, host) {
  try {
    // Create sandbox with helper functions
    const sandbox = {
      ...PAC_HELPERS,
      url,
      host
    };

    // Build execution context
    const helperFunctions = Object.keys(PAC_HELPERS)
      .map(name => `const ${name} = sandbox.${name};`)
      .join('\n');

    const executionCode = `
      ${helperFunctions}
      const url = sandbox.url;
      const host = sandbox.host;
      
      ${scriptContent}
      
      return FindProxyForURL(url, host);
    `;

    // Execute in function context
    const execute = new Function('sandbox', executionCode);
    const result = execute(sandbox);

    // Parse result
    return parseProxyResult(result);
  } catch (error) {
    console.error('PAC execution error:', error);
    return {
      success: false,
      error: error.message,
      proxy: 'DIRECT'
    };
  }
}

// Parse proxy result from PAC script
function parseProxyResult(result) {
  if (!result || result === 'DIRECT') {
    return {
      success: true,
      proxy: 'DIRECT',
      message: 'Direct connection'
    };
  }

  // Parse proxy string (e.g., "PROXY 192.168.1.1:8080; SOCKS5 10.0.0.1:1080")
  const proxies = result.split(';').map(p => p.trim());
  const primaryProxy = proxies[0];

  if (primaryProxy === 'DIRECT') {
    return {
      success: true,
      proxy: 'DIRECT',
      fallbacks: proxies.slice(1),
      message: 'Direct connection with fallbacks'
    };
  }

  // Parse proxy type and address
  const match = primaryProxy.match(/^(PROXY|SOCKS5|SOCKS4|HTTPS)\s+(.+)$/i);
  
  if (match) {
    return {
      success: true,
      proxy: {
        type: match[1].toUpperCase(),
        address: match[2]
      },
      fallbacks: proxies.slice(1),
      message: `Using ${match[1]} proxy: ${match[2]}`
    };
  }

  return {
    success: false,
    error: 'Invalid proxy result format',
    proxy: 'DIRECT'
  };
}

// ============================================================================
// PAC SCRIPT MANAGER
// ============================================================================

const PAC_SCRIPTS_KEY = 'pacScripts';

// Save PAC script
async function savePacScript(name, scriptContent, isDefault = false) {
  try {
    const { pacScripts = {} } = await chrome.storage.local.get([PAC_SCRIPTS_KEY]);
    
    // Validate script
    const validation = validatePacScript(scriptContent);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    pacScripts[name] = {
      content: scriptContent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault
    };

    await chrome.storage.local.set({ pacScripts });

    return {
      success: true,
      message: `PAC script "${name}" saved`
    };
  } catch (error) {
    console.error('Failed to save PAC script:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Get PAC script by name
async function getPacScript(name) {
  try {
    const { pacScripts = {} } = await chrome.storage.local.get([PAC_SCRIPTS_KEY]);
    
    const script = pacScripts[name];
    if (!script) {
      return {
        success: false,
        error: `PAC script "${name}" not found`
      };
    }

    return {
      success: true,
      script
    };
  } catch (error) {
    console.error('Failed to get PAC script:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// List all PAC scripts
async function listPacScripts() {
  try {
    const { pacScripts = {} } = await chrome.storage.local.get([PAC_SCRIPTS_KEY]);
    
    const scripts = Object.entries(pacScripts).map(([name, script]) => ({
      name,
      createdAt: script.createdAt,
      updatedAt: script.updatedAt,
      isDefault: script.isDefault
    }));

    return {
      success: true,
      scripts
    };
  } catch (error) {
    console.error('Failed to list PAC scripts:', error);
    return {
      success: false,
      error: error.message,
      scripts: []
    };
  }
}

// Delete PAC script
async function deletePacScript(name) {
  try {
    const { pacScripts = {} } = await chrome.storage.local.get([PAC_SCRIPTS_KEY]);
    
    if (!pacScripts[name]) {
      return {
        success: false,
        error: `PAC script "${name}" not found`
      };
    }

    delete pacScripts[name];
    await chrome.storage.local.set({ pacScripts });

    return {
      success: true,
      message: `PAC script "${name}" deleted`
    };
  } catch (error) {
    console.error('Failed to delete PAC script:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Set default PAC script
async function setDefaultPacScript(name) {
  try {
    const { pacScripts = {} } = await chrome.storage.local.get([PAC_SCRIPTS_KEY]);
    
    // Clear all defaults
    Object.keys(pacScripts).forEach(key => {
      pacScripts[key].isDefault = false;
    });

    // Set new default
    if (pacScripts[name]) {
      pacScripts[name].isDefault = true;
    }

    await chrome.storage.local.set({ pacScripts });

    return {
      success: true,
      message: `PAC script "${name}" set as default`
    };
  } catch (error) {
    console.error('Failed to set default PAC script:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// PAC SCRIPT TESTING
// ============================================================================

// Test PAC script with sample URLs
async function testPacScript(scriptContent, testUrls = []) {
  const defaultTestUrls = [
    'https://www.google.com',
    'https://www.netflix.com',
    'https://www.amazon.com',
    'https://internal.company.com',
    'http://localhost:8080'
  ];

  const urls = testUrls.length > 0 ? testUrls : defaultTestUrls;
  const results = [];

  for (const url of urls) {
    try {
      const host = new URL(url).hostname;
      const result = executePacScript(scriptContent, url, host);
      
      results.push({
        url,
        host,
        proxy: result.proxy,
        success: result.success,
        message: result.message
      });
    } catch (error) {
      results.push({
        url,
        host: new URL(url).hostname,
        proxy: 'ERROR',
        success: false,
        error: error.message
      });
    }
  }

  return {
    success: true,
    results,
    summary: {
      total: results.length,
      direct: results.filter(r => r.proxy === 'DIRECT').length,
      proxied: results.filter(r => r.proxy !== 'DIRECT' && r.success).length,
      errors: results.filter(r => !r.success).length
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Parser
  parsePacScript,
  validatePacScript,
  
  // Execution
  executePacScript,
  parseProxyResult,
  
  // Manager
  savePacScript,
  getPacScript,
  listPacScripts,
  deletePacScript,
  setDefaultPacScript,
  
  // Testing
  testPacScript,
  
  // Helpers
  PAC_HELPERS
};