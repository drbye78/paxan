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
 * Returns true if the regex pattern is safe to compile and execute.
 * Rejects: excessive length, high operator count, lookarounds.
 */
export function isRegexSafe(pattern) {
  if (!pattern || pattern.length > MAX_REGEX_LENGTH) return false;
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
 * Convert a wildcard pattern (using * as the only wildcard) into a regex.
 * Safe for user-supplied patterns because * is the only metacharacter honored.
 */
export function wildcardToRegex(pattern) {
  const escaped = escapeRegex(pattern);
  const regexStr = escaped.replace(/\\\*/g, '.*');
  return new RegExp(`^${regexStr}$`, 'i');
}

// ============================================================================
// Version comparison — used by onInstalled migration logic
// ============================================================================

/**
 * Compare two semver strings. Returns:
 *   1 if a > b
 *  -1 if a < b
 *   0 if equal
 */
export function compareVersions(a, b) {
  const parse = (v) => v.split('.').map(n => parseInt(n, 10) || 0);
  const aParts = parse(a);
  const bParts = parse(b);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
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
