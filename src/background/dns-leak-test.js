// PeasyProxy - DNS Leak Testing Module
// Implements DNS leak detection and protection

import { proxyConfig } from './proxy-config-manager.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_REAL_IP_KEY = 'sessionRealIp';
const DNS_HISTORY_KEY = 'dnsLeakHistory';
const DNS_PROTECTION_KEY = 'dnsProtection';
const DNS_MONITOR_ALARM = 'dnsMonitoring';
const MAX_HISTORY_ENTRIES = 50;

// ============================================================================
// REAL IP CAPTURE (via proxyConfig.fetchDirect)
// ============================================================================

async function captureRealIp() {
  try {
    const ip = await proxyConfig.fetchDirect(async () => {
      const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.ip;
    });
    await chrome.storage.session.set({ [SESSION_REAL_IP_KEY]: ip });
    return ip;
  } catch (error) {
    console.error('Failed to capture real IP:', error);
    return null;
  }
}

async function getStoredRealIp() {
  try {
    const data = await chrome.storage.session.get([SESSION_REAL_IP_KEY]);
    return data[SESSION_REAL_IP_KEY] || null;
  } catch {
    return null;
  }
}

// ============================================================================
// DNS LEAK TEST
// ============================================================================

async function testDnsLeak() {
  const realIp = await getStoredRealIp();
  if (!realIp) {
    return { success: false, error: 'Real IP not available. Connect to proxy first to establish baseline.' };
  }

  const endpoints = [
    'https://dnsleaktest.com/api/v1/whoami',
    'https://whoer.net/api/v2/dns'
  ];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      if (!res.ok) continue;

      const data = await res.json();
      const resolverIp = data.ip || data.dns_ip || data.resolver_ip;
      if (!resolverIp) continue;

      const leaking = resolverIp === realIp;

      const result = {
        success: true,
        realIp,
        resolverIp,
        leaking,
        endpoint,
        message: leaking
          ? '\u26a0\ufe0f DNS leak detected: DNS resolver sees your real IP'
          : '\u2705 DNS is secure: queries go through proxy'
      };

      // Save to history
      await saveDnsTestResult(result);
      return result;
    } catch {
      clearTimeout(timeoutId);
      // try next endpoint
    }
  }

  return {
    success: false,
    error: 'All DNS leak test endpoints failed',
    leaking: null,
    message: '\u26a0\ufe0f Could not test DNS leak \u2014 all endpoints unreachable'
  };
}

// ============================================================================
// DNS HISTORY MANAGEMENT
// ============================================================================

// Save DNS test result to history
async function saveDnsTestResult(result) {
  try {
    const data = await chrome.storage.local.get([DNS_HISTORY_KEY]);
    const dnsTestHistory = data[DNS_HISTORY_KEY] || [];
    
    // Add new result
    dnsTestHistory.unshift({
      ...result,
      timestamp: Date.now()
    });
    
    // Keep only recent entries
    if (dnsTestHistory.length > MAX_HISTORY_ENTRIES) {
      dnsTestHistory.length = MAX_HISTORY_ENTRIES;
    }
    
    await chrome.storage.local.set({ [DNS_HISTORY_KEY]: dnsTestHistory });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save DNS test history:', error);
    return { success: false, error: error.message };
  }
}

// Get DNS test history
async function getDnsHistory() {
  try {
    const data = await chrome.storage.local.get([DNS_HISTORY_KEY]);
    const dnsTestHistory = data[DNS_HISTORY_KEY] || [];
    return { success: true, history: dnsTestHistory };
  } catch (error) {
    console.error('Failed to get DNS history:', error);
    return { success: false, error: error.message, history: [] };
  }
}

// Clear DNS test history
async function clearDnsHistory() {
  try {
    await chrome.storage.local.remove([DNS_HISTORY_KEY]);
    return { success: true };
  } catch (error) {
    console.error('Failed to clear DNS history:', error);
    return { success: false, error: error.message };
  }
}

// Get DNS leak statistics
async function getDnsStats() {
  try {
    const data = await chrome.storage.local.get([DNS_HISTORY_KEY]);
    const dnsTestHistory = data[DNS_HISTORY_KEY] || [];
    
    if (dnsTestHistory.length === 0) {
      return {
        success: true,
        stats: {
          totalTests: 0,
          leakDetected: 0,
          leakRate: 0,
          lastTest: null
        }
      };
    }
    
    const leakCount = dnsTestHistory.filter(t => t.leaking).length;
    const lastTest = dnsTestHistory[0];
    
    return {
      success: true,
      stats: {
        totalTests: dnsTestHistory.length,
        leakDetected: leakCount,
        leakRate: Math.round((leakCount / dnsTestHistory.length) * 100),
        lastTest: lastTest.timestamp,
        lastResult: lastTest.leaking ? 'leak_detected' : 'secure'
      }
    };
  } catch (error) {
    console.error('Failed to get DNS stats:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DNS PROTECTION
// ============================================================================

// Force DNS through proxy (implementation depends on proxy type)
async function enableDnsProtection() {
  try {
    // Store DNS protection setting
    await chrome.storage.local.set({
      dnsProtection: {
        enabled: true,
        forceProxyDns: true,
        blockNonProxyDns: true,
        timestamp: Date.now()
      }
    });
    
    return { success: true, message: 'DNS protection enabled' };
  } catch (error) {
    console.error('Failed to enable DNS protection:', error);
    return { success: false, error: error.message };
  }
}

// Disable DNS protection
async function disableDnsProtection() {
  try {
    await chrome.storage.local.set({
      dnsProtection: {
        enabled: false,
        forceProxyDns: false,
        blockNonProxyDns: false,
        timestamp: Date.now()
      }
    });
    
    return { success: true, message: 'DNS protection disabled' };
  } catch (error) {
    console.error('Failed to disable DNS protection:', error);
    return { success: false, error: error.message };
  }
}

// Get DNS protection status
async function getDnsProtectionStatus() {
  try {
    const { dnsProtection } = await chrome.storage.local.get(['dnsProtection']);
    
    return {
      success: true,
      status: dnsProtection || {
        enabled: true,
        forceProxyDns: true,
        blockNonProxyDns: true
      }
    };
  } catch (error) {
    console.error('Failed to get DNS protection status:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DNS MONITORING
// ============================================================================

async function handleDnsAlarm() {
  try {
    const { activeProxy } = await chrome.storage.local.get(['activeProxy']);
    if (!activeProxy) return;

    const result = await testDnsLeak();
    if (result.leaking) {
      chrome.runtime.sendMessage({
        action: 'dnsLeakDetected',
        details: result
      }).catch(() => {});
    }
  } catch (error) {
    console.error('DNS alarm error:', error);
  }
}

async function startDnsMonitoring(intervalMinutes = 5) {
  // Ensure we have a real IP first
  const stored = await getStoredRealIp();
  if (!stored) {
    await captureRealIp();
  }
  
  try {
    await chrome.alarms.create(DNS_MONITOR_ALARM, {
      delayInMinutes: intervalMinutes,
      periodInMinutes: intervalMinutes
    });
    console.log('DNS monitoring started');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function stopDnsMonitoring() {
  try {
    await chrome.alarms.clear(DNS_MONITOR_ALARM);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  captureRealIp,
  getStoredRealIp,
  testDnsLeak,
  handleDnsAlarm,
  startDnsMonitoring,
  stopDnsMonitoring,
  // DNS history
  saveDnsTestResult,
  getDnsHistory,
  clearDnsHistory,
  getDnsStats,
  // DNS protection
  enableDnsProtection,
  disableDnsProtection,
  getDnsProtectionStatus
};
