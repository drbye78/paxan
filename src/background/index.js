// PeasyProxy - Background Service Worker (MV3)
// Central message router and lifecycle handler.
//
import * as proxyFetcher from './proxy-fetcher.js';
import * as proxyManager from './proxy-manager.js';
import * as healthMonitor from './health-monitor.js';
import { handleQualityAlarm } from './quality-monitor.js';
import { handleDnsAlarm, testDnsLeak, captureRealIp, getStoredRealIp } from './dns-leak-test.js';
import * as proxyChain from './proxy-chain.js';
import { ReputationEngine } from '../core/reputation-engine.js';
import { TamperDetector } from '../security/tamper-detection.js';
import { proxyConfig } from './proxy-config-manager.js';
import { compareVersions, isRegexSafe, safeRegexTest } from '../shared/utils.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENT_VERSION = '3.0.18';
const MESSAGE_TIMEOUT_MS = 30000; // timeout for pending message handlers

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let reputationEngine = null;
let tamperDetector = null;
let realIp = null;
let cachedSiteRules = null;
let cachedSiteRulesTimestamp = 0;

const failoverManager = new proxyManager.ProxyFailoverManager();

// ---------------------------------------------------------------------------
// Lazy initialisation helpers
// ---------------------------------------------------------------------------

async function initReputationEngine() {
  await restoreState();
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

// ---------------------------------------------------------------------------
// Real IP
// ---------------------------------------------------------------------------

async function getRealIp() {
  if (realIp) return realIp;
  try {
    // Use the robust implementation from dns-leak-test.js (uses proxyConfig.fetchDirect)
    const ip = await captureRealIp();
    if (ip) realIp = ip;
    return realIp;
  } catch (error) {
    console.error('Failed to get real IP:', error);
    return null;
  }
}

async function storeRealIp() {
  if (!realIp) await getRealIp();
  if (realIp) {
    await chrome.storage.session.set({ sessionRealIp: realIp });
  }
}

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

async function restoreState() {
  try {
    const { sessionRealIp, failoverState } = await chrome.storage.session.get(['sessionRealIp', 'failoverState']);
    if (sessionRealIp) realIp = sessionRealIp;
    if (failoverState) {
      failoverManager.currentIndex = failoverState.currentIndex || 0;
      failoverManager.retryCount = failoverState.retryCount || 0;
      failoverManager.lastFailoverTime = failoverState.lastFailoverTime || null;
    }
    await healthMonitor.restoreMonitoringState();
  } catch {
    // ignore
  }
}

function invalidateSiteRulesCache() {
  cachedSiteRules = null;
  cachedSiteRulesTimestamp = 0;
}

async function getCachedSiteRules() {
  const now = Date.now();
  if (cachedSiteRules && (now - cachedSiteRulesTimestamp) < 30000) return cachedSiteRules;
  const { siteRules } = await chrome.storage.local.get(['siteRules']);
  cachedSiteRules = siteRules || [];
  cachedSiteRulesTimestamp = now;
  return cachedSiteRules;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

async function getProxyStats() {
  try {
    const { proxyStats = {} } = await chrome.storage.local.get(['proxyStats']);
    return proxyStats;
  } catch { return {}; }
}

async function storeErrorLog(error, proxy, timestamp) {
  try {
    const { errorLogs = [] } = await chrome.storage.local.get(['errorLogs']);
    errorLogs.push({
      error: error?.message || error,
      proxy: proxy?.ipPort || proxy,
      timestamp: timestamp || Date.now()
    });
    if (errorLogs.length > 50) errorLogs.splice(0, errorLogs.length - 50);
    await chrome.storage.local.set({ errorLogs });
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Alarms
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'proxyMonitoring' || alarm.name === 'healthMonitoring') {
    healthMonitor.handleAlarm(alarm);
  } else if (alarm.name === 'qualityMonitoring') {
    handleQualityAlarm();
  } else if (alarm.name === 'dnsMonitoring') {
    handleDnsAlarm();
  }
});

// ---------------------------------------------------------------------------
// Message routing (with timeout)
// ---------------------------------------------------------------------------

const pendingMessages = new Map();
let messageCounter = 0;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const id = messageCounter++;
  pendingMessages.set(id, sendResponse);

  // Timeout: if the handler hangs, clean up after MESSAGE_TIMEOUT_MS
  const timer = setTimeout(() => {
    const sr = pendingMessages.get(id);
    if (sr) {
      sr({ success: false, error: 'Request timed out' });
      pendingMessages.delete(id);
    }
  }, MESSAGE_TIMEOUT_MS);

  handleMessage(request).then(response => {
    clearTimeout(timer);
    const sr = pendingMessages.get(id);
    if (sr) {
      sr(response);
      pendingMessages.delete(id);
    }
  }).catch(error => {
    clearTimeout(timer);
    const sr = pendingMessages.get(id);
    if (sr) {
      sr({ success: false, error: error.message });
      pendingMessages.delete(id);
    }
  });
  return true; // keep channel open for async response
});

async function handleMessage(request) {
  try {
    switch (request.action) {
      // ---- Proxy lifecycle ----
      case 'setProxy':
        await storeRealIp();
        await proxyConfig.setUserProxy(request.proxy);
        return { success: true };

      case 'clearProxy':
        await proxyConfig.clearUserProxy();
        return { success: true };

      case 'getProxy': {
        const config = await proxyConfig.getCurrentConfig();
        return { config };
      }

      // ---- Proxy fetching ----
      case 'fetchProxies': {
        const proxies = await proxyFetcher.fetchProxies();
        return { proxies };
      }

      case 'testProxy':
        return await proxyFetcher.testProxyConnectivity(request.proxy, request.keepProxy);

      case 'testProxyThroughProxy':
        return await proxyFetcher.testThroughProxy(request.proxy, request.url);

      case 'quickTest':
        return await proxyFetcher.quickLatencyTest(request.proxy);

      case 'updateProxyStats':
        await healthMonitor.updateProxyStats(request.proxy, request.success, request.latency);
        return { success: true };

      case 'getProxyStats': {
        const stats = await getProxyStats();
        return { stats };
      }

      // ---- Monitoring ----
      case 'startMonitoring':
        await healthMonitor.startProxyMonitoring(request.proxy);
        return { success: true };

      case 'stopMonitoring':
        healthMonitor.stopProxyMonitoring();
        return { success: true };

      case 'startHealthMonitoring':
        if (request.proxy) await healthMonitor.startHealthMonitoring(request.proxy);
        return { success: true };

      case 'stopHealthMonitoring':
        healthMonitor.stopHealthMonitoring();
        return { success: true };

      case 'getHealthStatus': {
        const healthData = await chrome.storage.local.get(['healthData']);
        const hd = healthData.healthData || { connectionQuality: 'excellent', lastCheck: null, qualityHistory: [], latencyHistory: [], avgLatency: 0 };
        return {
          active: healthMonitor.isMonitoringActive(),
          quality: hd.connectionQuality || 'excellent',
          avgLatency: hd.avgLatency || 0,
          lastCheck: hd.lastCheck || null
        };
      }

      // ---- Failover ----
      case 'setFailoverProxies':
        await failoverManager.setProxies(request.proxies, request.currentProxy);
        return { success: true };

      case 'getNextFailoverProxy': {
        const proxy = await failoverManager.getNextProxy();
        return { proxy };
      }

      case 'resetFailover':
        await failoverManager.reset();
        return { success: true };

      // ---- Security & DNS ----
      case 'toggleDnsLeakProtection':
      case 'toggleWebRtcProtection': {
        const secData = await chrome.storage.local.get(['security']);
        const security = secData.security || { dnsLeakProtection: true, webRtcProtection: true, status: 'secure' };
        if (request.action === 'toggleDnsLeakProtection') {
          security.dnsLeakProtection = request.enabled;
        } else {
          security.webRtcProtection = request.enabled;
        }
        await chrome.storage.local.set({ security });
        return { success: true, enabled: request.enabled };
      }

      case 'testDnsLeak':
        return await testDnsLeak();

      case 'getSecurityStatus': {
        const secStatus = await chrome.storage.local.get(['security']);
        return secStatus.security || { status: 'secure', dnsLeakProtection: true, webRtcProtection: true, lastCheck: null };
      }

      // ---- Reputation ----
      case 'getProxyReputation': {
        const rep = await initReputationEngine();
        return await rep.getReputation(request.proxyIpPort);
      }

      case 'recordProxyTest': {
        const engine = await initReputationEngine();
        await engine.recordTest(request.proxy, request.success, request.latency);
        return { success: true };
      }

      case 'getReputationScore': {
        const repEngine = await initReputationEngine();
        return { score: repEngine.calculateScore(request.proxy) };
      }

      case 'getReputationStats': {
        const statsEngine = await initReputationEngine();
        return await statsEngine.getStats();
      }

      case 'getAllReputation': {
        const allRepEngine = await initReputationEngine();
        return allRepEngine.reputation;
      }

      // ---- Tamper detection ----
      case 'testProxyTampering': {
        const detector = await initTamperDetector();
        return await detector.testProxy(request.proxy);
      }

      case 'getSuspiciousProxies': {
        const suspEngine = await initReputationEngine();
        return { proxies: suspEngine.getSuspiciousProxies() };
      }

      case 'markProxyTampered': {
        const tamperEngine = await initReputationEngine();
        await tamperEngine.markTampered(request.proxyIpPort, request.tampered);
        return { success: true };
      }

      // ---- Error logs ----
      case 'handleProxyError':
        await storeErrorLog(request.error, request.proxy, request.timestamp);
        return { success: true };

      case 'clearErrorLogs':
        await chrome.storage.local.set({ errorLogs: [] });
        return { success: true };

      case 'getStoredErrors': {
        const { errorLogs = [] } = await chrome.storage.local.get(['errorLogs']);
        return { errors: errorLogs };
      }

      // ---- Onboarding ----
      case 'startOnboarding':
        await chrome.storage.local.set({ onboarding: { completed: false, currentStepIndex: 0, version: CURRENT_VERSION } });
        return { success: true };

      case 'completeOnboarding': {
        const onb = await chrome.storage.local.get(['onboarding']);
        const onbData = onb.onboarding || { completed: false, currentStepIndex: 0, version: CURRENT_VERSION };
        onbData.completed = true;
        await chrome.storage.local.set({ onboarding: onbData });
        return { success: true };
      }

      case 'getOnboardingState': {
        const onboarding = await chrome.storage.local.get(['onboarding']);
        return onboarding.onboarding || { completed: false, currentStepIndex: 0, version: CURRENT_VERSION };
      }

      // ---- Site rules ----
      case 'setSiteRules':
        await chrome.storage.local.set({ siteRules: request.siteRules || [] });
        invalidateSiteRulesCache();
        return { success: true };

      // ---- Proxy chains ----
      case 'createChain':
        return await proxyChain.createChain(request.name, request.proxyIds, request.options);

      case 'getChain':
        return await proxyChain.getChain(request.chainId);

      case 'listChains':
        return await proxyChain.listChains();

      case 'updateChain':
        return await proxyChain.updateChain(request.chainId, request.updates);

      case 'deleteChain':
        return await proxyChain.deleteChain(request.chainId);

      case 'testChain':
        return await proxyChain.testChain(request.chainId);

      case 'monitorChain':
        return await proxyChain.monitorChain(request.chainId);

      case 'getChainStats':
        return await proxyChain.getChainStats(request.chainId);

      // ----
      default:
        return { success: false, error: 'Unknown action: ' + request.action };
    }
  } catch (error) {
    console.error('Message handler error:', error);
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// Lifecycle: install / update
// ---------------------------------------------------------------------------

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
        status: 'secure'
      },
      onboarding: {
        completed: false,
        currentStepIndex: 0,
        version: CURRENT_VERSION
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
        await proxyConfig.setUserProxy(result.activeProxy);
        await healthMonitor.startProxyMonitoring(result.activeProxy);
      }
    } catch (error) {
      console.error('Error restoring proxy after update:', error);
    }
  }
});

// ---------------------------------------------------------------------------
// Lifecycle: startup
// ---------------------------------------------------------------------------

chrome.runtime.onStartup.addListener(async () => {
  try {
    await restoreState();
    // Capture real IP before restoring proxy
    await captureRealIp();
    const { activeProxy } = await chrome.storage.local.get(['activeProxy']);
    if (activeProxy) {
      await proxyConfig.setUserProxy(activeProxy);
      await healthMonitor.startProxyMonitoring(activeProxy);
      console.log('Restored proxy connection after startup:', activeProxy.ipPort);
    }
  } catch (error) {
    console.error('Error restoring proxy:', error);
  }
});

// ---------------------------------------------------------------------------
// Tab navigation: site-rule auto-switching
// ---------------------------------------------------------------------------

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url || !tab.active) return;

  try {
    const { activeProxy } = await chrome.storage.local.get(['activeProxy']);
    if (!activeProxy) return;

    const siteRules = await getCachedSiteRules();
    if (siteRules.length === 0) return;

    let hostname;
    try {
      hostname = new URL(changeInfo.url).hostname;
    } catch { return; }

    const sortedRules = [...siteRules]
      .filter(r => r.enabled !== false)
      .sort((a, b) => a.priority - b.priority);

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
    if (matchingRule.proxyIps.includes(activeProxy.ipPort)) return;

    const { proxies } = await chrome.storage.local.get(['proxies']);
    if (!proxies) return;

    const newProxy = proxies.find(p =>
      matchingRule.proxyIps.includes(p.ipPort) && p.speedMs < 300
    );
    if (!newProxy) return;

    console.log(`Auto-switching to ${newProxy.country} proxy for ${hostname}`);

    await proxyConfig.setUserProxy(newProxy);
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
