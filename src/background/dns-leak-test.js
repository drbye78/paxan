// ProxyMania VPN - DNS Leak Testing Module
// Implements DNS leak detection and protection

const { THRESHOLDS } = require('../popup/constants.js');

// ============================================================================
// DNS TEST SERVERS
// ============================================================================

const DNS_SERVERS = {
  google: {
    name: 'Google DNS',
    resolver: 'https://dns.google/resolve',
    ips: ['8.8.8.8', '8.8.4.4']
  },
  cloudflare: {
    name: 'Cloudflare DNS',
    resolver: 'https://cloudflare-dns.com/dns-query',
    ips: ['1.1.1.1', '1.0.0.1']
  },
  quad9: {
    name: 'Quad9 DNS',
    resolver: 'https://dns.quad9.net/dns-query',
    ips: ['9.9.9.9', '149.112.112.112']
  }
};

// ============================================================================
// DNS LEAK DETECTION
// ============================================================================

// Get real IP address
async function getRealIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      cache: 'no-store'
    });
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Failed to get real IP:', error);
    return null;
  }
}

// Test DNS resolution through a specific server
async function testDnsResolution(domain, serverUrl) {
  try {
    const url = `${serverUrl}?name=${domain}&type=A`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/dns-json'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`DNS query failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.Answer && data.Answer.length > 0) {
      return {
        success: true,
        ips: data.Answer.map(a => a.data),
        server: serverUrl
      };
    }

    return {
      success: false,
      error: 'No answer received',
      server: serverUrl
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      server: serverUrl
    };
  }
}

// Test DNS leak by comparing resolved IPs
async function testDnsLeak(proxyIp = null) {
  const testDomain = 'dns.google';
  const results = [];
  
  // Get real IP for comparison
  const realIp = await getRealIp();
  
  // Test each DNS server
  for (const [key, server] of Object.entries(DNS_SERVERS)) {
    const result = await testDnsResolution(testDomain, server.resolver);
    
    results.push({
      server: server.name,
      serverKey: key,
      ips: result.ips || [],
      success: result.success,
      error: result.error
    });
  }

  // Analyze results for leaks
  const allResolvedIps = results
    .filter(r => r.success)
    .flatMap(r => r.ips);
  
  const uniqueIps = [...new Set(allResolvedIps)];
  
  // Check if any resolved IP matches real IP (potential leak)
  const leaking = realIp && uniqueIps.includes(realIp);
  
  // Check if all servers resolve to same IPs (consistent)
  const consistent = uniqueIps.length <= 2; // Allow for IPv4/IPv6 pairs
  
  // Check if proxy IP is being used for DNS
  const usingProxyDns = proxyIp && uniqueIps.some(ip => ip === proxyIp);

  return {
    success: true,
    realIp,
    proxyIp,
    servers: results,
    resolvedIps: uniqueIps,
    leaking,
    consistent,
    usingProxyDns,
    timestamp: Date.now(),
    message: leaking 
      ? '⚠️ DNS leak detected! Your real IP may be visible.'
      : consistent
        ? '✅ DNS appears secure - no leaks detected.'
        : '⚠️ Inconsistent DNS results - potential issue.'
  };
}

// Quick DNS check (single server)
async function quickDnsCheck() {
  try {
    const result = await testDnsResolution('dns.google', DNS_SERVERS.google.resolver);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    return {
      success: true,
      ips: result.ips,
      server: 'Google DNS'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// DNS HISTORY MANAGEMENT
// ============================================================================

const DNS_HISTORY_KEY = 'dnsTestHistory';
const MAX_HISTORY_ENTRIES = 50;

// Save DNS test result to history
async function saveDnsTestResult(result) {
  try {
    const { dnsTestHistory = [] } = await chrome.storage.local.get([DNS_HISTORY_KEY]);
    
    // Add new result
    dnsTestHistory.unshift({
      ...result,
      timestamp: Date.now()
    });
    
    // Keep only recent entries
    if (dnsTestHistory.length > MAX_HISTORY_ENTRIES) {
      dnsTestHistory.length = MAX_HISTORY_ENTRIES;
    }
    
    await chrome.storage.local.set({ dnsTestHistory });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save DNS test history:', error);
    return { success: false, error: error.message };
  }
}

// Get DNS test history
async function getDnsHistory() {
  try {
    const { dnsTestHistory = [] } = await chrome.storage.local.get([DNS_HISTORY_KEY]);
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
    const { dnsTestHistory = [] } = await chrome.storage.local.get([DNS_HISTORY_KEY]);
    
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
// MONITORED DNS CHECKS
// ============================================================================

let dnsMonitorInterval = null;

// Start periodic DNS monitoring
function startDnsMonitoring(intervalMs = 300000) { // Default: 5 minutes
  if (dnsMonitorInterval) {
    clearInterval(dnsMonitorInterval);
  }
  
  dnsMonitorInterval = setInterval(async () => {
    try {
      const { dnsProtection } = await chrome.storage.local.get(['dnsProtection']);
      
      if (dnsProtection?.enabled) {
        const result = await testDnsLeak();
        await saveDnsTestResult(result);
        
        // Alert if leak detected
        if (result.leaking) {
          chrome.runtime.sendMessage({
            action: 'dnsLeakDetected',
            result
          }).catch(() => {});
        }
      }
    } catch (error) {
      console.error('DNS monitoring error:', error);
    }
  }, intervalMs);
}

// Stop DNS monitoring
function stopDnsMonitoring() {
  if (dnsMonitorInterval) {
    clearInterval(dnsMonitorInterval);
    dnsMonitorInterval = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // DNS Servers
  DNS_SERVERS,
  
  // Leak Detection
  getRealIp,
  testDnsResolution,
  testDnsLeak,
  quickDnsCheck,
  
  // History
  saveDnsTestResult,
  getDnsHistory,
  clearDnsHistory,
  getDnsStats,
  
  // Protection
  enableDnsProtection,
  disableDnsProtection,
  getDnsProtectionStatus,
  
  // Monitoring
  startDnsMonitoring,
  stopDnsMonitoring
};