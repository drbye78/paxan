// PeasyProxy - PAC Script Engine
// Implements PAC (Proxy Auto-Config) script parsing and execution
// Security: Does NOT execute arbitrary JavaScript. Only interprets known proxy
// directives (PROXY, DIRECT, SOCKS, SOCKS5, HTTP, HTTPS) from return statements.

import { THRESHOLDS } from '../popup/constants.js';
import { wildcardToRegex } from '../shared/utils.js';

// ============================================================================
// PAC SCRIPT PARSER
// ============================================================================

/**
 * Extract the body of FindProxyForURL using brace-counting (safe, non-greedy).
 * Returns the function body string between the opening and closing braces,
 * or null if extraction fails.
 */
function extractFunctionBody(content) {
  const funcMatch = content.match(/function\s+FindProxyForURL\s*\(\s*\w+\s*,\s*\w+\s*\)\s*\{/i);
  if (!funcMatch) return null;

  const startIndex = funcMatch.index + funcMatch[0].length;
  let depth = 1;
  let i = startIndex;

  for (; i < content.length && depth > 0; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') depth--;
  }

  if (depth !== 0) return null;
  return content.slice(startIndex, i - 1).trim();
}

// Parse PAC script content (backward-compatible wrapper)
function parsePacScript(scriptContent) {
  try {
    // Validate script has FindProxyForURL function
    if (!scriptContent.includes('FindProxyForURL')) {
      throw new Error('PAC script must contain FindProxyForURL function');
    }

    const functionBody = extractFunctionBody(scriptContent);

    if (!functionBody) {
      throw new Error('Invalid PAC script format');
    }

    return {
      success: true,
      functionBody,
      fullScript: scriptContent
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate PAC script syntax.
 * Since we no longer execute arbitrary code, validation only checks that
 * FindProxyForURL exists and braces are balanced.
 */
function validatePacScript(content) {
  if (!content || typeof content !== 'string') return { valid: false, error: 'PAC script content is empty' };

  if (!/function\s+FindProxyForURL\s*\(\s*\w+\s*,\s*\w+\s*\)/i.test(content)) {
    return { valid: false, error: 'Missing FindProxyForURL function' };
  }

  // Check brace balance
  const openCount = (content.match(/\{/g) || []).length;
  const closeCount = (content.match(/\}/g) || []).length;

  if (openCount !== closeCount) {
    return { valid: false, error: 'Unbalanced braces in PAC script' };
  }

  // Check script length
  if (content.length > 100000) {
    return { valid: false, error: 'PAC script exceeds maximum length (100KB)' };
  }

  return { valid: true, message: 'PAC script is valid' };
}

// ============================================================================
// SAFE PAC EVALUATOR
// ============================================================================

/**
 * Evaluate condition functions commonly used in PAC scripts.
 * Only supports known safe functions: shExpMatch, dnsDomainIs, isPlainHostName.
 * Unknown or unsupported conditions fall through to the false branch.
 */
function evaluateCondition(condition, host) {
  if (!condition) return false;

  condition = condition.trim();

  // Literal booleans
  if (condition === 'true') return true;
  if (condition === 'false') return false;

  // shExpMatch(variable, "pattern")
  if (condition.startsWith('shExpMatch(')) {
    const shMatch = condition.match(/shExpMatch\s*\(\s*\w+\s*,\s*["'](.+?)["']\s*\)/i);
    if (shMatch) {
      try {
        const regex = wildcardToRegex(shMatch[1]);
        return regex.test(host);
      } catch {
        return false;
      }
    }
  }

  // dnsDomainIs(variable, "domain")
  if (condition.startsWith('dnsDomainIs(')) {
    const dnsMatch = condition.match(/dnsDomainIs\s*\(\s*\w+\s*,\s*["'](.+?)["']\s*\)/i);
    if (dnsMatch) {
      const domain = dnsMatch[1];
      return (host === domain || host.endsWith('.' + domain));
    }
  }

  // isPlainHostName(variable)
  if (condition.startsWith('isPlainHostName(')) {
    return !host.includes('.');
  }

  // isResolvable, dnsResolve, isInNet, myIpAddress — not safely evaluable,
  // fall through to false
  return false;
}

/**
 * Evaluate a ternary expression: condition ? "trueBranch" : "falseBranch"
 */
function evaluateTernary(expr, host) {
  // Match: condition ? "string1" : "string2"
  // Quoted strings may contain semicolons for proxy chains
  const ternaryMatch = expr.match(/^(.+?)\s*\?\s*["'](.+?)["']\s*:\s*["'](.+?)["']$/);
  if (ternaryMatch) {
    const condition = evaluateCondition(ternaryMatch[1].trim(), host);
    return condition ? ternaryMatch[2] : ternaryMatch[3];
  }
  return expr;
}

/**
 * Safely evaluate a PAC script's FindProxyForURL function body for the given URL.
 * Only interprets return statements with proxy directives.
 * Does NOT execute or evaluate arbitrary JavaScript.
 *
 * @param {string} pacFunctionBody - The body of FindProxyForURL (between braces)
 * @param {string} url - The full URL to evaluate
 * @param {string} host - The hostname to evaluate
 * @returns {string} The proxy directive string (e.g. "PROXY host:port; DIRECT")
 */
function evaluateFindProxyForURL(pacFunctionBody, url, host) {
  // Find the return statement — look for "return X;" or "return X" at end
  const returnMatch = pacFunctionBody.match(/return\s+([^;]+);?\s*$/m);
  if (!returnMatch) return 'DIRECT';

  let returnExpr = returnMatch[1].trim();

  // If it's a ternary expression, evaluate it
  returnExpr = evaluateTernary(returnExpr, host);

  // If it's still a plain variable reference (not a proxy directive), fall back
  if (!/[A-Z]/.test(returnExpr) || returnExpr.match(/^[a-z_]\w*$/i)) {
    return 'DIRECT';
  }

  return returnExpr;
}

/**
 * Parse proxy directives from a result string into structured objects.
 *
 * @param {string} result - e.g. "PROXY 192.168.1.1:8080; SOCKS5 10.0.0.1:1080"
 * @returns {Array<{type: 'proxy'|'direct', host?: string, port?: number, scheme?: string}>}
 */
function parseProxyDirectives(result) {
  if (!result || result === 'DIRECT') return [{ type: 'direct' }];

  const directives = result.split(';').map(d => d.trim()).filter(Boolean);
  return directives.map(d => {
    const parts = d.split(/\s+/);
    const directive = parts[0]?.toUpperCase();
    const hostPort = parts[1];

    if (directive === 'DIRECT') return { type: 'direct' };
    if (!hostPort) return { type: 'direct' };

    const [host, port] = hostPort.split(':');
    let scheme = 'http';
    if (directive === 'SOCKS5' || directive === 'SOCKS') scheme = 'socks5';
    else if (directive === 'SOCKS4') scheme = 'socks4';
    else if (directive === 'HTTPS') scheme = 'https';

    return { type: 'proxy', host, port: parseInt(port) || 1080, scheme };
  });
}

// ============================================================================
// PAC SCRIPT EXECUTION ENGINE
// ============================================================================

// PAC helper functions — available as local helpers for manual evaluation.
// NOTE: Most of these are not used by the safe evaluator (which does not
// execute arbitrary JavaScript). They exist for reference and manual testing.
const PAC_HELPERS = {
  /**
   * Check if host matches a shell/wildcard pattern.
   * Uses wildcardToRegex from shared utils for safe pattern conversion.
   */
  shExpMatch: function(str, pattern) {
    if (!str || !pattern) return false;
    try {
      const regex = wildcardToRegex(pattern);
      return regex.test(str);
    } catch {
      return false;
    }
  },

  // Check if host is in domain
  dnsDomainIs: function(host, domain) {
    return host === domain || host.endsWith('.' + domain);
  },

  // Check if host is localhost (no dots)
  isPlainHostName: function(host) {
    return !host.includes('.');
  },

  // ── Stubs below: browser service worker context cannot resolve DNS ──

  /**
   * Check if host is resolvable.
   * STUB — browser context cannot resolve DNS. Returns true as fallback.
   */
  isResolvable: function(host) {
    return true;
  },

  /**
   * Get host IP address.
   * STUB — browser context cannot resolve DNS. Returns null.
   */
  dnsResolve: function(host) {
    return null;
  },

  /**
   * Check if IP is in subnet range.
   * STUB — requires DNS resolution which is unavailable. Returns false.
   */
  isInNet: function(ip, pattern, mask) {
    return false;
  },

  /**
   * Get local host IP address.
   * STUB — browser cannot determine real IP. Returns loopback address.
   */
  myIpAddress: function() {
    return '127.0.0.1';
  },

  // ── Date/time helpers — these work correctly in any JS context ──

  /** Convert weekday to number. Supports weekdayRange(wd1, wd2, [gmt]). */
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

  /** Convert date range. Supports dateRange(day), dateRange(day1, day2), etc. */
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

  /** Convert time range. Supports timeRange(h1, h2) and timeRange(h1, m1, h2, m2). */
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

/**
 * Execute a PAC script by ID for the given URL.
 * Uses the safe evaluator — does NOT execute arbitrary JavaScript.
 *
 * @param {string} scriptId - The name/key of the saved PAC script
 * @param {string} [url='https://example.com'] - URL to evaluate against
 * @returns {Promise<Object>} Result with directives array
 */
async function executePacScript(scriptId, url = 'https://example.com') {
  try {
    const result = await getPacScript(scriptId);
    if (!result.success) return { success: false, error: result.error };

    const script = result.script;
    const hostname = new URL(url).hostname;

    // Extract FindProxyForURL body using brace-counting (not greedy regex)
    const funcBody = extractFunctionBody(script.content);
    if (!funcBody) return { success: false, error: 'Could not parse FindProxyForURL' };

    const proxyResult = evaluateFindProxyForURL(funcBody, url, hostname);
    const directives = parseProxyDirectives(proxyResult);

    return {
      success: true,
      url,
      hostname,
      result: proxyResult,
      directives,
      scriptName: script.name || scriptId
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Parse proxy result string (backward-compatible wrapper).
 * Delegates to parseProxyDirectives and returns the old format.
 */
function parseProxyResult(result) {
  if (!result || result === 'DIRECT') {
    return {
      success: true,
      proxy: 'DIRECT',
      message: 'Direct connection'
    };
  }

  const directives = parseProxyDirectives(result);
  const primary = directives[0];

  if (primary.type === 'direct') {
    return {
      success: true,
      proxy: 'DIRECT',
      fallbacks: directives.slice(1).map(d => `${d.scheme?.toUpperCase() || 'PROXY'} ${d.host}:${d.port}`),
      message: 'Direct connection with fallbacks'
    };
  }

  return {
    success: true,
    proxy: {
      type: primary.scheme.toUpperCase(),
      address: `${primary.host}:${primary.port}`
    },
    fallbacks: directives.slice(1).map(d => {
      if (d.type === 'direct') return 'DIRECT';
      return `${d.scheme?.toUpperCase() || 'PROXY'} ${d.host}:${d.port}`;
    }),
    message: `Using ${primary.scheme.toUpperCase()} proxy: ${primary.host}:${primary.port}`
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
      script: { ...script, name }
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

/**
 * Test a PAC script with sample URLs using the safe evaluator.
 * Does NOT execute arbitrary code.
 */
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
    // Parse hostname once, outside the main try/catch (fix double-catch of new URL)
    let host;
    try {
      host = new URL(url).hostname;
    } catch {
      host = url;
    }

    try {
      const funcBody = extractFunctionBody(scriptContent);
      if (!funcBody) {
        results.push({
          url,
          host,
          proxy: 'ERROR',
          success: false,
          message: 'Could not parse FindProxyForURL'
        });
        continue;
      }

      const evalResult = evaluateFindProxyForURL(funcBody, url, host);
      const directives = parseProxyDirectives(evalResult);
      const primary = directives[0];

      if (primary.type === 'proxy') {
        results.push({
          url,
          host,
          proxy: { type: primary.scheme.toUpperCase(), address: `${primary.host}:${primary.port}` },
          success: true,
          message: `Using ${primary.scheme.toUpperCase()} proxy: ${primary.host}:${primary.port}`
        });
      } else {
        results.push({
          url,
          host,
          proxy: 'DIRECT',
          success: true,
          message: 'Direct connection'
        });
      }
    } catch (error) {
      results.push({
        url,
        host,
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
      proxied: results.filter(r => r.proxy !== 'DIRECT' && r.proxy !== 'ERROR' && r.success).length,
      errors: results.filter(r => !r.success).length
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  parsePacScript,
  validatePacScript,
  executePacScript,
  parseProxyResult,
  savePacScript,
  getPacScript,
  listPacScripts,
  deletePacScript,
  setDefaultPacScript,
  testPacScript,
  PAC_HELPERS,
  // Export new safe evaluator functions for external use
  extractFunctionBody,
  evaluateFindProxyForURL,
  parseProxyDirectives
};
