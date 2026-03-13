import { createProxyConfig } from './proxy-fetcher.js';

let currentMonitoringProxy = null;
let monitoringActive = false;

function getCurrentMonitoringProxy() {
  return currentMonitoringProxy;
}

function isMonitoringActive() {
  return monitoringActive;
}

async function setProxy(proxy) {
  return new Promise((resolve, reject) => {
    const proxyConfig = createProxyConfig(proxy);
    
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

async function clearProxy() {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.clear(
      { scope: 'regular' },
      (result) => {
        stopProxyMonitoring();
        stopHealthMonitoring();
        
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

async function setCurrentMonitoringProxy(proxy) {
  currentMonitoringProxy = proxy;
}

async function setMonitoringActive(active) {
  monitoringActive = active;
}

function stopProxyMonitoring() {
  chrome.alarms.get('proxyMonitoring', (alarm) => {
    if (alarm) {
      chrome.alarms.clear('proxyMonitoring');
    }
  });
  currentMonitoringProxy = null;
  monitoringActive = false;
}

function stopHealthMonitoring() {
  chrome.alarms.get('healthMonitoring', (alarm) => {
    if (alarm) {
      chrome.alarms.clear('healthMonitoring');
    }
  });
}

class ProxyFailoverManager {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
    this.failoverQueue = [];
  }
  
  setProxies(proxies, currentProxy) {
    if (!currentProxy) return;
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

export {
  setProxy,
  clearProxy,
  getProxy,
  getCurrentMonitoringProxy,
  isMonitoringActive,
  setCurrentMonitoringProxy,
  setMonitoringActive,
  stopProxyMonitoring,
  stopHealthMonitoring,
  ProxyFailoverManager
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    setProxy,
    clearProxy,
    getProxy,
    getCurrentMonitoringProxy,
    isMonitoringActive,
    setCurrentMonitoringProxy,
    setMonitoringActive,
    stopProxyMonitoring,
    stopHealthMonitoring,
    ProxyFailoverManager
  };
}
