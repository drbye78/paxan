// Proxy Validator Module - Enhanced Speed Testing & Quality Assurance
// Phase 2: Quality & Polish

class ProxyValidator {
  constructor() {
    this.validationQueue = [];
    this.isProcessing = false;
    this.validationResults = new Map();
    this.speedTestEndpoints = [
      'https://httpbin.org/ip',
      'https://api.ipify.org',
      'https://ifconfig.me/ip',
      'https://checkip.amazonaws.com'
    ];
    
    this.init();
  }

  async init() {
    // Load cached validation results
    await this.loadValidationResults();
    
    // Note: Periodic cleanup disabled in MV3
    // Cleanup should be triggered manually or via chrome.alarms
  }

  async loadValidationResults() {
    try {
      const result = await chrome.storage.local.get(['validationResults']);
      if (result.validationResults) {
        this.validationResults = new Map(Object.entries(result.validationResults));
      }
    } catch (error) {
      console.error('Error loading validation results:', error);
    }
  }

  async saveValidationResults() {
    try {
      const serializableResults = Object.fromEntries(this.validationResults);
      await chrome.storage.local.set({ validationResults: serializableResults });
    } catch (error) {
      console.error('Error saving validation results:', error);
    }
  }

  // Enhanced proxy speed testing on import
  async validateProxyList(proxies, options = {}) {
    const {
      testConcurrency = 5,
      timeout = 5000,
      includeLatency = true,
      includeConnectivity = true,
      includeAnonymity = false
    } = options;

    const results = [];
    const proxyBatches = this.chunkArray(proxies, testConcurrency);

    for (const batch of proxyBatches) {
      const batchPromises = batch.map(proxy => 
        this.validateSingleProxy(proxy, { timeout, includeLatency, includeConnectivity, includeAnonymity })
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const proxy = batch[index];
          results.push({
            ...proxy,
            valid: false,
            error: result.reason?.message || 'Validation failed',
            latency: null,
            lastTested: Date.now()
          });
        }
      });

      // Small delay between batches to avoid overwhelming the system
      await this.sleep(500);
    }

    // Update validation cache
    results.forEach(result => {
      this.validationResults.set(result.ipPort, result);
    });
    await this.saveValidationResults();

    return results.sort((a, b) => {
      if (a.valid && !b.valid) return -1;
      if (!a.valid && b.valid) return 1;
      if (a.latency && b.latency) return a.latency - b.latency;
      return 0;
    });
  }

  async validateSingleProxy(proxy, options = {}) {
    const { timeout, includeLatency, includeConnectivity, includeAnonymity } = options;
    const startTime = Date.now();

    try {
      // Test basic connectivity
      if (includeConnectivity) {
        const connectivityResult = await this.testConnectivity(proxy, timeout);
        if (!connectivityResult.success) {
          return {
            ...proxy,
            valid: false,
            error: connectivityResult.error,
            latency: null,
            lastTested: Date.now()
          };
        }
      }

      // Test latency with multiple endpoints
      let avgLatency = null;
      if (includeLatency) {
        avgLatency = await this.measureLatency(proxy, timeout);
      }

      // Test anonymity level
      let anonymityLevel = 'unknown';
      if (includeAnonymity) {
        anonymityLevel = await this.testAnonymity(proxy, timeout);
      }

      const validationTime = Date.now() - startTime;

      return {
        ...proxy,
        valid: true,
        latency: avgLatency,
        anonymityLevel: anonymityLevel,
        validationTime: validationTime,
        lastTested: Date.now(),
        error: null
      };

    } catch (error) {
      return {
        ...proxy,
        valid: false,
        error: error.message,
        latency: null,
        lastTested: Date.now()
      };
    }
  }

  async testConnectivity(proxy, timeout) {
    return new Promise((resolve) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const testConfig = {
        mode: 'fixed_servers',
        rules: {
          singleProxy: {
            scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
            host: proxy.ip,
            port: proxy.port
          },
          bypassList: ['localhost', '127.0.0.1', '::1']
        }
      };

      chrome.proxy.settings.set({ value: testConfig, scope: 'regular' }, async () => {
        try {
          const response = await fetch('https://httpbin.org/ip', {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-store'
          });

          clearTimeout(timeoutId);

          // Restore original proxy settings
          await this.restoreProxySettings();

          resolve({
            success: response.ok,
            status: response.status,
            error: response.ok ? null : `HTTP ${response.status}`
          });

        } catch (error) {
          clearTimeout(timeoutId);

          // Restore original proxy settings
          await this.restoreProxySettings();

          resolve({
            success: false,
            error: error.message
          });
        }
      });
    });
  }

  async measureLatency(proxy, timeout) {
    const latencies = [];

    for (const endpoint of this.speedTestEndpoints) {
      try {
        const latency = await this.measureSingleLatency(proxy, endpoint, timeout);
        if (latency !== null) {
          latencies.push(latency);
        }
      } catch (error) {
        // Skip failed endpoints
      }
    }

    if (latencies.length === 0) {
      return null;
    }

    // Return median latency (more robust than average)
    latencies.sort((a, b) => a - b);
    const mid = Math.floor(latencies.length / 2);
    return latencies.length % 2 !== 0 
      ? latencies[mid] 
      : Math.round((latencies[mid - 1] + latencies[mid]) / 2);
  }

  async measureSingleLatency(proxy, endpoint, timeout) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const testConfig = {
        mode: 'fixed_servers',
        rules: {
          singleProxy: {
            scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
            host: proxy.ip,
            port: proxy.port
          },
          bypassList: ['localhost', '127.0.0.1', '::1']
        }
      };

      chrome.proxy.settings.set({ value: testConfig, scope: 'regular' }, async () => {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-store'
          });

          clearTimeout(timeoutId);

          // Restore original proxy settings
          await this.restoreProxySettings();

          if (response.ok) {
            const latency = Date.now() - startTime;
            resolve(latency);
          } else {
            resolve(null);
          }

        } catch (error) {
          clearTimeout(timeoutId);

          // Restore original proxy settings
          await this.restoreProxySettings();

          resolve(null);
        }
      });
    });
  }

  async testAnonymity(proxy, timeout) {
    try {
      const testConfig = {
        mode: 'fixed_servers',
        rules: {
          singleProxy: {
            scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
            host: proxy.ip,
            port: proxy.port
          },
          bypassList: ['localhost', '127.0.0.1', '::1']
        }
      };

      chrome.proxy.settings.set({ value: testConfig, scope: 'regular' }, async () => {
        try {
          const response = await fetch('https://httpbin.org/headers', {
            method: 'GET',
            signal: AbortSignal.timeout(timeout),
            cache: 'no-store'
          });

          // Restore original proxy settings
          await this.restoreProxySettings();

          if (response.ok) {
            const data = await response.json();
            const headers = data.headers || {};
            
            // Check for proxy-related headers that indicate low anonymity
            const proxyHeaders = [
              'Via', 'X-Forwarded-For', 'X-Real-IP', 
              'Proxy-Connection', 'X-Proxy-ID'
            ];

            const hasProxyHeaders = proxyHeaders.some(header => 
              headers[header] || headers[header.toLowerCase()]
            );

            if (hasProxyHeaders) {
              return 'low';
            }

            // Check if original IP is exposed in any way
            const userAgent = headers['User-Agent'] || '';
            if (userAgent.includes('proxy') || userAgent.includes('bot')) {
              return 'medium';
            }

            return 'high';
          }

          return 'unknown';

        } catch (error) {
          // Restore original proxy settings
          await this.restoreProxySettings();
          return 'unknown';
        }
      });

    } catch (error) {
      return 'unknown';
    }
  }

  async restoreProxySettings() {
    try {
      const result = await chrome.storage.local.get(['activeProxy']);
      if (result.activeProxy) {
        await chrome.runtime.sendMessage({
          action: 'setProxy',
          proxy: result.activeProxy
        });
      } else {
        await chrome.runtime.sendMessage({ action: 'clearProxy' });
      }
    } catch (error) {
      console.error('Failed to restore proxy settings:', error);
    }
  }

  // Get cached validation result
  getCachedResult(proxyIpPort) {
    return this.validationResults.get(proxyIpPort) || null;
  }

  // Check if validation result is still fresh
  isResultFresh(proxyIpPort, maxAge = 300000) { // 5 minutes default
    const result = this.validationResults.get(proxyIpPort);
    if (!result) return false;
    
    return (Date.now() - result.lastTested) < maxAge;
  }

  // Bulk validation with progress tracking
  async validateWithProgress(proxies, options = {}) {
    const { onProgress } = options;
    const total = proxies.length;
    let completed = 0;

    const results = await this.validateProxyList(proxies, options);

    // Simulate progress for each proxy
    for (let i = 0; i < total; i++) {
      completed++;
      if (onProgress) {
        onProgress({
          completed,
          total,
          percentage: Math.round((completed / total) * 100),
          currentProxy: proxies[i]
        });
      }
      await this.sleep(100); // Small delay to allow UI updates
    }

    return results;
  }

  // Cleanup old validation results
  cleanupOldResults() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [ipPort, result] of this.validationResults.entries()) {
      if (now - result.lastTested > maxAge) {
        this.validationResults.delete(ipPort);
      }
    }

    this.saveValidationResults();
  }

  // Utility functions
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  async validateProxy(proxy, options = {}) {
    return this.validateSingleProxy(proxy, options);
  }

  async validateProxies(proxies, options = {}) {
    return this.validateProxyList(proxies, options);
  }

  getValidationStats() {
    const total = this.validationResults.size;
    const valid = Array.from(this.validationResults.values()).filter(r => r.valid).length;
    const invalid = total - valid;

    return {
      total,
      valid,
      invalid,
      successRate: total > 0 ? Math.round((valid / total) * 100) : 0
    };
  }

  clearValidationCache() {
    this.validationResults.clear();
    return this.saveValidationResults();
  }
}

// Export for use in background.js and popup.js
if (typeof module !== 'undefined') {
  module.exports = ProxyValidator;
}

// Note: This module requires explicit initialization after context is ready
// Do not auto-initialize as it may run in service worker context