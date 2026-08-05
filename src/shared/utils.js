// ============================================================================
// PeasyProxy - Shared Utilities
// Safe for both background service worker and popup contexts.
// Zero DOM APIs, zero Chrome APIs, zero Node APIs.
// ============================================================================

// ============================================================================
// HTML escaping — for safely rendering user-provided data in the popup
// ============================================================================

const ENTITY_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape user-provided text for safe insertion into innerHTML.
 * Idempotent: escaping already-escaped text is safe.
 */
export function escapeHtml(text) {
  if (text == null) return '';
  return String(text).replace(/[&<>"']/g, c => ENTITY_MAP[c]);
}

// ============================================================================
// Proxy config builder — single canonical implementation
// ============================================================================

const STANDARD_BYPASS_LIST = [
  'localhost',
  '127.0.0.1',
  '::1',
  '*.local',
  '192.168.*',
  '10.*',
  '172.16.*', '172.17.*', '172.18.*', '172.19.*', '172.20.*',
  '172.21.*', '172.22.*', '172.23.*', '172.24.*', '172.25.*',
  '172.26.*', '172.27.*', '172.28.*', '172.29.*', '172.30.*', '172.31.*',
  'chrome-extension://*',
  'chrome://*',
];

/**
 * Build a chrome.proxy.settings value from a proxy object.
 * For use with chrome.proxy.settings.set({ value: buildProxyConfig(proxy), scope: 'regular' }).
 *
 * @param {Object} proxy   - { ip, port, type } where type is 'HTTP'|'HTTPS'|'SOCKS5'|'SOCKS4'
 * @param {Object} [opts]
 * @param {string[]} [opts.bypassList] - custom bypass list (defaults to STANDARD_BYPASS_LIST)
 * @returns {{ mode: 'fixed_servers', rules: { singleProxy: { scheme: string, host: string, port: number }, bypassList: string[] } }}
 */
export function buildProxyConfig(proxy, opts = {}) {
  if (!proxy || typeof proxy !== 'object') {
    throw new Error('buildProxyConfig: proxy must be a non-null object with { ip, port, type }');
  }
  if (!proxy.ip || !proxy.port || !proxy.type) {
    throw new Error('buildProxyConfig: proxy must have ip, port, and type fields');
  }

  const bypassList = opts.bypassList || STANDARD_BYPASS_LIST;
  let scheme = 'http';
  if (proxy.type === 'HTTPS' || proxy.type === 'https') scheme = 'https';
  else if (proxy.type === 'SOCKS5' || proxy.type === 'socks5') scheme = 'socks5';
  else if (proxy.type === 'SOCKS4' || proxy.type === 'socks4') scheme = 'socks4';

  return {
    mode: 'fixed_servers',
    rules: {
      singleProxy: {
        scheme,
        host: proxy.ip,
        port: proxy.port,
      },
      bypassList,
    },
  };
}

// ============================================================================
// Regex safety — guards against ReDoS in user-supplied patterns
// ============================================================================

const MAX_REGEX_LENGTH = 200;
const MAX_REGEX_COMPLEXITY = 10;

/**
 * Checks for ReDoS-prone patterns (nested quantifiers) and excessive complexity.
 * - Detects nested quantifier patterns like (a+)+, (a*)*, (a+)*, (a*)+
 * - Rejects excessive length (>200 chars) and operator count (>10)
 * - Rejects lookarounds (which can also cause backtracking issues)
 *
 * @param {string} pattern - regex pattern to validate
 * @returns {boolean} true if the pattern is safe to compile and execute
 */
export function isRegexSafe(pattern) {
  if (!pattern || pattern.length > MAX_REGEX_LENGTH) return false;

  // Detect nested quantifiers — classic exponential backtracking pattern.
  // Matches any quantifier (+ or *) inside a group (...) where the group
  // itself is also quantified with + or *.
  // Examples caught: (a+)+, (a*)*, (a+)*, (a*)+, ((a)+)+, (a+b)+
  if (/[+*][^()]*\)[+*]/.test(pattern)) return false;

  const complexityIndicators = (pattern.match(/[()*+?[\]{}|]/g) || []).length;
  if (complexityIndicators > MAX_REGEX_COMPLEXITY) return false;
  if (/(\(\?[<=!])/.test(pattern)) return false;
  return true;
}

/**
 * Safely test a regex pattern against text.
 * Returns false if the pattern is unsafe or if the match fails.
 */
export function safeRegexTest(pattern, text) {
  if (!isRegexSafe(pattern)) return false;
  try {
    const regex = new RegExp(pattern, 'i');
    const result = regex.test(text);
    regex.lastIndex = 0;
    return result;
  } catch {
    return false;
  }
}

// ============================================================================
// Wildcard pattern matching — used by url-rules and site-rules
// ============================================================================

/**
 * Escape all regex special characters in a string so it can be used literally
 * in a RegExp constructor. Use before converting wildcard patterns to regex.
 */
export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert a wildcard pattern into a regex.
 * Supports * (any characters) and ? (single character) wildcards.
 * Safe for user-supplied patterns because only * and ? are honored as wildcards.
 */
export function wildcardToRegex(pattern) {
  const str = String(pattern);
  // Replace ? wildcard with a sentinel before escaping regex specials
  const SENTINEL = '\x00WILDQM\x00';
  const withSentinel = str.replace(/\?/g, SENTINEL);
  const escaped = escapeRegex(withSentinel);
  // Restore ? as . (single character wildcard)
  const withDot = escaped.replace(new RegExp(SENTINEL, 'g'), '.');
  // Convert escaped * back to .* (any characters wildcard)
  const regexStr = withDot.replace(/\\\*/g, '.*');
  return new RegExp(`^${regexStr}$`, 'i');
}

// ============================================================================
// Version comparison — used by onInstalled migration logic
// ============================================================================

/**
 * Compare two semver strings. Handles pre-release tags per semver 2.0:
 * pre-release versions (e.g., "1.2.3-alpha") sort LOWER than the
 * corresponding release version ("1.2.3"). Returns:
 *   1 if a > b
 *  -1 if a < b
 *   0 if equal
 */
export function compareVersions(a, b) {
  const aParts = a.split('.');
  const bParts = b.split('.');
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLen; i++) {
    const aSeg = aParts[i] || '0';
    const bSeg = bParts[i] || '0';

    // Split on first '-' to separate numeric part from pre-release tag
    const [aNum, aPre] = aSeg.split('-', 2);
    const [bNum, bPre] = bSeg.split('-', 2);

    const aVal = parseInt(aNum, 10) || 0;
    const bVal = parseInt(bNum, 10) || 0;

    if (aVal > bVal) return 1;
    if (aVal < bVal) return -1;

    // Numeric parts equal — compare pre-release tags
    if (aPre && !bPre) return -1;
    if (!aPre && bPre) return 1;
    if (aPre && bPre) {
      // Both have pre-release — compare lexicographically
      if (aPre > bPre) return 1;
      if (aPre < bPre) return -1;
    }
  }
  return 0;
}

// ============================================================================
// General helpers
// ============================================================================

/**
 * Truncate a string with ellipsis.
 */
export function truncate(str, maxLen = 50) {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Generate a unique ID using timestamp + random suffix.
 * Collision probability is negligible for the extension's use case.
 */
let _idCounter = 0;
export function uniqueId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${++_idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}
