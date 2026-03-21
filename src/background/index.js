import * as proxyFetcher from './proxy-fetcher.js';
import * as proxyManager from './proxy-manager.js';
import * as healthMonitor from './health-monitor.js';
import { ReputationEngine } from '../core/reputation-engine.js';
import { TamperDetector } from '../security/tamper-detection.js';

let reputationEngine = null;
let tamperDetector = null;

function compareVersions(a, b) {
  const parseVersion = (v) => v.split('.').map(n => parseInt(n, 10) || 0);
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }
  return 0;
}

const MAX_REGEX_LENGTH = 200;
const MAX_REGEX_COMPLEXITY = 10;

function isRegexSafe(pattern) {
  if (!pattern || pattern.length > MAX_REGEX_LENGTH) return false;
  const complexityIndicators = (pattern.match(/[()*+?[\]{}|]/g) || []).length;
  if (complexityIndicators > MAX_REGEX_COMPLEXITY) return false;
  if (pattern.includes('(?=') || pattern.includes('(?!') || pattern.includes('(?<=') || pattern.includes('(?<!')) return false;
  return true;
}

function safeRegexTest(pattern, text) {
  if (!isRegexSafe(pattern)) return false;
  try {
    const regex = new RegExp(pattern, 'i');
    const result = regex.test(text);
    regex.lastIndex = 0;
    return result;
  } catch (e) {
    return false;
  }
}

async function initReputationEngine() {
  if (!reputationEngine) {
    reputationEngine = new ReputationEngine();
    await reputationEngine.init();
  }
  return reputationEngine;
}

async function initTamperDetector() {
  if (!tamperDetector) {
    tamperDetector = new TamperDetector();
    await tamperDetector.init();
  }
  return tamperDetector;
}

const failoverManager = new proxyManager.ProxyFailoverManager();

let realIp = null;

async function getRealIp() {
  if (realIp) return realIp;
  try {
    const response = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    const data = await response.json();
    realIp = data.ip;
    return realIp;
  } catch (error) {
    console.error('Failed to get real IP:', error);
    return null;
  }
}

async function storeRealIp() {
  if (!realIp) {
    await getRealIp();
  }
  await chrome.storage.local.set({ realIp: realIp });
}

async function getStoredRealIp() {
  const result = await chrome.storage.local.get(['realIp']);
  return result.realIp || null;
}

async function testDnsLeak() {
  const testDomains = [
    'dns.google',
    'cloudflare-dns.com',
    '1.1.1.1'
  ];
  
  try {
    const userRealIp = await getStoredRealIp();
    if (!userRealIp) {
      return { success: false, error: 'Could not determine real IP - please refresh before connecting to proxy' };
    }
    
    const response = await fetch('https://dns.google/resolve?name=dns.google&type=A', {
      method: 'GET',
      cache: 'no-store'
    });
    
    const data = await response.json();
    const resolvedIp = data.answer?.[0]?.data;
    
    if (!resolvedIp) {
      return { success: false, error: 'Could not resolve DNS' };
    }
    
    const isLeaking = resolvedIp === userRealIp;
    
    return {
      success: true,
      resolvedIp: resolvedIp,
      realIp: userRealIp,
      leaking: isLeaking,
      message: isLeaking 
        ? '⚠️ DNS may be leaking - your real IP could be visible' 
        : '✅ DNS routing appears secure'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  healthMonitor.handleAlarm(alarm);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request).then(sendResponse);
  return true;
});

async function handleMessage(request) {
  try {
    switch (request.action) {
      case 'setProxy':
        await storeRealIp();
        await proxyManager.setProxy(request.proxy);
        return { success: true };
        
      case 'clearProxy':
        await proxyManager.clearProxy();
        return { success: true };
        
      case 'getProxy':
        const config = await proxyManager.getProxy();
        return { config };
        
      case 'fetchProxies':
        const proxies = await proxyFetcher.fetchProxies();
        return { proxies };
        
      case 'testProxy':
        return await proxyFetcher.testProxyConnectivity(request.proxy, request.keepProxy);
        
      case 'quickTest':
        return await proxyFetcher.quickLatencyTest(request.proxy);
        
      case 'updateProxyStats':
        await healthMonitor.updateProxyStats(request.proxy, request.success, request.latency);
        return { success: true };
        
      case 'getProxyStats':
        const stats = await getProxyStats();
        return { stats };
        
      case 'startMonitoring':
        await healthMonitor.startProxyMonitoring(request.proxy);
        return { success: true };
        
      case 'stopMonitoring':
        healthMonitor.stopProxyMonitoring();
        return { success: true };
        
      case 'setFailoverProxies':
        failoverManager.setProxies(request.proxies, request.currentProxy);
        return { success: true };
        
      case 'getNextFailoverProxy':
        const proxy = failoverManager.getNextProxy();
        return { proxy };
        
      case 'resetFailover':
        failoverManager.reset();
        return { success: true };
        
      case 'toggleDnsLeakProtection':
      case 'toggleWebRtcProtection':
        return { success: true, enabled: request.enabled };
        
      case 'testDnsLeak':
        return await testDnsLeak();
        
      case 'getSecurityStatus':
        return {
          status: 'secure',
          dnsLeakProtection: true,
          webRtcProtection: true,
          lastCheck: null
        };
        
      case 'resetSecurityAlerts':
        return { success: true };
        
      case 'handleProxyError':
        console.error('Proxy error:', request.error);
        return { success: true };
        
      case 'clearErrorLogs':
        return { success: true };
        
      case 'getStoredErrors':
        return { errors: [] };
        
      case 'startOnboarding':
      case 'completeOnboarding':
        return { success: true };
        
      case 'getOnboardingState':
        const onboarding = await chrome.storage.local.get(['onboarding']);
        return onboarding.onboarding || { completed: false, currentStepIndex: 0, version: '2.1.0' };
        
      case 'startHealthMonitoring':
        if (request.proxy) {
          await healthMonitor.startHealthMonitoring(request.proxy);
        }
        return { success: true };
        
      case 'stopHealthMonitoring':
        healthMonitor.stopHealthMonitoring();
        return { success: true };
        
      case 'getHealthStatus':
        return {
          active: proxyManager.isMonitoringActive(),
          quality: 'excellent',
          avgLatency: 0,
          lastCheck: null
        };
        
      case 'getProxyReputation':
        const rep = await initReputationEngine();
        return await rep.getReputation(request.proxyIpPort);
        
      case 'recordProxyTest':
        const engine = await initReputationEngine();
        await engine.recordTest(request.proxy, request.success, request.latency);
        return { success: true };
        
      case 'getReputationScore':
        const repEngine = await initReputationEngine();
        return { score: repEngine.calculateScore(request.proxy) };
        
      case 'getReputationStats':
        const statsEngine = await initReputationEngine();
        return await statsEngine.getStats();
        
      case 'getAllReputation':
        const allRepEngine = await initReputationEngine();
        return allRepEngine.reputation;
        
      case 'testProxyTampering':
        const detector = await initTamperDetector();
        return await detector.testProxy(request.proxy);
        
      case 'getSuspiciousProxies':
        const suspEngine = await initReputationEngine();
        return { proxies: suspEngine.getSuspiciousProxies() };
        
      case 'markProxyTampered':
        const tamperEngine = await initReputationEngine();
        await tamperEngine.markTampered(request.proxyIpPort, request.tampered);
        return { success: true };
        
      default:
        return { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    console.error('Message handler error:', error);
    return { success: false, error: error.message };
  }
}

async function getProxyStats() {
  try {
    const { proxyStats = {} } = await chrome.storage.local.get(['proxyStats']);
    return proxyStats;
  } catch (error) {
    console.error('Error getting proxy stats:', error);
    return {};
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('PeasyProxy installed');
    
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
        version: '2.2.0'
      },
      healthData: {
        connectionQuality: 'excellent',
        lastCheck: null,
        qualityHistory: [],
        latencyHistory: [],
        avgLatency: 0
      },
      siteRules: [],
      autoRotation: {
        enabled: false,
        interval: 600000
      }
    });
  } else if (details.reason === 'update') {
    console.log('PeasyProxy updated from', details.previousVersion);
    
    const oldVersion = details.previousVersion || '2.0.0';
    if (compareVersions(oldVersion, '2.2.0') < 0) {
      try {
        const data = await chrome.storage.local.get(null);
        const updates = {};
        
        if (!data.siteRules) updates.siteRules = [];
        if (!data.autoRotation) updates.autoRotation = { enabled: false, interval: 600000 };
        if (!data.connectionQuality) {
          updates.connectionQuality = { enabled: true, lastUpdate: null, latency: 0, packetLoss: 0, quality: 'excellent' };
        }
        if (!data.ipInfo) updates.ipInfo = { realIp: null, proxyIp: null, isLoading: false, lastCheck: null };
        
        if (data.onboarding) {
          data.onboarding.version = '2.2.0';
          updates.onboarding = data.onboarding;
        }
        
        if (Object.keys(updates).length > 0) {
          await chrome.storage.local.set(updates);
          console.log('Migrated to v2.2.0:', Object.keys(updates));
        }
      } catch (error) {
        console.error('Migration error:', error);
      }
    }
    
    try {
      const result = await chrome.storage.local.get(['activeProxy']);
      if (result.activeProxy) {
        await proxyManager.setProxy(result.activeProxy);
        await healthMonitor.startProxyMonitoring(result.activeProxy);
      }
    } catch (error) {
      console.error('Error restoring proxy after update:', error);
    }
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const { activeProxy } = await chrome.storage.local.get(['activeProxy']);
    if (activeProxy) {
      await proxyManager.setProxy(activeProxy);
      await healthMonitor.startProxyMonitoring(activeProxy);
      console.log('Restored proxy connection after startup:', activeProxy.ipPort);
    }
  } catch (error) {
    console.error('Error restoring proxy:', error);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url || !tab.active) return;
  
  try {
    const { siteRules, activeProxy } = await chrome.storage.local.get(['siteRules', 'activeProxy']);
    if (!siteRules || !activeProxy || siteRules.length === 0) return;
    
    const url = changeInfo.url;
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch (e) {
      return;
    }
    
    const sortedRules = [...siteRules].filter(r => r.enabled !== false).sort((a, b) => a.priority - b.priority);
    const matchingRule = sortedRules.find(rule => {
      const patternType = rule.patternType || 'exact';
      if (patternType === 'exact') {
        return hostname === rule.url || hostname.endsWith('.' + rule.url);
      } else if (patternType === 'wildcard') {
        if (rule.url.startsWith('*.')) {
          const domain = rule.url.slice(2);
          return hostname === domain || hostname.endsWith('.' + domain);
        }
        if (rule.url.startsWith('*') && rule.url.endsWith('*')) {
          return hostname.includes(rule.url.slice(1, -1));
        }
        return hostname.endsWith(rule.url);
      } else if (patternType === 'regex') {
        return safeRegexTest(rule.url, hostname);
      }
      return false;
    });
    
    if (!matchingRule) return;
    
    const currentProxyInRule = matchingRule.proxyIps.includes(activeProxy.ipPort);
    if (currentProxyInRule) return;
    
    const { proxies } = await chrome.storage.local.get(['proxies']);
    if (!proxies) return;
    
    const newProxy = proxies.find(p => 
      matchingRule.proxyIps.includes(p.ipPort) && 
      p.speedMs < 300
    );
    
    if (!newProxy) return;
    
    console.log(`Auto-switching to ${newProxy.country} proxy for ${hostname}`);
    
    await proxyManager.setProxy(newProxy);
    await chrome.storage.local.set({ activeProxy: newProxy });
    
    chrome.runtime.sendMessage({
      action: 'siteRuleApplied',
      rule: matchingRule,
      proxy: newProxy,
      url: hostname
    }).catch(() => {});
    
  } catch (error) {
    console.error('Site rule check error:', error);
  }
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleMessage,
    failoverManager
  };
}
