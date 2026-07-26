// ============================================================================
// PeasyProxy - Proxy Configuration Manager
// Single authority for all chrome.proxy.settings modifications.
// Serial queue prevents races between user proxy, health checks, and tests.
// ============================================================================

import { buildProxyConfig } from '../shared/utils.js';

/**
 * Minimal promise timeout helper — rejects if promise doesn't settle within ms.
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    )
  ]);
}

class ProxyConfigManager {
  constructor() {
    this._queue = Promise.resolve();
    this._busyCount = 0;
  }

  // Serialize all proxy-setting operations through a promise chain.
  // If fn throws, we catch and empty the rejection so the queue doesn't stall.
  _enqueue(fn) {
    this._busyCount++;
    const task = this._queue.then(() => fn());
    this._queue = task.catch(() => {}).finally(() => { this._busyCount--; });
    return task;
  }

  /**
   * Check if any operation is currently holding the proxy-setting queue.
   */
  get isBusy() {
    return this._busyCount > 0;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Set the user's proxy. Records the config so health/test operations
   * know what to restore afterward.
   * @param {Object} proxy — { ip, port, type }
   */
  async setUserProxy(proxy) {
    const config = buildProxyConfig(proxy);
    return this._enqueue(async () => {
      await this._set(config);
    });
  }

  /**
   * Clear the user's proxy (restore system defaults).
   */
  async clearUserProxy() {
    return this._enqueue(async () => {
      await this._clear();
    });
  }

  /**
   * Run a test function with a temporary proxy config.
   * Saves current config → sets test config → runs fn → restores.
   * If fn throws, still restores via finally.
   *
   * @param {Object|null} testConfig — chrome.proxy.settings value (or null to test direct)
   * @param {Function} fn — async function to run with the test config active
   * @param {Object} [opts]
   * @param {number} [opts.timeoutMs=10000] — max time fn is allowed to run
   * @param {number} [opts.settleMs=100] — delay after setting proxy for Chrome to apply
   * @returns result of fn()
   */
  async withTestConfig(testConfig, fn, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 10000;
    const settleMs = opts.settleMs ?? 0;
    return this._enqueue(async () => {
      const saved = await this._get();
      try {
        if (testConfig) {
          await this._set(testConfig);
          if (settleMs > 0) await new Promise(r => setTimeout(r, settleMs));
        } else {
          await this._clear();
          if (settleMs > 0) await new Promise(r => setTimeout(r, settleMs));
        }
        const result = await withTimeout(fn(), timeoutMs);
        return result;
      } finally {
        // Always restore what was active before
        if (saved?.value) {
          await this._set(saved.value);
        } else {
          await this._clear();
        }
      }
    });
  }

  /**
   * Run a fetch operation WITHOUT any proxy.
   * Temporarily clears proxy settings, runs fn, restores.
   * Use for getting the real IP address, baseline fetches, etc.
   *
   * @param {Function} fn — async function (typically a fetch)
   * @returns result of fn()
   */
  async fetchDirect(fn) {
    return this._enqueue(async () => {
      const saved = await this._get();
      try {
        await this._clear();
        return await fn();
      } finally {
        if (saved?.value) {
          await this._set(saved.value);
        } else {
          await this._clear();
        }
      }
    });
  }

  /**
   * Get the current proxy settings.
   */
  async getCurrentConfig() {
    return new Promise(resolve =>
      chrome.proxy.settings.get({ scope: 'regular' }, resolve)
    );
  }

  // --------------------------------------------------------------------------
  // Internal: promisified chrome.proxy.settings wrappers
  // --------------------------------------------------------------------------

  _get() {
    return new Promise(resolve =>
      chrome.proxy.settings.get({ scope: 'regular' }, resolve)
    );
  }

  _set(value) {
    return new Promise((resolve, reject) =>
      chrome.proxy.settings.set({ value, scope: 'regular' }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      })
    );
  }

  _clear() {
    return new Promise((resolve, reject) =>
      chrome.proxy.settings.clear({ scope: 'regular' }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      })
    );
  }
}

// Singleton — the ONLY place that calls chrome.proxy.settings
const proxyConfig = new ProxyConfigManager();

export { proxyConfig, ProxyConfigManager };
