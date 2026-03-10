// ProxyMania VPN - Background Script (Phase 2)

// Proxy Failover Manager
class ProxyFailoverManager {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
    this.failoverQueue = [];
  }
  
  setProxies(proxies, currentProxy) {
    // Create queue of backup proxies (excluding current)
    this.failoverQueue = proxies
      .filter(p => p.ipPort !== currentProxy.ipPort)
      .sort((a, b) => a.speedMs - b.speedMs);
  }
  
  getNextProxy() {
    if (this.failoverQueue.length === 0) {
      return null;
    }
    return this.failoverQueue.shift();
  }
  
  reset() {
    this.retryCount = 0;
    this.failoverQueue = [];
  }
}

const failoverManager = new ProxyFailoverManager();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'setProxy') {
    setProxy(request.proxy)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'clearProxy') {
    clearProxy()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getProxy') {
    getProxy()
      .then(config => sendResponse({ config }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'fetchProxies') {
    fetchProxies()
      .then(proxies => sendResponse({ proxies }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'testProxy') {
    testProxyConnectivity(request.proxy)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'updateProxyStats') {
    updateProxyStats(request.proxy, request.success, request.latency)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getProxyStats') {
    getProxyStats()
      .then(stats => sendResponse({ stats }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'startMonitoring') {
    startProxyMonitoring(request.proxy)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'stopMonitoring') {
    stopProxyMonitoring();
    sendResponse({ success: true });
    return false;
  }
  
  if (request.action === 'setFailoverProxies') {
    failoverManager.setProxies(request.proxies, request.currentProxy);
    sendResponse({ success: true });
    return false;
  }
  
  if (request.action === 'getNextFailoverProxy') {
    const proxy = failoverManager.getNextProxy();
    sendResponse({ proxy });
    return false;
  }
  
  if (request.action === 'resetFailover') {
    failoverManager.reset();
    sendResponse({ success: true });
    return false;
  }
});

// Fetch proxies from ProxyMania
async function fetchProxies() {
  const response = await fetch('https://proxymania.su/free-proxy');
  if (!response.ok) {
    throw new Error('Failed to fetch proxies: ' + response.statusText);
  }
  const html = await response.text();
  const proxies = parseProxies(html);
  return proxies;
}

// Parse proxies from HTML
function parseProxies(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const proxyItems = [];
  
  const table = doc.querySelector('table');
  if (!table) return proxyItems;
  
  const rows = table.querySelectorAll('tbody tr');
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 6) {
      const ipPort = cells[0].textContent.trim();
      const country = cells[1].textContent.trim();
      const type = cells[2].textContent.trim();
      const anonymity = cells[3].textContent.trim();
      const speed = cells[4].textContent.trim();
      const lastCheck = cells[5].textContent.trim();
      
      const [ip, port] = ipPort.split(':');
      
      if (ip && port && !isNaN(parseInt(port))) {
        proxyItems.push({
          ip,
          port: parseInt(port),
          ipPort,
          country,
          type,
          anonymity,
          speed,
          lastCheck,
          speedMs: parseSpeed(speed)
        });
      }
    }
  });
  
  return proxyItems;
}

// Parse speed string to milliseconds
function parseSpeed(speedStr) {
  const match = speedStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 9999;
}

// Test proxy connectivity - REAL TEST
async function testProxyConnectivity(proxy) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Create a test configuration
    const testConfig = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
          host: proxy.ip,
          port: proxy.port
        },
        bypassList: []
      }
    };
    
    // Set the proxy temporarily for testing
    chrome.proxy.settings.set({ value: testConfig, scope: 'regular' }, () => {
      // Test with a lightweight request
      fetch('http://www.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      })
      .then(response => {
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;
        
        // Restore previous proxy settings
        clearProxyInternal();
        
        resolve({
          success: response.ok || response.status === 204,
          latency: latency,
          status: response.status,
          working: response.ok || response.status === 204
        });
      })
      .catch(error => {
        clearTimeout(timeoutId);
        
        // Restore previous proxy settings
        clearProxyInternal();
        
        resolve({
          success: false,
          latency: null,
          status: null,
          working: false,
          error: error.message
        });
      });
    });
  });
}

// Internal clear proxy without returning promise
function clearProxyInternal() {
  chrome.proxy.settings.clear({ scope: 'regular' }, () => {});
}

// Set proxy configuration
async function setProxy(proxy) {
  return new Promise((resolve, reject) => {
    const proxyConfig = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
          host: proxy.ip,
          port: proxy.port
        },
        bypassList: [
          'localhost', '127.0.0.1', '::1', '*.local',
          '192.168.*', '10.*', '172.16.*', '172.17.*',
          '172.18.*', '172.19.*', '172.20.*', '172.21.*',
          '172.22.*', '172.23.*', '172.24.*', '172.25.*',
          '172.26.*', '172.27.*', '172.28.*', '172.29.*',
          '172.30.*', '172.31.*'
        ]
      }
    };
    
    chrome.proxy.settings.set(
      { value: proxyConfig, scope: 'regular' },
      (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('Proxy set successfully:', proxy.ipPort);
          resolve(result);
        }
      }
    );
  });
}

// Clear proxy configuration
async function clearProxy() {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.clear(
      { scope: 'regular' },
      (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('Proxy cleared successfully');
          resolve(result);
        }
      }
    );
  });
}

// Get current proxy configuration
async function getProxy() {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.get(
      { scope: 'regular' },
      (config) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(config);
        }
      }
    );
  });
}

// Update proxy statistics
async function updateProxyStats(proxy, success, latency) {
  try {
    const { proxyStats = {} } = await chrome.storage.local.get(['proxyStats']);
    const key = proxy.ipPort;
    
    if (!proxyStats[key]) {
      proxyStats[key] = { 
        attempts: 0, 
        successes: 0, 
        failures: 0,
        latencies: [],
        lastFailure: null,
        lastSuccess: null
      };
    }
    
    proxyStats[key].attempts++;
    
    if (success) {
      proxyStats[key].successes++;
      proxyStats[key].lastSuccess = Date.now();
      
      // Track latency for history (keep last 20)
      if (latency) {
        proxyStats[key].latencies.push(latency);
        if (proxyStats[key].latencies.length > 20) {
          proxyStats[key].latencies.shift();
        }
      }
    } else {
      proxyStats[key].failures++;
      proxyStats[key].lastFailure = Date.now();
    }
    
    // Calculate success rate
    proxyStats[key].successRate = Math.round(
      (proxyStats[key].successes / proxyStats[key].attempts) * 100
    );
    
    // Calculate average latency
    const latencies = proxyStats[key].latencies;
    proxyStats[key].avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;
    
    await chrome.storage.local.set({ proxyStats });
  } catch (error) {
    console.error('Error updating proxy stats:', error);
  }
}

// Get proxy statistics
async function getProxyStats() {
  try {
    const { proxyStats = {} } = await chrome.storage.local.get(['proxyStats']);
    return proxyStats;
  } catch (error) {
    console.error('Error getting proxy stats:', error);
    return {};
  }
}

// Continuous monitoring while connected
let monitoringInterval = null;
let currentMonitoringProxy = null;

async function startProxyMonitoring(proxy) {
  stopProxyMonitoring(); // Clear any existing interval
  
  currentMonitoringProxy = proxy;
  
  monitoringInterval = setInterval(async () => {
    try {
      const result = await testProxyConnectivity(proxy);
      
      // Update stats
      await updateProxyStats(proxy, result.success, result.latency);
      
      // Notify popup if degraded
      if (!result.success || (result.latency && result.latency > 500)) {
        chrome.runtime.sendMessage({ 
          action: 'proxyDegraded', 
          proxy: {
            ipPort: proxy.ipPort,
            country: proxy.country
          },
          latency: result.latency,
          success: result.success
        }).catch(() => {}); // Ignore if popup is closed
      }
    } catch (error) {
      console.error('Monitoring error:', error);
    }
  }, 30000); // Check every 30 seconds
  
  console.log('Started monitoring for:', proxy.ipPort);
}

function stopProxyMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('Stopped proxy monitoring');
  }
  currentMonitoringProxy = null;
}

// Restore proxy on extension startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    const result = await chrome.storage.local.get(['activeProxy']);
    if (result.activeProxy) {
      await setProxy(result.activeProxy);
      console.log('Restored proxy:', result.activeProxy.ipPort);
    }
  } catch (error) {
    console.error('Error restoring proxy:', error);
  }
});

// Restore on install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('ProxyMania VPN installed');
  } else if (details.reason === 'update') {
    console.log('ProxyMania VPN updated');
    try {
      const result = await chrome.storage.local.get(['activeProxy']);
      if (result.activeProxy) {
        await setProxy(result.activeProxy);
      }
    } catch (error) {
      console.error('Error restoring proxy after update:', error);
    }
  }
});

// Clean up on service worker shutdown
self.addEventListener('unload', () => {
  stopProxyMonitoring();
});
