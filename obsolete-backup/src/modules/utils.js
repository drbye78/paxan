// ProxyMania VPN - Utility Functions Module
// Pure helper functions with no dependencies on DOM or Chrome API

import { countryFlags, getProxyStats, getProxyReputation, getFavorites } from './state.js';

// ============================================================================
// HTML UTILITIES - Sanitization and escaping
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text safe for HTML insertion
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const MAX_REGEX_LENGTH = 200;
const MAX_REGEX_COMPLEXITY = 10;

function isRegexSafe(pattern) {
  if (!pattern || pattern.length > MAX_REGEX_LENGTH) return false;
  const complexityIndicators = (pattern.match(/[()*+?[\]{}|]/g) || []).length;
  if (complexityIndicators > MAX_REGEX_COMPLEXITY) return false;
  if (pattern.includes('(?=') || pattern.includes('(?!') || pattern.includes('(?<=') || pattern.includes('(?<!')) return false;
  return true;
}

function safeRegexTest(pattern, text) {
  if (!isRegexSafe(pattern)) return false;
  try {
    const regex = new RegExp(pattern, 'i');
    const result = regex.test(text);
    regex.lastIndex = 0;
    return result;
  } catch (e) {
    return false;
  }
}

/**
 * Sanitize HTML content for safe display
 * @param {string} content - HTML content to sanitize
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHtml(content) {
  if (!content) return '';
  return escapeHtml(content);
}

/**
 * Validate search input to prevent injection
 * @param {string} input - User input
 * @returns {string} - Sanitized input
 */
export function validateSearchInput(input) {
  if (!input) return '';
  // Remove potentially dangerous characters
  return input.replace(/[<>\"'&]/g, '').trim();
}

/**
 * Sanitize proxy object for safe display
 * @param {Object} proxy - Proxy object
 * @returns {Object} - Sanitized proxy object
 */
export function sanitizeProxyForDisplay(proxy) {
  if (!proxy) return null;
  return {
    ...proxy,
    country: escapeHtml(proxy.country),
    type: escapeHtml(proxy.type),
    ip: escapeHtml(proxy.ip),
    ipPort: escapeHtml(proxy.ipPort)
  };
}

// ============================================================================
// FUNCTIONAL UTILITIES - Debounce, throttle, etc.
// ============================================================================

/**
 * Debounce function calls
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function calls
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
export function throttle(fn, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ============================================================================
// PROXY UTILITIES - Scoring, filtering, pattern matching
// ============================================================================

/**
 * Calculate proxy score for sorting
 * @param {Object} proxy - Proxy object
 * @returns {number} - Score (0-100)
 */
export function calculateProxyScore(proxy) {
  if (!proxy) return 0;
  
  const stats = getProxyStats()[proxy.ipPort] || {};
  const reputation = getProxyReputation()[proxy.ipPort] || {};
  const favorites = getFavorites();
  
  // Speed score (40%)
  const speedMs = proxy.speedMs || parseInt(proxy.speed) || 1000;
  const speedScore = Math.max(0, 100 - (speedMs / 5));
  
  // Reliability score (40%)
  const successRate = stats.successRate || 50;
  const reliabilityScore = successRate;
  
  // Freshness score (20%)
  const lastCheck = reputation.lastCheck || 0;
  const hoursSinceCheck = (Date.now() - lastCheck) / (1000 * 60 * 60);
  const freshnessScore = Math.max(0, 100 - (hoursSinceCheck * 10));
  
  // Calculate base score
  let score = (speedScore * 0.4) + (reliabilityScore * 0.4) + (freshnessScore * 0.2);
  
  // Favorite bonus
  const isFavorite = favorites.some(f => f.ipPort === proxy.ipPort);
  if (isFavorite) {
    score += 10;
  }
  
  return Math.min(100, Math.round(score));
}

/**
 * Get working status label for proxy
 * @param {Object} proxy - Proxy object
 * @returns {string} - Working status
 */
export function getWorkingStatus(proxy) {
  if (!proxy) return 'unknown';
  
  const stats = getProxyStats()[proxy.ipPort];
  if (!stats) return 'unknown';
  
  const { successRate, lastSuccess, lastFailure } = stats;
  
  if (successRate >= 80) return 'working';
  if (successRate >= 50) return 'unstable';
  if (successRate < 50) return 'down';
  
  return 'unknown';
}

/**
 * Get trust badge information for proxy
 * @param {Object} proxy - Proxy object
 * @returns {Object} - Trust badge info
 */
export function getTrustBadge(proxy) {
  if (!proxy) return { type: 'unknown', text: 'Unknown' };
  
  const stats = getProxyStats()[proxy.ipPort];
  if (!stats) return { type: 'unverified', text: 'Unverified' };
  
  const { successRate, attempts } = stats;
  
  if (attempts >= 100 && successRate >= 90) {
    return { type: 'trusted', text: 'Trusted' };
  }
  if (attempts >= 50 && successRate >= 70) {
    return { type: 'reliable', text: 'Reliable' };
  }
  if (successRate >= 50) {
    return { type: 'unverified', text: 'Unverified' };
  }
  return { type: 'risky', text: 'Risky' };
}

/**
 * Pattern matching for site rules
 * @param {string} pattern - Pattern to match
 * @param {string} hostname - Hostname to test
 * @param {string} patternType - Type: exact, wildcard, contains, regex
 * @returns {boolean} - Whether pattern matches
 */
export function matchesPattern(pattern, hostname, patternType = 'exact') {
  if (!pattern || !hostname) return false;

  switch (patternType) {
    case 'wildcard':
      // *.example.com matches sub.example.com
      if (pattern.startsWith('*.')) {
        const domain = pattern.slice(2);
        return hostname === domain || hostname.endsWith('.' + domain);
      }
      // *keyword* matches anything containing keyword
      if (pattern.startsWith('*') && pattern.endsWith('*')) {
        return hostname.includes(pattern.slice(1, -1));
      }
      return hostname.endsWith(pattern);

    case 'contains':
      return hostname.includes(pattern);

    case 'regex':
      return safeRegexTest(pattern, hostname);

    case 'exact':
    default:
      return hostname === pattern || hostname.endsWith('.' + pattern);
  }
}

// ============================================================================
// FORMAT UTILITIES - Time, numbers, etc.
// ============================================================================

/**
 * Format milliseconds to human readable time
 * @param {number} ms - Milliseconds
 * @returns {string} - Formatted time string
 */
export function formatTime(ms) {
  if (!ms) return '00:00:00';
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return [hours, minutes, seconds]
    .map(v => v.toString().padStart(2, '0'))
    .join(':');
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
export function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format latency value
 * @param {number} ms - Milliseconds
 * @returns {string} - Formatted latency
 */
export function formatLatency(ms) {
  if (!ms) return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format date for display
 * @param {number} timestamp - Unix timestamp
 * @returns {string} - Formatted date
 */
export function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format relative time (e.g., "5 minutes ago")
 * @param {number} timestamp - Unix timestamp
 * @returns {string} - Relative time string
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ============================================================================
// ARRAY UTILITIES - Sorting, filtering, etc.
// ============================================================================

/**
 * Remove duplicates from array by key
 * @param {Array} arr - Array of objects
 * @param {string} key - Key to deduplicate by
 * @returns {Array} - Deduplicated array
 */
export function uniqueBy(arr, key) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  return arr.filter(item => {
    const val = item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

/**
 * Sort array by key
 * @param {Array} arr - Array to sort
 * @param {string} key - Key to sort by
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} - Sorted array
 */
export function sortBy(arr, key, order = 'asc') {
  if (!Array.isArray(arr)) return [];
  return [...arr].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (order === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
}

/**
 * Group array by key
 * @param {Array} arr - Array to group
 * @param {string} key - Key to group by
 * @returns {Object} - Grouped object
 */
export function groupBy(arr, key) {
  if (!Array.isArray(arr)) return {};
  return arr.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
}

// ============================================================================
// VALIDATION UTILITIES - Check values
// ============================================================================

/**
 * Validate proxy object structure
 * @param {Object} proxy - Proxy to validate
 * @returns {boolean} - Whether proxy is valid
 */
export function isValidProxy(proxy) {
  if (!proxy) return false;
  return !!(
    proxy.ip &&
    proxy.port &&
    proxy.ipPort &&
    proxy.country &&
    proxy.type
  );
}

/**
 * Validate URL string
 * @param {string} url - URL to validate
 * @returns {boolean} - Whether URL is valid
 */
export function isValidUrl(url) {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Validate IP address
 * @param {string} ip - IP address to validate
 * @returns {boolean} - Whether IP is valid
 */
export function isValidIp(ip) {
  if (!ip) return false;
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Pattern = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;
  return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

/**
 * Validate port number
 * @param {number} port - Port to validate
 * @returns {boolean} - Whether port is valid
 */
export function isValidPort(port) {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}
