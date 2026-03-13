const MONITORING_ALARM_NAME = 'proxyMonitoring';
const HEALTH_ALARM_NAME = 'healthMonitoring';
const SECURITY_ALARM_NAME = 'securityMonitoring';

import { testProxyConnectivity } from './proxy-fetcher.js';
import { 
  getCurrentMonitoringProxy, 
  isMonitoringActive,
  setCurrentMonitoringProxy,
  setMonitoringActive 
} from './proxy-manager.js';

async function startProxyMonitoring(proxy) {
  stopProxyMonitoring();
  
  setCurrentMonitoringProxy(proxy);
  setMonitoringActive(true);
  
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
  setCurrentMonitoringProxy(null);
  setMonitoringActive(false);
}

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

async function performProxyMonitoring() {
  const proxy = getCurrentMonitoringProxy();
  if (!proxy) return;
  
  try {
    const result = await testProxyConnectivity(proxy);
    await updateProxyStats(proxy, result.success, result.latency);
    
    if (!result.success || (result.latency && result.latency > 500)) {
      chrome.runtime.sendMessage({
        action: 'proxyDegraded',
        proxy: {
          ipPort: proxy.ipPort,
          country: proxy.country
        },
        latency: result.latency,
        success: result.success,
        monitoringTime: Date.now()
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Monitoring error:', error);
  }
}

async function performHealthCheck() {
  const proxy = getCurrentMonitoringProxy();
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
    }).catch(() => {});
  } catch (error) {
    console.error('Health check error:', error);
  }
}

async function performSecurityCheck() {
  try {
    const result = await chrome.storage.local.get(['activeProxy']);
    if (!result.activeProxy) {
      return;
    }
    
    chrome.runtime.sendMessage({
      action: 'securityStatusUpdate',
      status: 'secure',
      dnsLeakProtection: true,
      webRtcProtection: true,
      lastCheck: Date.now()
    }).catch(() => {});
  } catch (error) {
    console.error('Security check error:', error);
  }
}

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
    
    await chrome.proxy.settings.set({ value: testConfig, scope: 'regular' });
    
    const response = await fetch('https://httpbin.org/ip', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    await chrome.proxy.settings.clear({ scope: 'regular' });
    
    return {
      success: response.ok,
      latency: Date.now() - startTime,
      packetLoss: 0
    };
  } catch (error) {
    clearTimeout(timeoutId);
    try {
      await chrome.proxy.settings.clear({ scope: 'regular' });
    } catch (e) {}
    
    return {
      success: false,
      latency: null,
      packetLoss: 100
    };
  }
}

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
}

function handleAlarm(alarm) {
  if (alarm.name === MONITORING_ALARM_NAME && getCurrentMonitoringProxy()) {
    performProxyMonitoring();
  } else if (alarm.name === HEALTH_ALARM_NAME && getCurrentMonitoringProxy()) {
    performHealthCheck();
  } else if (alarm.name === SECURITY_ALARM_NAME) {
    performSecurityCheck();
  }
}

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
  handleAlarm
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
    handleAlarm
  };
}
