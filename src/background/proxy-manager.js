// Only proxy-config-manager.js may call chrome.proxy.settings directly.
import { proxyConfig } from './proxy-config-manager.js';
import { stopProxyMonitoring, stopHealthMonitoring } from './health-monitor.js';

async function setProxy(proxy) {
  try {
    await proxyConfig.setUserProxy(proxy);
    console.log('Proxy set successfully:', proxy.ipPort);
    return true;
  } catch (error) {
    throw error;
  }
}

async function clearProxy() {
  stopProxyMonitoring();
  stopHealthMonitoring();
  try {
    await proxyConfig.clearUserProxy();
    console.log('Proxy cleared successfully');
    return true;
  } catch (error) {
    throw error;
  }
}

async function getProxy() {
  const config = await proxyConfig.getCurrentConfig();
  return config;
}

class ProxyFailoverManager {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
    this.failoverQueue = [];
    this.currentIndex = 0;
    this.lastFailoverTime = null;
    this.failoverHistory = [];
  }
  
  async setProxies(proxies, currentProxy) {
    if (!currentProxy) return;
    
    // Filter out current proxy and get proxy stats for better sorting
    const availableProxies = proxies.filter(p => p.ipPort !== currentProxy.ipPort);
    
    // Sort by combined score: 60% reliability, 30% speed, 10% freshness
    const scoredProxies = await Promise.all(availableProxies.map(async proxy => {
      // Get stats if available
      const stats = await this.getProxyStats(proxy);
      const reliabilityScore = stats?.successRate || 50;
      const speedScore = Math.max(0, 100 - (proxy.speedMs || 1000) / 10);
      const freshnessScore = this.calculateFreshnessScore(Date.now());
      
      const combinedScore = (reliabilityScore * 0.6) + (speedScore * 0.3) + (freshnessScore * 0.1);
      
      return {
        proxy,
        score: combinedScore,
        reliability: reliabilityScore,
        speed: proxy.speedMs || 1000
      };
    }));
    this.failoverQueue = scoredProxies
      .sort((a, b) => b.score - a.score)
      .map(item => item.proxy);
    
    this.currentIndex = 0;
    this.lastFailoverTime = null;
    await this.persistState();
  }
  
  async getNextProxy() {
    if (this.failoverQueue.length === 0) {
      return null;
    }
    
    const nextProxy = this.failoverQueue[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.failoverQueue.length;
    
    this.lastFailoverTime = Date.now();
    this.failoverHistory.push({
      proxy: nextProxy.ipPort,
      timestamp: Date.now(),
      retryCount: this.retryCount
    });
    if (this.failoverHistory.length > 10) this.failoverHistory.shift();
    
    this.retryCount++;
    
    if (this.retryCount > this.maxRetries) {
      const timeSinceLastFailover = this.lastFailoverTime ? Date.now() - this.lastFailoverTime : 0;
      if (timeSinceLastFailover < 30000) return null;
      this.retryCount = 0;
    }
    
    await this.persistState();
    return nextProxy;
  }
  
  markSuccess() {
    this.retryCount = 0;
  }
  
  async getProxyStats(proxy) {
    try {
      const { proxyStats = {} } = await chrome.storage.local.get(['proxyStats']);
      return proxyStats[proxy.ipPort] || null;
    } catch {
      return null;
    }
  }
  
  calculateFreshnessScore(timestamp) {
    if (!timestamp) return 50;
    
    const ts = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp);
    if (isNaN(ts)) return 50;
    
    const ageMs = Date.now() - ts;
    if (ageMs < 0) return 50;
    if (ageMs < 60000) return 100;
    if (ageMs < 120000) return 80;
    if (ageMs < 180000) return 70;
    if (ageMs < 300000) return 60;
    return 50;
  }
  
  async reset() {
    this.retryCount = 0;
    this.failoverQueue = [];
    this.currentIndex = 0;
    this.lastFailoverTime = null;
    this.failoverHistory = [];
    await this.persistState();
  }
  
  async persistState() {
    try {
      await chrome.storage.session.set({
        failoverState: {
          failoverQueue: this.failoverQueue.map(p => p.ipPort),
          currentIndex: this.currentIndex,
          retryCount: this.retryCount,
          lastFailoverTime: this.lastFailoverTime
        }
      });
    } catch (e) {
      console.error('[proxy-manager] Failed to persist failover state:', e);
    }
  }

  async restoreState() {
    try {
      const { failoverState } = await chrome.storage.session.get(['failoverState']);
      if (failoverState) {
        this.currentIndex = failoverState.currentIndex || 0;
        this.retryCount = failoverState.retryCount || 0;
        this.lastFailoverTime = failoverState.lastFailoverTime || null;
        if (failoverState.failoverQueue?.length) {
          const { proxies = [] } = await chrome.storage.local.get(['proxies']);
          this.failoverQueue = failoverState.failoverQueue
            .map(ipPort => proxies.find(p => p.ipPort === ipPort))
            .filter(Boolean);
        }
      }
    } catch (e) {
      console.error('[proxy-manager] Failed to restore failover state:', e);
      // Safe fallback to prevent desync
      this.currentIndex = 0;
      this.failoverQueue = [];
      this.retryCount = 0;
      this.lastFailoverTime = null;
    }
  }

  getStatus() {
    return {
      queueSize: this.failoverQueue.length,
      currentIndex: this.currentIndex,
      retryCount: this.retryCount,
      lastFailoverTime: this.lastFailoverTime,
      failoverHistory: this.failoverHistory.length
    };
  }
}

export {
  setProxy,
  clearProxy,
  getProxy,
  ProxyFailoverManager
};
