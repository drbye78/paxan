// PeasyProxy - Proxy Chain Module
// Implements proxy chaining for enhanced privacy

const { THRESHOLDS } = require('../popup/constants.js');

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
const DEFAULT_CHAIN_TIMEOUT = 10000; // 10 seconds

// ============================================================================
// CHAIN MANAGER
// ============================================================================

// Create a new proxy chain
async function createChain(name, proxyIds, options = {}) {
  try {
    const { chains = {} } = await chrome.storage.local.get(['proxyChains']);
    
    if (proxyIds.length < 2) {
      return {
        success: false,
        error: 'Chain must have at least 2 proxies'
      };
    }

    if (proxyIds.length > MAX_CHAIN_LENGTH) {
      return {
        success: false,
        error: `Chain cannot exceed ${MAX_CHAIN_LENGTH} proxies`
      };
    }

    const chain = {
      id: `chain-${Date.now()}`,
      name,
      proxies: proxyIds,
      protocol: options.protocol || CHAIN_PROTOCOLS.SOCKS5,
      timeout: options.timeout || DEFAULT_CHAIN_TIMEOUT,
      fallback: options.fallback || proxyIds[0],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true
    };

    chains[chain.id] = chain;
    await chrome.storage.local.set({ proxyChains: chains });

    return {
      success: true,
      chain,
      message: `Chain "${name}" created`
    };
  } catch (error) {
    console.error('Failed to create chain:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Get chain by ID
async function getChain(chainId) {
  try {
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    
    const chain = proxyChains[chainId];
    if (!chain) {
      return {
        success: false,
        error: `Chain "${chainId}" not found`
      };
    }

    return {
      success: true,
      chain
    };
  } catch (error) {
    console.error('Failed to get chain:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// List all chains
async function listChains() {
  try {
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    
    const chains = Object.values(proxyChains).map(chain => ({
      id: chain.id,
      name: chain.name,
      proxyCount: chain.proxies.length,
      protocol: chain.protocol,
      enabled: chain.enabled,
      createdAt: chain.createdAt
    }));

    return {
      success: true,
      chains
    };
  } catch (error) {
    console.error('Failed to list chains:', error);
    return {
      success: false,
      error: error.message,
      chains: []
    };
  }
}

// Update chain
async function updateChain(chainId, updates) {
  try {
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    
    if (!proxyChains[chainId]) {
      return {
        success: false,
        error: `Chain "${chainId}" not found`
      };
    }

    // Validate proxy list if provided
    if (updates.proxies) {
      if (updates.proxies.length < 2) {
        return {
          success: false,
          error: 'Chain must have at least 2 proxies'
        };
      }

      if (updates.proxies.length > MAX_CHAIN_LENGTH) {
        return {
          success: false,
          error: `Chain cannot exceed ${MAX_CHAIN_LENGTH} proxies`
        };
      }
    }

    proxyChains[chainId] = {
      ...proxyChains[chainId],
      ...updates,
      updatedAt: Date.now()
    };

    await chrome.storage.local.set({ proxyChains });

    return {
      success: true,
      chain: proxyChains[chainId],
      message: 'Chain updated'
    };
  } catch (error) {
    console.error('Failed to update chain:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Delete chain
async function deleteChain(chainId) {
  try {
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    
    if (!proxyChains[chainId]) {
      return {
        success: false,
        error: `Chain "${chainId}" not found`
      };
    }

    delete proxyChains[chainId];
    await chrome.storage.local.set({ proxyChains });

    return {
      success: true,
      message: 'Chain deleted'
    };
  } catch (error) {
    console.error('Failed to delete chain:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// CHAIN EXECUTION
// ============================================================================

// Execute request through proxy chain
async function executeChain(chainId, request) {
  try {
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    const chain = proxyChains[chainId];
    
    if (!chain) {
      throw new Error(`Chain "${chainId}" not found`);
    }

    if (!chain.enabled) {
      throw new Error('Chain is disabled');
    }

    // Get proxy details for each hop
    const { proxies = [] } = await chrome.storage.local.get(['proxies']);
    const chainProxies = chain.proxies.map(proxyId => 
      proxies.find(p => p.ipPort === proxyId)
    ).filter(Boolean);

    if (chainProxies.length < 2) {
      throw new Error('Not enough valid proxies in chain');
    }

    // Execute through chain
    const result = await executeChainRequest(chainProxies, request, chain);
    
    return {
      success: true,
      result,
      hops: chainProxies.length,
      chain: chain.name
    };
  } catch (error) {
    console.error('Chain execution failed:', error);
    
    // Try fallback
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    const chain = proxyChains[chainId];
    
    if (chain?.fallback) {
      try {
        const { proxies = [] } = await chrome.storage.local.get(['proxies']);
        const fallbackProxy = proxies.find(p => p.ipPort === chain.fallback);
        
        if (fallbackProxy) {
          return {
            success: true,
            result: await executeSingleProxy(fallbackProxy, request),
            fallback: true,
            originalError: error.message
          };
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute request through chain of proxies
async function executeChainRequest(proxies, request, chain) {
  // Note: Real proxy chaining requires SOCKS5 support at each hop
  // This is a simplified implementation that tests each proxy in sequence
  
  const results = [];
  
  for (let i = 0; i < proxies.length; i++) {
    const proxy = proxies[i];
    const isLastHop = i === proxies.length - 1;
    
    try {
      const hopResult = await executeSingleProxy(proxy, request, {
        timeout: chain.timeout / proxies.length,
        hopIndex: i
      });
      
      results.push({
        hop: i + 1,
        proxy: proxy.ipPort,
        success: true,
        latency: hopResult.latency
      });
      
      // If last hop, return the result
      if (isLastHop) {
        return {
          success: true,
          response: hopResult.response,
          hops: results,
          totalLatency: results.reduce((sum, r) => sum + (r.latency || 0), 0)
        };
      }
    } catch (error) {
      results.push({
        hop: i + 1,
        proxy: proxy.ipPort,
        success: false,
        error: error.message
      });
      
      throw new Error(`Hop ${i + 1} failed: ${error.message}`);
    }
  }
}

// Execute request through single proxy
async function executeSingleProxy(proxy, request, options = {}) {
  const testConfig = {
    mode: 'fixed_servers',
    rules: {
      singleProxy: {
        scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
        host: proxy.ip,
        port: proxy.port
      },
      bypassList: ['localhost', '127.0.0.1']
    }
  };

  const startTime = Date.now();
  
  try {
    await chrome.proxy.settings.set({ value: testConfig, scope: 'regular' });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || DEFAULT_CHAIN_TIMEOUT
    );
    
    const response = await fetch(request.url || 'https://httpbin.org/ip', {
      method: request.method || 'GET',
      headers: request.headers || {},
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    
    const latency = Date.now() - startTime;
    
    await chrome.proxy.settings.clear({ scope: 'regular' });
    
    return {
      success: response.ok,
      status: response.status,
      latency,
      response: await response.text()
    };
  } catch (error) {
    await chrome.proxy.settings.clear({ scope: 'regular' });
    throw error;
  }
}

// ============================================================================
// CHAIN TESTING
// ============================================================================

// Test proxy chain
async function testChain(chainId) {
  try {
    const { proxyChains = {} } = await chrome.storage.local.get(['proxyChains']);
    const chain = proxyChains[chainId];
    
    if (!chain) {
      return {
        success: false,
        error: `Chain "${chainId}" not found`
      };
    }

    const { proxies = [] } = await chrome.storage.local.get(['proxies']);
    const chainProxies = chain.proxies.map(proxyId => 
      proxies.find(p => p.ipPort === proxyId)
    ).filter(Boolean);

    if (chainProxies.length < 2) {
      return {
        success: false,
        error: 'Not enough valid proxies in chain'
      };
    }

    // Test each hop
    const hopTests = [];
    let cumulativeLatency = 0;

    for (let i = 0; i < chainProxies.length; i++) {
      const proxy = chainProxies[i];
      
      try {
        const testResult = await testProxyHop(proxy, {
          timeout: chain.timeout / chainProxies.length
        });
        
        cumulativeLatency += testResult.latency;
        
        hopTests.push({
          hop: i + 1,
          proxy: proxy.ipPort,
          success: true,
          latency: testResult.latency,
          cumulativeLatency
        });
      } catch (error) {
        hopTests.push({
          hop: i + 1,
          proxy: proxy.ipPort,
          success: false,
          error: error.message
        });
        
        return {
          success: false,
          error: `Hop ${i + 1} failed: ${error.message}`,
          hopTests
        };
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
    return {
      success: false,
      error: error.message
    };
  }
}

// Test single proxy hop
async function testProxyHop(proxy, options = {}) {
  const testConfig = {
    mode: 'fixed_servers',
    rules: {
      singleProxy: {
        scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
        host: proxy.ip,
        port: proxy.port
      },
      bypassList: ['localhost', '127.0.0.1']
    }
  };

  const startTime = Date.now();
  
  try {
    await chrome.proxy.settings.set({ value: testConfig, scope: 'regular' });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || 5000
    );
    
    const response = await fetch('https://httpbin.org/ip', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    
    const latency = Date.now() - startTime;
    
    await chrome.proxy.settings.clear({ scope: 'regular' });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return {
      success: true,
      latency
    };
  } catch (error) {
    await chrome.proxy.settings.clear({ scope: 'regular' });
    throw error;
  }
}

// ============================================================================
// CHAIN MONITORING
// ============================================================================

// Monitor chain performance
async function monitorChain(chainId) {
  try {
    const testResult = await testChain(chainId);
    
    if (!testResult.success) {
      return {
        success: false,
        error: testResult.error
      };
    }

    // Save monitoring result
    const { chainHistory = [] } = await chrome.storage.local.get(['chainHistory']);
    
    chainHistory.unshift({
      chainId,
      timestamp: Date.now(),
      totalLatency: testResult.totalLatency,
      averageLatency: testResult.averageLatency,
      hopCount: testResult.hopTests.length,
      success: true
    });

    // Keep only last 100 entries
    if (chainHistory.length > 100) {
      chainHistory.length = 100;
    }

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
    return {
      success: false,
      error: error.message
    };
  }
}

// Get chain statistics
async function getChainStats(chainId) {
  try {
    const { chainHistory = [] } = await chrome.storage.local.get(['chainHistory']);
    
    const chainEntries = chainHistory.filter(entry => entry.chainId === chainId);
    
    if (chainEntries.length === 0) {
      return {
        success: true,
        stats: {
          totalTests: 0,
          averageLatency: 0,
          successRate: 0,
          lastTest: null
        }
      };
    }

    const successfulTests = chainEntries.filter(entry => entry.success);
    const totalLatency = successfulTests.reduce((sum, entry) => sum + entry.totalLatency, 0);

    return {
      success: true,
      stats: {
        totalTests: chainEntries.length,
        successfulTests: successfulTests.length,
        averageLatency: successfulTests.length > 0 
          ? Math.round(totalLatency / successfulTests.length) 
          : 0,
        successRate: Math.round((successfulTests.length / chainEntries.length) * 100),
        lastTest: chainEntries[0].timestamp
      }
    };
  } catch (error) {
    console.error('Failed to get chain stats:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Configuration
  CHAIN_PROTOCOLS,
  MAX_CHAIN_LENGTH,
  
  // Manager
  createChain,
  getChain,
  listChains,
  updateChain,
  deleteChain,
  
  // Execution
  executeChain,
  executeChainRequest,
  executeSingleProxy,
  
  // Testing
  testChain,
  testProxyHop,
  
  // Monitoring
  monitorChain,
  getChainStats
};