// ============================================================================
// PeasyProxy - Tamper Detection
// Detects MITM tampering by proxied connections (content injection, header
// manipulation, IP rewriting). Uses proxyConfig for safe proxy switching.
// ============================================================================

import { buildProxyConfig } from '../shared/utils.js';
import { proxyConfig } from '../background/proxy-config-manager.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENDPOINTS = [
  'https://httpbin.org/headers',
  'https://httpbin.org/ip',
  'https://api.ipify.org?format=json'
];

const SUSPICIOUS_KEY = 'suspiciousProxies';

const SUSPICIOUS_PATTERNS = [
  /<script[^>]*src\s*=\s*["'][^"']*(?:eval|b64|atob|encoded)/i,
  /\bonerror\s*=\s*/i,
  /\beval\s*\(\s*(?:atob|btoa|String\.fromCharCode)/i,
  /\bdocument\.cookie\b/i,
  /\bwindow\.location\s*=/i,
];

// ---------------------------------------------------------------------------
// TamperDetector
// ---------------------------------------------------------------------------

class TamperDetector {
  constructor() {
    this.baselines = {};
    this.suspiciousProxies = new Set();
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  async init() {
    await this.loadBaselines();
    // Restore suspicious proxies from storage (survives SW restarts)
    try {
      const data = await chrome.storage.local.get([SUSPICIOUS_KEY]);
      if (data[SUSPICIOUS_KEY]) {
        this.suspiciousProxies = new Set(data[SUSPICIOUS_KEY]);
      }
    } catch { /* storage may not be available during early init */ }
  }

  async loadBaselines() {
    const result = await chrome.storage.local.get(['tamperBaselines']);
    this.baselines = result.tamperBaselines || {};
  }

  async save() {
    await chrome.storage.local.set({ tamperBaselines: this.baselines });
  }

  async persistSuspicious() {
    try {
      await chrome.storage.local.set({
        [SUSPICIOUS_KEY]: [...this.suspiciousProxies]
      });
    } catch { /* non-critical */ }
  }

  // ========================================================================
  // Proxy testing
  // ========================================================================

  /**
   * Test a proxy across all endpoints in PARALLEL for speed.
   * Adds to suspiciousProxies set if tampering detected.
   */
  async testProxy(proxy) {
    const results = await Promise.all(
      ENDPOINTS.map(url => this.verifyContent(proxy, url).catch(err => ({
        url, error: err.message, content: '', headers: {}, status: 0
      })))
    );

    const detection = this.detectTampering(results);

    if (detection.tampered) {
      this.suspiciousProxies.add(proxy.ipPort);
      await this.persistSuspicious();
    }

    return {
      proxy: proxy.ipPort,
      tampered: detection.tampered,
      details: detection,
      results: results.map(r => ({
        url: r.url,
        status: r.status,
        hasIssues: !!r.error
      }))
    };
  }

  /**
   * Verify content from a single endpoint through the given proxy.
   * Uses proxyConfig.withTestConfig to safely switch proxy, test, and restore.
   */
  async verifyContent(proxy, url = ENDPOINTS[0]) {
    const testConfig = buildProxyConfig(proxy);
    try {
      return await proxyConfig.withTestConfig(testConfig, async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store',
            headers: { 'Accept': 'application/json' }
          });
          clearTimeout(timeoutId);
          const content = await response.text();
          const headers = response.headers;
          return {
            url,
            content,
            headers: Object.fromEntries(headers.entries()),
            status: response.status
          };
        } finally {
          clearTimeout(timeoutId);
        }
      }, { timeoutMs: 12000, settleMs: 50 });
    } catch (error) {
      return { url, error: error.message, content: '', headers: {}, status: 0 };
    }
  }

  // ========================================================================
  // Detection logic
  // ========================================================================

  /**
   * Detect tampering across all test results.
   * Accepts both the new array-based signature (from testProxy) and the
   * legacy (headers, content, url) signature for direct unit-test usage.
   *
   * @param {Array|Object} resultsOrHeaders - array of result objects, or headers object
   * @param {string} [content] - response body (legacy signature only)
   * @param {string} [url] - endpoint URL (legacy signature only)
   * @returns {Object|boolean} { tampered: boolean } for array input, boolean for legacy
   */
  detectTampering(resultsOrHeaders, content, url) {
    // Legacy signature: detectTampering(headers, content, url) → boolean
    if (content !== undefined) {
      // Wrap a single result for unified processing
      const singleResult = { headers: resultsOrHeaders, content, url };
      const detection = this._detectResults([singleResult]);
      return detection.tampered;
    }

    // New signature: detectTampering(resultsArray) → { tampered }
    return this._detectResults(resultsOrHeaders);
  }

  /**
   * Internal: run tampering checks across all results.
   */
  _detectResults(results) {
    for (const result of results) {
      if (result.error) continue; // skip failed fetches

      if (this._checkSingle(result.headers, result.content, result.url, result.status)) {
        return { tampered: true };
      }
    }
    return { tampered: false };
  }

  /**
   * Check a single response for tampering indicators.
   * @param {Object} headers - response headers
   * @param {string} content - response body
   * @param {string} url - endpoint URL
   * @param {number} [status=0] - HTTP status code
   */
  _checkSingle(headers, content, url, status = 0) {
    // Baseline comparison takes priority when available
    if (url && this.baselines[url]) {
      const baselineResult = this._compareToBaseline(
        { content, headers, status, url },
        this.baselines[url]
      );
      if (baselineResult.suspicious) {
        return true;
      }
      // If baseline check passed, still run heuristic checks as second layer
    }

    // --- httpbin.org/headers ---
    if (url && url.includes('httpbin.org/headers')) {
      const userAgent = headers['user-agent'] || headers['User-Agent'] || '';

      // Raised threshold from 200 to 500 to reduce false positives
      if (userAgent.length > 500) return true;

      // Check for script injection in what should be a JSON/HTML response
      if (content.includes('<script') || content.includes('eval(')) {
        return true;
      }

      // Check SUSPICIOUS_PATTERNS
      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(content)) return true;
      }
    }

    // --- httpbin.org/ip ---
    if (url && url.includes('httpbin.org/ip')) {
      try {
        const data = JSON.parse(content);
        if (!data.origin) return true;
      } catch {
        return true;
      }
    }

    return false;
  }

  /**
   * Compare a proxy response result against a stored direct-connection baseline.
   * @param {Object} result - { content, headers, status, url }
   * @param {Object} baseline - { content, headers, status } from fetchDirect
   * @returns {{ suspicious: boolean, reason: string }}
   */
  _compareToBaseline(result, baseline) {
    // Compare HTTP status
    if (result.status !== baseline.status) {
      return {
        suspicious: true,
        reason: `HTTP status differs (baseline: ${baseline.status}, got: ${result.status})`
      };
    }

    // Compare content length — flag >20% difference
    const resultLen = result.content.length;
    const baselineLen = baseline.content.length;
    if (baselineLen > 0) {
      const diffPercent = Math.abs(resultLen - baselineLen) / baselineLen;
      if (diffPercent > 0.20) {
        return {
          suspicious: true,
          reason: `Content length differs by ${Math.round(diffPercent * 100)}% (baseline: ${baselineLen}, got: ${resultLen})`
        };
      }
    }

    // Compare structural JSON integrity for known JSON endpoints
    if (result.url && (result.url.includes('httpbin.org/ip') || result.url.includes('api.ipify.org'))) {
      try {
        const resultJson = JSON.parse(result.content);
        const baselineJson = JSON.parse(baseline.content);
        // Verify expected key fields are present
        const expectedField = result.url.includes('ipify') ? 'ip' : 'origin';
        if (baselineJson[expectedField] && !resultJson[expectedField]) {
          return {
            suspicious: true,
            reason: `Missing expected field '${expectedField}' in JSON response`
          };
        }
      } catch {
        // If baseline was valid JSON but result isn't → suspicious
        try {
          JSON.parse(baseline.content);
          return { suspicious: true, reason: 'Expected JSON response is not valid JSON' };
        } catch {
          // Baseline wasn't valid JSON either — skip this check
        }
      }
    }

    return { suspicious: false, reason: '' };
  }

  /**
   * Detect suspicious content patterns in HTML responses.
   * Called independently by unit tests and internally during detection.
   */
  detectSuspiciousContent(headers, content) {
    const contentType = (headers['content-type'] || '').toLowerCase();

    // Only inspect HTML responses
    if (contentType && !contentType.includes('html')) {
      return false;
    }

    // Check SUSPICIOUS_PATTERNS
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(content)) return true;
    }

    // Check for excessive script tags in simple API responses
    const scriptTags = content.match(/<script[\s>]/gi);
    if (scriptTags && scriptTags.length > 3) {
      return true;
    }

    // Check for eval with encoded payloads
    if (/eval\s*\(\s*['"`]/.test(content)) {
      return true;
    }

    // Check for cookie stealing patterns (assignment, not just presence)
    if (/document\.cookie\s*[=;]/.test(content)) {
      return true;
    }

    return false;
  }

  // ========================================================================
  // Baseline management
  // ========================================================================

  /**
   * Establish content baselines by fetching all endpoints WITHOUT proxy.
   * Uses proxyConfig.fetchDirect to safely clear proxy, fetch, and restore.
   * Runs all endpoint fetches in parallel.
   * Returns baselines as an object keyed by URL.
   */
  async establishBaseline() {
    try {
      const baselineObj = {};
      await Promise.all(
        ENDPOINTS.map(async url => {
          const result = await this.fetchDirect(url);
          baselineObj[url] = result;
        })
      );
      this.baselines = baselineObj;
      await this.save();
      return this.baselines;
    } catch (error) {
      console.error('Failed to establish baseline:', error);
      return null;
    }
  }

  /**
   * Fetch a URL WITHOUT any proxy active.
   * Uses proxyConfig.fetchDirect to safely clear settings, execute, and restore.
   * No real-IP leak — the proxy is restored in the finally block.
   */
  async fetchDirect(url) {
    return proxyConfig.fetchDirect(async () => {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      return {
        content: await response.text(),
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status
      };
    });
  }

  async hashContent(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ========================================================================
  // Suspicious proxy tracking
  // ========================================================================

  addToSuspicious(ipPort) {
    this.suspiciousProxies.add(ipPort);
    this.persistSuspicious();
  }

  removeFromSuspicious(ipPort) {
    this.suspiciousProxies.delete(ipPort);
    this.persistSuspicious();
  }

  isSuspicious(ipPort) {
    return this.suspiciousProxies.has(ipPort);
  }

  getSuspiciousList() {
    return Array.from(this.suspiciousProxies);
  }

  async clearBaselines() {
    this.baselines = {};
    await this.save();
  }
}

// Backward-compat export for consumers still referencing TEST_ENDPOINTS
const TEST_ENDPOINTS = ENDPOINTS.map(url => ({ url, hash: null }));

export { TamperDetector, ENDPOINTS, TEST_ENDPOINTS };
