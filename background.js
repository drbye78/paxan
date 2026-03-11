// ProxyMania VPN - Background Script (Phase 2+)
// Enhanced with Security, Error Handling, and Onboarding

// Import modules
import './src/modules/security.js';
import './src/modules/errorHandler.js';
import './src/modules/onboarding.js';
import './src/modules/health.js';

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
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  try {
    // Enhanced error handling for all operations
    switch (request.action) {
      case 'setProxy':
        await setProxy(request.proxy);
        sendResponse({ success: true });
        break;
        
      case 'clearProxy':
        await clearProxy();
        sendResponse({ success: true });
        break;
        
      case 'getProxy':
        const config = await getProxy();
        sendResponse({ config });
        break;
        
      case 'fetchProxies':
        const proxies = await fetchProxies();
        sendResponse({ proxies });
        break;
        
      case 'testProxy':
        const result = await testProxyConnectivity(request.proxy);
        sendResponse(result);
        break;
        
      case 'updateProxyStats':
        await updateProxyStats(request.proxy, request.success, request.latency);
        sendResponse({ success: true });
        break;
        
      case 'getProxyStats':
        const stats = await getProxyStats();
        sendResponse({ stats });
        break;
        
      case 'startMonitoring':
        await startProxyMonitoring(request.proxy);
        sendResponse({ success: true });
        break;
        
      case 'stopMonitoring':
        stopProxyMonitoring();
        sendResponse({ success: true });
        break;
        
      case 'setFailoverProxies':
        failoverManager.setProxies(request.proxies, request.currentProxy);
        sendResponse({ success: true });
        break;
        
      case 'getNextFailoverProxy':
        const proxy = failoverManager.getNextProxy();
        sendResponse({ proxy });
        break;
        
      case 'resetFailover':
        failoverManager.reset();
        sendResponse({ success: true });
        break;
        
      // Security module messages
      case 'toggleDnsLeakProtection':
        const dnsResult = await securityManager.toggleDnsLeakProtection(request.enabled);
        sendResponse(dnsResult);
        break;
        
      case 'toggleWebRtcProtection':
        const webRtcResult = await securityManager.toggleWebRtcProtection(request.enabled);
        sendResponse(webRtcResult);
        break;
        
      case 'getSecurityStatus':
        const securityStatus = securityManager.getSecurityStatus();
        sendResponse(securityStatus);
        break;
        
      case 'resetSecurityAlerts':
        securityManager.resetSecurityAlerts();
        sendResponse({ success: true });
        break;
        
      // Error handling messages
      case 'handleProxyError':
        await errorHandler.handleProxyError(request.error, request.proxy);
        sendResponse({ success: true });
        break;
        
      case 'clearErrorLogs':
        const clearResult = await errorHandler.clearErrorLogs();
        sendResponse(clearResult);
        break;
        
      case 'getStoredErrors':
        const errors = await errorHandler.getStoredErrors();
        sendResponse({ errors });
        break;
        
      // Onboarding messages
      case 'startOnboarding':
        onboardingManager.startOnboarding();
        sendResponse({ success: true });
        break;
        
      case 'completeOnboarding':
        onboardingManager.completeOnboarding();
        sendResponse({ success: true });
        break;
        
      case 'getOnboardingState':
        const onboardingState = {
          completed: onboardingManager.isCompleted,
          currentStepIndex: onboardingManager.currentStepIndex,
          version: onboardingManager.version
        };
        sendResponse(onboardingState);
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    // Enhanced error handling
    console.error('Background script error:', error);
    
    // Handle specific error types
    if (error.message.includes('proxy')) {
      await errorHandler.handleProxyError(error);
    } else if (error.message.includes('network')) {
      await errorHandler.handleNetworkError(error);
    } else if (error.message.includes('storage')) {
      await errorHandler.handleStorageError(error);
    } else {
      await errorHandler.handleProxyError(error);
    }
    
    sendResponse({ success: false, error: error.message });
  }
  
  return true;
});

// Fetch proxies from ProxyMania
async function fetchProxies() {
  try {
    const response = await fetch('https://proxymania.su/free-proxy');
    if (!response.ok) {
      throw new Error('Failed to fetch proxies: ' + response.statusText);
    }
    const html = await response.text();
    const proxies = parseProxies(html);
    
    // Enhanced proxy validation
    const validatedProxies = proxies.filter(proxy => {
      return proxy.ip && proxy.port && proxy.country && proxy.type;
    });
    
    console.log(`Fetched ${validatedProxies.length} valid proxies`);
    return validatedProxies;
  } catch (error) {
    console.error('Error fetching proxies:', error);
    throw error;
  }
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

// Test proxy connectivity - Enhanced with Security Checks
async function testProxyConnectivity(proxy) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Enhanced test configuration with security bypasses
    const testConfig = {
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
          '172.30.*', '172.31.*',
          // Security bypasses
          'chrome-extension://*', 'chrome://*',
          'https://proxymania.su'
        ]
      }
    };
    
    // Set the proxy temporarily for testing
    chrome.proxy.settings.set({ value: testConfig, scope: 'regular' }, () => {
      // Enhanced test with multiple endpoints
      const testUrls = [
        'http://www.google.com/generate_204',
        'https://httpbin.org/ip',
        'http://connectivitycheck.gstatic.com/generate_204'
      ];
      
      const testNext = (index = 0) => {
        if (index >= testUrls.length) {
          clearTimeout(timeoutId);
          clearProxyInternal();
          resolve({
            success: false,
            latency: null,
            status: null,
            working: false,
            error: 'All test endpoints failed'
          });
          return;
        }
        
        fetch(testUrls[index], {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
          timeout: 3000
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
            working: response.ok || response.status === 204,
            endpoint: testUrls[index]
          });
        })
        .catch(error => {
          // Try next endpoint
          testNext(index + 1);
        });
      };
      
      testNext();
    });
  });
}

// Internal clear proxy without returning promise
function clearProxyInternal() {
  chrome.proxy.settings.clear({ scope: 'regular' }, () => {});
}

// Set proxy configuration - Enhanced with Security
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
          '172.30.*', '172.31.*',
          // Security bypasses for extension functionality
          'chrome-extension://*', 'chrome://*',
          'https://proxymania.su',
          // DNS leak prevention bypasses
          'https://dns.google/*', 'https://cloudflare-dns.com/*'
        ]
      }
    };
    
    chrome.proxy.settings.set(
      { value: proxyConfig, scope: 'regular' },
      (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to set proxy:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('Proxy set successfully:', proxy.ipPort);
          
          // Update security status
          if (securityManager) {
            securityManager.resetSecurityAlerts();
          }
          
          resolve(result);
        }
      }
    );
  });
}

// Clear proxy configuration - Enhanced with Security Reset
async function clearProxy() {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.clear(
      { scope: 'regular' },
      (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to clear proxy:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('Proxy cleared successfully');
          
          // Reset security monitoring
          if (securityManager) {
            securityManager.resetSecurityAlerts();
          }
          
          // Stop monitoring
          stopProxyMonitoring();
          
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

// Continuous monitoring while connected - Enhanced with Security & Health
let monitoringInterval = null;
let currentMonitoringProxy = null;
let monitoringStartTime = null;

async function startProxyMonitoring(proxy) {
  stopProxyMonitoring(); // Clear any existing interval
  
  currentMonitoringProxy = proxy;
  monitoringStartTime = Date.now();
  
  // Start enhanced monitoring
  monitoringInterval = setInterval(async () => {
    try {
      // Basic connectivity test
      const result = await testProxyConnectivity(proxy);
      
      // Update stats
      await updateProxyStats(proxy, result.success, result.latency);
      
      // Enhanced monitoring with security checks
      if (securityManager) {
        await securityManager.performSecurityCheck();
      }
      
      // Health monitoring
      if (healthMonitor) {
        await healthMonitor.performHealthCheck();
      }
      
      // Notify popup if degraded
      if (!result.success || (result.latency && result.latency > 500)) {
        chrome.runtime.sendMessage({ 
          action: 'proxyDegraded', 
          proxy: {
            ipPort: proxy.ipPort,
            country: proxy.country
          },
          latency: result.latency,
          success: result.success,
          monitoringTime: Date.now() - monitoringStartTime
        }).catch(() => {}); // Ignore if popup is closed
      }
    } catch (error) {
      console.error('Monitoring error:', error);
      
      // Handle monitoring errors
      if (errorHandler) {
        await errorHandler.handleProxyError(error, proxy);
      }
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
  monitoringStartTime = null;
  
  // Stop health monitoring
  if (healthMonitor) {
    healthMonitor.stopHealthMonitoring();
  }
}

// Restore proxy on extension startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    const result = await chrome.storage.local.get(['activeProxy']);
    if (result.activeProxy) {
      await setProxy(result.activeProxy);
      console.log('Restored proxy:', result.activeProxy.ipPort);
      
      // Restart monitoring
      startProxyMonitoring(result.activeProxy);
    }
  } catch (error) {
    console.error('Error restoring proxy:', error);
    if (errorHandler) {
      await errorHandler.handleProxyError(error, result.activeProxy);
    }
  }
});

// Restore on install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('ProxyMania VPN installed');
    
    // Initialize default settings
    await chrome.storage.local.set({
      settings: {
        theme: 'dark',
        autoFailover: true,
        testBeforeConnect: true,
        notifications: true,
        refreshInterval: 300000
      },
      security: {
        dnsLeakProtection: true,
        webRtcProtection: true,
        securityStatus: 'secure'
      },
      onboarding: {
        completed: false,
        currentStepIndex: 0,
        version: '2.1.0'
      },
      healthData: {
        connectionQuality: 'excellent',
        lastCheck: null,
        qualityHistory: [],
        latencyHistory: [],
        avgLatency: 0
      }
    });
  } else if (details.reason === 'update') {
    console.log('ProxyMania VPN updated');
    try {
      const result = await chrome.storage.local.get(['activeProxy']);
      if (result.activeProxy) {
        await setProxy(result.activeProxy);
        startProxyMonitoring(result.activeProxy);
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
