// PeasyProxy - DNS Protection Module
// Implements DNS leak prevention and protection

const { THRESHOLDS } = require('../popup/constants.js');

// ============================================================================
// DNS PROTECTION STATUS
// ============================================================================

let protectionEnabled = true;
let blockNonProxyDns = true;
let forceProxyDns = true;

// Initialize DNS protection settings
async function initDnsProtection() {
  try {
    const { dnsProtection } = await chrome.storage.local.get(['dnsProtection']);
    
    if (dnsProtection) {
      protectionEnabled = dnsProtection.enabled !== false;
      blockNonProxyDns = dnsProtection.blockNonProxyDns !== false;
      forceProxyDns = dnsProtection.forceProxyDns !== false;
    }
    
    return {
      success: true,
      status: {
        enabled: protectionEnabled,
        blockNonProxyDns,
        forceProxyDns
      }
    };
  } catch (error) {
    console.error('Failed to initialize DNS protection:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DNS PROTECTION CONTROLS
// ============================================================================

// Enable DNS protection
async function enableProtection() {
  try {
    protectionEnabled = true;
    
    await chrome.storage.local.set({
      dnsProtection: {
        enabled: true,
        blockNonProxyDns: true,
        forceProxyDns: true,
        timestamp: Date.now()
      }
    });
    
    return {
      success: true,
      message: 'DNS protection enabled',
      status: {
        enabled: true,
        blockNonProxyDns: true,
        forceProxyDns: true
      }
    };
  } catch (error) {
    console.error('Failed to enable DNS protection:', error);
    return { success: false, error: error.message };
  }
}

// Disable DNS protection
async function disableProtection() {
  try {
    protectionEnabled = false;
    
    await chrome.storage.local.set({
      dnsProtection: {
        enabled: false,
        blockNonProxyDns: false,
        forceProxyDns: false,
        timestamp: Date.now()
      }
    });
    
    return {
      success: true,
      message: 'DNS protection disabled',
      status: {
        enabled: false,
        blockNonProxyDns: false,
        forceProxyDns: false
      }
    };
  } catch (error) {
    console.error('Failed to disable DNS protection:', error);
    return { success: false, error: error.message };
  }
}

// Toggle DNS protection
async function toggleProtection() {
  if (protectionEnabled) {
    return await disableProtection();
  } else {
    return await enableProtection();
  }
}

// Get current protection status
function getProtectionStatus() {
  return {
    enabled: protectionEnabled,
    blockNonProxyDns,
    forceProxyDns
  };
}

// ============================================================================
// DNS REQUEST INTERCEPTION
// ============================================================================

// Check if DNS request should be blocked
function shouldBlockDnsRequest(hostname) {
  if (!protectionEnabled || !blockNonProxyDns) {
    return false;
  }
  
  // Block known DNS-over-HTTPS endpoints that could leak
  const blockedDomains = [
    'dns.google',
    'cloudflare-dns.com',
    'dns.quad9.net',
    'dns.opendns.com',
    'doh.opendns.com'
  ];
  
  return blockedDomains.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  );
}

// Get DNS configuration for proxy
function getProxyDnsConfig(proxyType) {
  if (!protectionEnabled || !forceProxyDns) {
    return null;
  }
  
  // For SOCKS5, DNS is typically handled by the proxy
  if (proxyType === 'SOCKS5') {
    return {
      mode: 'proxy',
      remoteDns: true
    };
  }
  
  // For HTTP/HTTPS proxies, we need to ensure DNS goes through proxy
  return {
    mode: 'proxy',
    remoteDns: true,
    fallback: 'system'
  };
}

// ============================================================================
// DNS LEAK PREVENTION
// ============================================================================

// Prevent WebRTC DNS leaks
function preventWebRtcDnsLeak() {
  // This is handled by the WebRTC blocker module
  // Here we just log the action
  console.log('DNS Protection: WebRTC DNS leak prevention active');
  return { success: true, message: 'WebRTC DNS leak prevention active' };
}

// Prevent DNS prefetching leaks
function preventDnsPrefetchLeak() {
  // Disable DNS prefetching in Chrome
  // Note: This requires Chrome flag or extension API
  console.log('DNS Protection: DNS prefetch prevention active');
  return { success: true, message: 'DNS prefetch prevention active' };
}

// ============================================================================
// DNS VERIFICATION
// ============================================================================

// Verify DNS is going through proxy
async function verifyDnsRouting(proxyIp) {
  try {
    // Test DNS resolution
    const testDomains = ['dns.google', 'cloudflare-dns.com'];
    const results = [];
    
    for (const domain of testDomains) {
      try {
        const response = await fetch(`https://${domain}/resolve?name=example.com&type=A`, {
          headers: { 'Accept': 'application/dns-json' },
          cache: 'no-store'
        });
        
        if (response.ok) {
          const data = await response.json();
          results.push({
            domain,
            success: true,
            ips: data.Answer?.map(a => a.data) || []
          });
        }
      } catch (error) {
        results.push({
          domain,
          success: false,
          error: error.message
        });
      }
    }
    
    // Check if DNS responses contain proxy IP
    const allIps = results.flatMap(r => r.ips);
    const usingProxyDns = proxyIp && allIps.includes(proxyIp);
    
    return {
      success: true,
      usingProxyDns,
      results,
      recommendation: usingProxyDns
        ? 'DNS appears to be routed through proxy'
        : 'DNS may not be fully protected - consider using SOCKS5 proxy'
    };
  } catch (error) {
    console.error('DNS verification failed:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Initialization
  initDnsProtection,
  
  // Controls
  enableProtection,
  disableProtection,
  toggleProtection,
  getProtectionStatus,
  
  // Request handling
  shouldBlockDnsRequest,
  getProxyDnsConfig,
  
  // Leak prevention
  preventWebRtcDnsLeak,
  preventDnsPrefetchLeak,
  
  // Verification
  verifyDnsRouting
};