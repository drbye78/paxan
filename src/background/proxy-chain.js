// PeasyProxy - Proxy Chain Module
// Creates and manages proxy chains. Testing uses proxyConfig for safety.
//

import { proxyConfig } from './proxy-config-manager.js';
import { buildProxyConfig } from '../shared/utils.js';

// ============================================================================
// CHAIN CONFIGURATION
// ============================================================================

const CHAIN_PROTOCOLS = {
  HTTP: 'http',
  HTTPS: 'https',
  SOCKS4: 'socks4',
  SOCKS5: 'socks5'
};

const MAX_CHAIN_LENGTH = 5;
const DEFAULT_CHAIN_TIMEOUT = 10000;

// ============================================================================
// CHAIN MANAGER (CRUD — kept as-is, solid)
// ============================================================================

async function createChain(name, proxyIds, options = {}) {
  try {
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    
    if (proxyIds.length < 2) {
      return { success: false, error: 'Chain must have at least 2 proxies' };
    }
    if (proxyIds.length > MAX_CHAIN_LENGTH) {
      return { success: false, error: `Chain cannot exceed ${MAX_CHAIN_LENGTH} proxies` };
    }

    // Validate proxy IDs exist
    const { proxies = [] } = await chrome.storage.local.get(['proxies']);
    const invalidIds = proxyIds.filter(id => !proxies.some(p => p.ipPort === id));
    if (invalidIds.length > 0) {
      return { success: false, error: `Invalid proxy IDs: ${invalidIds.join(', ')}` };
    }

    const chain = {
      id: `chain-${Date.now()}`,
      name,
      proxies: proxyIds,
      protocol: options.protocol || CHAIN_PROTOCOLS.SOCKS5,
      timeout: options.timeout || DEFAULT_CHAIN_TIMEOUT,
      fallback: options.fallback || null,  // no longer defaults to first proxy (broken fallback)
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true
    };

    const allChains = { ...proxyChains, [chain.id]: chain };
    await chrome.storage.local.set({ proxyChains: allChains });

    return { success: true, chain, message: `Chain "${name}" created` };
  } catch (error) {
    console.error('Failed to create chain:', error);
    return { success: false, error: error.message };
  }
}

async function getChain(chainId) {
  try {
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    const chain = proxyChains[chainId];
    if (!chain) return { success: false, error: `Chain "${chainId}" not found` };
    return { success: true, chain };
  } catch (error) {
    console.error('Failed to get chain:', error);
    return { success: false, error: error.message };
  }
}

async function listChains() {
  try {
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    const chains = Object.values(proxyChains).map(c => ({
      id: c.id, name: c.name, proxyCount: c.proxies.length,
      protocol: c.protocol, enabled: c.enabled, createdAt: c.createdAt
    }));
    return { success: true, chains };
  } catch (error) {
    console.error('Failed to list chains:', error);
    return { success: false, error: error.message, chains: [] };
  }
}

async function updateChain(chainId, updates) {
  try {
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    if (!proxyChains[chainId]) return { success: false, error: `Chain "${chainId}" not found` };

    if (updates.proxies) {
      if (updates.proxies.length < 2) return { success: false, error: 'Chain must have at least 2 proxies' };
      if (updates.proxies.length > MAX_CHAIN_LENGTH) return { success: false, error: `Chain cannot exceed ${MAX_CHAIN_LENGTH} proxies` };
    }

    proxyChains[chainId] = { ...proxyChains[chainId], ...updates, updatedAt: Date.now() };
    await chrome.storage.local.set({ proxyChains });

    return { success: true, chain: proxyChains[chainId], message: 'Chain updated' };
  } catch (error) {
    console.error('Failed to update chain:', error);
    return { success: false, error: error.message };
  }
}

async function deleteChain(chainId) {
  try {
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    if (!proxyChains[chainId]) return { success: false, error: `Chain "${chainId}" not found` };
    delete proxyChains[chainId];
    await chrome.storage.local.set({ proxyChains });
    return { success: true, message: 'Chain deleted' };
  } catch (error) {
    console.error('Failed to delete chain:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// CHAIN EXECUTION — refactored to use proxyConfig
// ============================================================================

/**
 * Test a single proxy through the proxy chain manager.
 * Uses proxyConfig.withTestConfig to safely set/restore proxy settings.
 */
async function executeSingleProxy(proxy, request, options = {}) {
  const startTime = Date.now();
  const testConfig = buildProxyConfig(proxy);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_CHAIN_TIMEOUT);

  try {
    return await proxyConfig.withTestConfig(testConfig, async () => {
      const response = await fetch(request.url || 'https://httpbin.org/ip', {
        method: request.method || 'GET',
        headers: request.headers || {},
        signal: controller.signal,
        cache: 'no-store'
      });
      const latency = Date.now() - startTime;
      return {
        success: response.ok,
        status: response.status,
        latency,
        response: await response.text()
      };
    }, { timeoutMs: 12000, settleMs: 50 });
  } catch (error) {
    return { success: false, status: 0, latency: null, error: error.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Test each proxy in the chain sequentially using proxyConfig.withTestConfig.
 * Note: This tests each proxy individually (not actual chaining through SOCKS5).
 * True chaining requires server-side relay support.
 */
async function testChain(chainId) {
  try {
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    const chain = proxyChains[chainId];
    if (!chain) return { success: false, error: `Chain "${chainId}" not found` };

    const { proxies = [] } = await chrome.storage.local.get(['proxies']);
    const chainProxies = chain.proxies
      .map(id => proxies.find(p => p.ipPort === id))
      .filter(Boolean);

    if (chainProxies.length < 2) return { success: false, error: 'Not enough valid proxies in chain' };

    const hopTests = [];
    let cumulativeLatency = 0;

    for (let i = 0; i < chainProxies.length; i++) {
      const proxy = chainProxies[i];
      try {
        const testConfig = buildProxyConfig(proxy);
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), (chain.timeout / chainProxies.length) || 5000);

        const result = await proxyConfig.withTestConfig(testConfig, async () => {
          const response = await fetch('https://httpbin.org/ip', {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store'
          });
          clearTimeout(timeoutId);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return { success: true, latency: Date.now() - startTime };
        }, { timeoutMs: 8000, settleMs: 50 });

        cumulativeLatency += result.latency;
        hopTests.push({ hop: i + 1, proxy: proxy.ipPort, success: true, latency: result.latency, cumulativeLatency });
      } catch (error) {
        clearTimeout(typeof timeoutId !== 'undefined' ? timeoutId : 0); // best-effort
        hopTests.push({ hop: i + 1, proxy: proxy.ipPort, success: false, error: error.message });
        return { success: false, error: `Hop ${i + 1} failed: ${error.message}`, hopTests };
      }
    }

    return {
      success: true,
      chain: chain.name,
      hopTests,
      totalLatency: cumulativeLatency,
      averageLatency: Math.round(cumulativeLatency / chainProxies.length)
    };
  } catch (error) {
    console.error('Chain test failed:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// CHAIN MONITORING
// ============================================================================

/**
 * Monitor chain performance. Capped at 50 entries to stay under storage quota.
 */
async function monitorChain(chainId) {
  try {
    const testResult = await testChain(chainId);
    if (!testResult.success) return { success: false, error: testResult.error };

    const { chainHistory = [] } = await chrome.storage.local.get(['chainHistory']);
    chainHistory.unshift({
      chainId,
      timestamp: Date.now(),
      totalLatency: testResult.totalLatency,
      averageLatency: testResult.averageLatency,
      hopCount: testResult.hopTests.length,
      success: true
    });

    // Capped at 50 to stay under storage quota
    if (chainHistory.length > 50) chainHistory.length = 50;
    await chrome.storage.local.set({ chainHistory });

    return {
      success: true,
      monitoring: {
        totalLatency: testResult.totalLatency,
        averageLatency: testResult.averageLatency,
        hopCount: testResult.hopTests.length
      }
    };
  } catch (error) {
    console.error('Chain monitoring failed:', error);
    return { success: false, error: error.message };
  }
}

async function getChainStats(chainId) {
  try {
    const { chainHistory = [] } = await chrome.storage.local.get(['chainHistory']);
    const chainEntries = chainHistory.filter(e => e.chainId === chainId);
    if (chainEntries.length === 0) {
      return { success: true, stats: { totalTests: 0, averageLatency: 0, successRate: 0, lastTest: null } };
    }

    const successful = chainEntries.filter(e => e.success);
    const totalLatency = successful.reduce((s, e) => s + e.totalLatency, 0);

    return {
      success: true,
      stats: {
        totalTests: chainEntries.length,
        successfulTests: successful.length,
        averageLatency: successful.length > 0 ? Math.round(totalLatency / successful.length) : 0,
        successRate: Math.round((successful.length / chainEntries.length) * 100),
        lastTest: chainEntries[0].timestamp
      }
    };
  } catch (error) {
    console.error('Failed to get chain stats:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  CHAIN_PROTOCOLS,
  MAX_CHAIN_LENGTH,
  createChain,
  getChain,
  listChains,
  updateChain,
  deleteChain,
  executeSingleProxy,
  testChain,
  monitorChain,
  getChainStats
};
