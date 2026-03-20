// ProxyMania VPN - IP Detector Module
// Check real IP and proxy IP, DNS leak testing

import { getState, setState, getIpInfo, getCurrentProxy, getSettings, getSecurityStatus, setSecurityStatus } from './state.js';
import { ipCheckBtn, ipRealValue, ipProxyValue, ipDetectorSection, ipDetectorContent } from './dom.js';
import { showToast, showSuccess, showWarning, showError } from './toast.js';
import { toggleDnsLeakProtection } from './security.js';
import { disconnectProxy } from './connection.js';
import { updateSecurityUI } from './ui-core.js';

// ============================================================================
// IP DETECTION
// ============================================================================

/**
 * Check real IP and proxy IP addresses
 * @returns {Promise<Object>} - IP check result
 */
export async function checkIpAddresses() {
  const ipInfo = getIpInfo();
  
  if (ipInfo.isLoading) {
    return null;
  }
  
  // Set loading state
  setState({ 
    ipInfo: { ...ipInfo, isLoading: true }
  });
  
  if (ipCheckBtn) {
    ipCheckBtn.textContent = 'Checking...';
    ipCheckBtn.disabled = true;
  }
  
  try {
    // Check real IP (without proxy)
    const realIpPromise = checkRealIp();
    
    // Check proxy IP (through current proxy)
    const proxyIpPromise = checkProxyIp();
    
    const [realIp, proxyIp] = await Promise.all([realIpPromise, proxyIpPromise]);
    
    // Update state
    const newIpInfo = {
      ...ipInfo,
      realIp,
      proxyIp,
      lastCheck: Date.now(),
      isLoading: false
    };
    
    setState({ ipInfo: newIpInfo });
    
    // Update UI
    if (ipRealValue) ipRealValue.textContent = realIp;
    if (ipProxyValue) ipProxyValue.textContent = proxyIp;
    
    // Analyze results
    await analyzeIpResults(realIp, proxyIp);
    
    return { realIp, proxyIp };
    
  } catch (error) {
    console.error('IP check error:', error);
    showToast('IP check failed: ' + error.message, 'error');
    
    setState({ 
      ipInfo: { ...ipInfo, isLoading: false }
    });
    
    if (ipCheckBtn) {
      ipCheckBtn.textContent = 'Check IPs';
      ipCheckBtn.disabled = false;
    }
    
    return null;
  }
}

/**
 * Check real IP address (without proxy)
 * @returns {Promise<string>} - Real IP address
 */
async function checkRealIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      cache: 'no-store'
    });
    
    const data = await response.json();
    return data.ip || 'Unable to detect';
    
  } catch (error) {
    return 'Unable to detect';
  }
}

/**
 * Check proxy IP address (through current proxy)
 * @returns {Promise<string>} - Proxy IP address
 */
async function checkProxyIp() {
  const currentProxy = getCurrentProxy();
  
  if (!currentProxy) {
    return 'Not connected';
  }
  
  try {
    // Set proxy temporarily
    const testConfig = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: currentProxy.type === 'SOCKS5' ? 'socks5' : 'http',
          host: currentProxy.ip,
          port: currentProxy.port
        },
        bypassList: ['localhost', '127.0.0.1']
      }
    };
    
    await chrome.proxy.settings.set({ value: testConfig, scope: 'regular' });
    
    // Fetch through proxy
    const response = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      cache: 'no-store'
    });
    
    // Clear proxy
    await chrome.proxy.settings.clear({ scope: 'regular' });
    
    const data = await response.json();
    return data.ip || 'Proxy blocked';
    
  } catch (error) {
    // Clear proxy on error
    try {
      await chrome.proxy.settings.clear({ scope: 'regular' });
    } catch (e) {}
    
    return 'Proxy blocked';
  }
}

/**
 * Analyze IP check results
 * @param {string} realIp - Real IP address
 * @param {string} proxyIp - Proxy IP address
 * @returns {Promise<void>}
 */
async function analyzeIpResults(realIp, proxyIp) {
  // Reset button
  if (ipCheckBtn) {
    ipCheckBtn.textContent = 'Check IPs';
    ipCheckBtn.disabled = false;
  }
  
  // Check if IPs match (proxy not working)
  if (realIp && proxyIp && realIp === proxyIp && proxyIp !== 'Not connected') {
    showWarning('⚠️ Warning: Proxy IP matches real IP!', () => {
      disconnectProxy();
    });
    return;
  }
  
  // Check if proxy is working
  if (proxyIp === 'Not connected') {
    showToast('Not connected to a proxy', 'info');
    return;
  }
  
  if (proxyIp === 'Proxy blocked') {
    showError('Proxy is blocked or not working', () => {
      disconnectProxy();
    });
    return;
  }
  
  // Proxy is working - run DNS leak test
  const currentProxy = getCurrentProxy();
  const { dnsLeakProtection } = getSettings();
  
  if (dnsLeakProtection && currentProxy) {
    await runDnsLeakTest();
  } else {
    showSuccess('✓ Proxy is working correctly');
  }
}

/**
 * Run DNS leak test
 * @param {string} proxyIp - Current proxy IP
 * @returns {Promise<void>}
 */
async function runDnsLeakTest() {
  try {
    const dnsResult = await chrome.runtime.sendMessage({
      action: 'testDnsLeak'
    });
    
    if (dnsResult && dnsResult.success) {
      if (dnsResult.leaking) {
        showWarning('⚠️ DNS Leak Detected! Your real IP may be visible', () => {
          toggleDnsLeakProtection();
        });
        
        updateSecurityStatus({ status: 'warning' });
      } else {
        showSuccess('✅ DNS protection active - No leaks detected');
      }
    }
  } catch (e) {
    console.log('DNS leak test skipped:', e.message);
  }
}

// ============================================================================
// IP DETECTOR UI
// ============================================================================

/**
 * Toggle IP detector panel
 */
export function toggleIpDetector() {
  const ipInfo = getIpInfo();
  const expanded = !ipInfo.expanded;
  
  setState({ 
    ipInfo: { ...ipInfo, expanded }
  });
  
  if (ipDetectorContent) {
    ipDetectorContent.style.display = expanded ? 'block' : 'none';
  }
}

/**
 * Setup IP detector event listeners
 */
export function setupIpDetectorListeners() {
  // IP check button
  if (ipCheckBtn) {
    ipCheckBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      checkIpAddresses();
    });
  }
  
  // IP detector section click (expand/collapse)
  if (ipDetectorSection) {
    ipDetectorSection.addEventListener('click', (e) => {
      if (e.target !== ipCheckBtn) {
        toggleIpDetector();
      }
    });
  }
}

// ============================================================================
// IP INFO HELPERS
// ============================================================================

/**
 * Get IP info state
 * @returns {Object} - IP info object
 */
export function getIpInfoState() {
  return getIpInfo();
}

/**
 * Format IP address for display
 * @param {string} ip - IP address
 * @returns {string} - Formatted IP
 */
export function formatIpForDisplay(ip) {
  if (!ip || ip === 'Unable to detect' || ip === 'Not connected' || ip === 'Proxy blocked') {
    return ip;
  }
  
  // Add spacing for readability
  return ip.replace(/:/g, ': ').replace(/\./g, '. ');
}

/**
 * Get IP type (IPv4/IPv6)
 * @param {string} ip - IP address
 * @returns {string} - IP type
 */
export function getIpType(ip) {
  if (!ip) return 'unknown';
  
  if (ip.includes(':')) {
    return 'IPv6';
  } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return 'IPv4';
  }
  
  return 'unknown';
}

/**
 * Check if IP is private
 * @param {string} ip - IP address
 * @returns {boolean} - Whether IP is private
 */
export function isPrivateIp(ip) {
  if (!ip) return false;
  
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];
  
  return privateRanges.some(regex => regex.test(ip));
}

// ============================================================================
// SECURITY INTEGRATION
// ============================================================================

/**
 * Update security status from IP check
 * @param {Object} status - Security status update
 */
export function updateSecurityStatus(status) {
  const currentStatus = getSecurityStatus();
  
  setSecurityStatus({
    ...currentStatus,
    ...status
  });
  
  updateSecurityUI();
}
