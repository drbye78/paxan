// Only proxy-config-manager.js may call chrome.proxy.settings directly.
const MONITORING_ALARM_NAME = 'proxyMonitoring';
const HEALTH_ALARM_NAME = 'healthMonitoring';
const SECURITY_ALARM_NAME = 'securityMonitoring';
const MONITORING_STATE_KEY = 'monitoringState';

import { proxyConfig } from './proxy-config-manager.js';
import { buildProxyConfig } from '../shared/utils.js';

let currentMonitoringProxy = null;
let monitoringActive = false;

// ---------------------------------------------------------------------------
// Service-worker restart resilience
// ---------------------------------------------------------------------------

async function restoreMonitoringState() {
  try {
    const { [MONITORING_STATE_KEY]: state } = await chrome.storage.session.get([MONITORING_STATE_KEY]);
    if (state?.active && state?.proxyIpPort) {
      const { proxies = [] } = await chrome.storage.local.get(['proxies']);
      currentMonitoringProxy = proxies.find(p => p.ipPort === state.proxyIpPort) || null;
      monitoringActive = !!currentMonitoringProxy;
      if (monitoringActive) {
        console.log('Restored monitoring for:', currentMonitoringProxy.ipPort);
      }
    }
  } catch (error) {
    console.error('Failed to restore monitoring state:', error);
  }
}

function isMonitoringActive() {
  return monitoringActive;
}

// ---------------------------------------------------------------------------
// Proxy monitoring
// ---------------------------------------------------------------------------

async function startProxyMonitoring(proxy) {
  stopProxyMonitoring();
  
  currentMonitoringProxy = proxy;
  monitoringActive = true;
  
  // Persist monitoring state for SW restart resilience
  chrome.storage.session.set({
    [MONITORING_STATE_KEY]: { proxyIpPort: proxy.ipPort, active: true }
  }).catch((e) => {
    console.warn('[health-monitor] Failed to persist monitoring state:', e);
  });
  
  try {
    await chrome.alarms.create(MONITORING_ALARM_NAME, {
      delayInMinutes: 0.5,
      periodInMinutes: 0.5
    });
    console.log('Started monitoring for:', proxy.ipPort);
  } catch (error) {
    console.error('Failed to create monitoring alarm:', error);
  }
}

function stopProxyMonitoring() {
  chrome.alarms.get(MONITORING_ALARM_NAME, (alarm) => {
    if (alarm) {
      chrome.alarms.clear(MONITORING_ALARM_NAME);
    }
  });
  currentMonitoringProxy = null;
  monitoringActive = false;
  chrome.storage.session.remove([MONITORING_STATE_KEY]).catch((e) => {
    console.warn('[health-monitor] Failed to remove monitoring state:', e);
  });
}

// ---------------------------------------------------------------------------
// Health monitoring
// ---------------------------------------------------------------------------

async function startHealthMonitoring(proxy) {
  stopHealthMonitoring();
  
  try {
    await chrome.alarms.create(HEALTH_ALARM_NAME, {
      delayInMinutes: 0.5,
      periodInMinutes: 0.5
    });
    console.log('Started health monitoring');
  } catch (error) {
    console.error('Failed to create health alarm:', error);
  }
}

function stopHealthMonitoring() {
  chrome.alarms.get(HEALTH_ALARM_NAME, (alarm) => {
    if (alarm) {
      chrome.alarms.clear(HEALTH_ALARM_NAME);
    }
  });
}

// ---------------------------------------------------------------------------
// Alarm handlers
// ---------------------------------------------------------------------------

async function performProxyMonitoring() {
  const proxy = currentMonitoringProxy;
  if (!proxy) return;
  
  try {
    const startTime = Date.now();
    const testConfig = buildProxyConfig(proxy);
    const result = await proxyConfig.withTestConfig(testConfig, async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch('https://httpbin.org/ip', {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store'
        });
        clearTimeout(timeoutId);
        return { success: response.ok, latency: Date.now() - startTime };
      } catch (e) {
        clearTimeout(timeoutId);
        console.warn('[health-monitor] Monitoring test failed:', e);
        return { success: false, latency: null };
      }
    }, { timeoutMs: 8000, settleMs: 50 });
    
    await updateProxyStats(proxy, result.success, result.latency);
    
    if (!result.success || result.latency > 500) {
      chrome.runtime.sendMessage({
        action: 'proxyDegraded',
        proxy: {
          ipPort: proxy.ipPort,
          country: proxy.country
        },
        latency: result.latency,
        success: result.success,
        monitoringTime: Date.now()
      }).catch((e) => {
        console.warn('[health-monitor] Failed to send proxyDegraded message:', e);
      });
    }
  } catch (error) {
    console.error('Monitoring error:', error);
  }
}

async function performHealthCheck() {
  const proxy = currentMonitoringProxy;
  if (!proxy) return;
  
  try {
    const healthResult = await measureConnectionHealth(proxy);
    const quality = calculateConnectionQuality(healthResult);
    
    chrome.runtime.sendMessage({
      action: 'healthStatusUpdate',
      active: true,
      quality: quality,
      avgLatency: healthResult.latency,
      lastCheck: Date.now()
    }).catch((e) => {
      console.warn('[health-monitor] Failed to send healthStatusUpdate message:', e);
    });
  } catch (error) {
    console.error('Health check error:', error);
  }
}

async function performSecurityCheck() {
  try {
    const { security } = await chrome.storage.local.get(['security']);
    const dnsLeakProtection = security?.dnsLeakProtection !== false;
    const webRtcProtection = security?.webRtcProtection !== false;
    
    chrome.runtime.sendMessage({
      action: 'securityStatusUpdate',
      status: (dnsLeakProtection && webRtcProtection) ? 'secure' : 'warning',
      dnsLeakProtection,
      webRtcProtection,
      lastCheck: Date.now()
    }).catch((e) => {
      console.warn('[health-monitor] Failed to send securityStatusUpdate message:', e);
    });
  } catch (error) {
    console.error('Security check error:', error);
  }
}

// ---------------------------------------------------------------------------
// Connection health measurement
// ---------------------------------------------------------------------------

function calculateConnectionQuality(healthResult) {
  if (!healthResult.latency || healthResult.packetLoss > 50) return 'poor';
  if (healthResult.latency <= 100 && healthResult.packetLoss <= 1) return 'excellent';
  if (healthResult.latency <= 300 && healthResult.packetLoss <= 5) return 'good';
  return 'fair';
}

async function measureConnectionHealth(proxy) {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const testConfig = buildProxyConfig(proxy);
    const result = await proxyConfig.withTestConfig(testConfig, async () => {
      const response = await fetch('https://httpbin.org/ip', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      return { success: response.ok, latency: Date.now() - startTime, packetLoss: 0 };
    }, { timeoutMs: 5000, settleMs: 50 });
    return result;
  } catch (error) {
    return { success: false, latency: null, packetLoss: 100 };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Proxy stats (promise-based serial queue replaces spinlock)
// ---------------------------------------------------------------------------

let statsQueue = Promise.resolve();

async function updateProxyStats(proxy, success, latency) {
  return statsQueue = statsQueue.then(async () => {
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
      
      proxyStats[key].successRate = Math.round(
        (proxyStats[key].successes / proxyStats[key].attempts) * 100
      );
      
      const latencies = proxyStats[key].latencies;
      proxyStats[key].avgLatency = latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null;
      
      await chrome.storage.local.set({ proxyStats });
    } catch (error) {
      console.error('Error updating proxy stats:', error);
    }
  }).catch((e) => {
    console.warn('[health-monitor] Stats update failed:', e);
  });
}

// ---------------------------------------------------------------------------
// Alarm router
// ---------------------------------------------------------------------------

function handleAlarm(alarm) {
  if (alarm.name === MONITORING_ALARM_NAME && currentMonitoringProxy) {
    performProxyMonitoring();
  } else if (alarm.name === HEALTH_ALARM_NAME && currentMonitoringProxy) {
    performHealthCheck();
  } else if (alarm.name === SECURITY_ALARM_NAME) {
    performSecurityCheck();
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  MONITORING_ALARM_NAME,
  HEALTH_ALARM_NAME,
  SECURITY_ALARM_NAME,
  startProxyMonitoring,
  stopProxyMonitoring,
  startHealthMonitoring,
  stopHealthMonitoring,
  performProxyMonitoring,
  performHealthCheck,
  performSecurityCheck,
  measureConnectionHealth,
  calculateConnectionQuality,
  updateProxyStats,
  handleAlarm,
  restoreMonitoringState,
  isMonitoringActive
};
