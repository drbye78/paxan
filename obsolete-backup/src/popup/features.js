async function checkIpAddresses(state) {
  const { DOM, currentProxy, showToast } = state;
  
  if (state.ipInfo.isLoading) return;
  
  state.ipInfo.isLoading = true;
  if (DOM.ipCheckBtn) {
    DOM.ipCheckBtn.textContent = 'Checking...';
    DOM.ipCheckBtn.disabled = true;
  }
  
  try {
    const realIpPromise = (async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json', { method: 'GET', cache: 'no-store' });
        const data = await response.json();
        return data.ip;
      } catch { return 'Unable to detect'; }
    })();
    
    const proxyIpPromise = (async () => {
      if (!currentProxy) return 'Not connected';
      try {
        const testConfig = {
          mode: 'fixed_servers',
          rules: {
            singleProxy: { scheme: currentProxy.type === 'SOCKS5' ? 'socks5' : 'http', host: currentProxy.ip, port: currentProxy.port },
            bypassList: ['localhost', '127.0.0.1']
          }
        };
        await chrome.proxy.settings.set({ value: testConfig, scope: 'regular' });
        const response = await fetch('https://api.ipify.org?format=json', { method: 'GET', cache: 'no-store' });
        await chrome.proxy.settings.clear({ scope: 'regular' });
        const data = await response.json();
        return data.ip;
      } catch { return 'Proxy blocked'; }
    })();
    
    const [realIp, proxyIp] = await Promise.all([realIpPromise, proxyIpPromise]);
    
    state.ipInfo.realIp = realIp;
    state.ipInfo.proxyIp = proxyIp;
    state.ipInfo.lastCheck = Date.now();
    
    if (DOM.ipRealValue) DOM.ipRealValue.textContent = realIp;
    if (DOM.ipProxyValue) DOM.ipProxyValue.textContent = proxyIp;
    
    if (realIp && proxyIp && realIp === proxyIp && proxyIp !== 'Not connected') {
      showToast('Warning: Proxy IP matches real IP!', 'warning');
    } else if (proxyIp && proxyIp !== 'Not connected' && proxyIp !== 'Proxy blocked') {
      showToast('Proxy is working correctly', 'success');
    }
  } catch (error) {
    showToast('IP check failed: ' + error.message, 'error');
  } finally {
    state.ipInfo.isLoading = false;
    if (DOM.ipCheckBtn) {
      DOM.ipCheckBtn.textContent = 'Check IPs';
      DOM.ipCheckBtn.disabled = false;
    }
  }
}

async function toggleDnsLeakProtection(state) {
  const { securityStatus, showToast, updateSecurityUI } = state;
  const enabled = !securityStatus.dnsLeakProtection;
  
  try {
    const result = await chrome.runtime.sendMessage({ action: 'toggleDnsLeakProtection', enabled });
    if (result.success) {
      state.securityStatus.dnsLeakProtection = enabled;
      updateSecurityUI();
      showToast(`DNS leak protection ${enabled ? 'enabled' : 'disabled'}`, 'info');
    }
  } catch (error) {
    showToast('Failed to toggle DNS leak protection', 'error');
  }
}

async function toggleWebRtcProtection(state) {
  const { securityStatus, showToast, updateSecurityUI } = state;
  const enabled = !securityStatus.webRtcProtection;
  
  try {
    const result = await chrome.runtime.sendMessage({ action: 'toggleWebRtcProtection', enabled });
    if (result.success) {
      state.securityStatus.webRtcProtection = enabled;
      updateSecurityUI();
      showToast(`WebRTC protection ${enabled ? 'enabled' : 'disabled'}`, 'info');
    }
  } catch (error) {
    showToast('Failed to toggle WebRTC protection', 'error');
  }
}

function calculateConnectionQuality(latency, packetLoss = 0) {
  if (!latency || packetLoss > 50) return 'poor';
  if (latency <= 100 && packetLoss <= 1) return 'excellent';
  if (latency <= 300 && packetLoss <= 5) return 'good';
  if (latency <= 500 && packetLoss <= 10) return 'fair';
  return 'poor';
}

function updateConnectionQuality(state, latency, packetLoss = 0) {
  const { DOM, currentProxy, securityStatus } = state;
  
  state.connectionQuality.latency = latency || 0;
  state.connectionQuality.packetLoss = packetLoss;
  state.connectionQuality.quality = calculateConnectionQuality(latency, packetLoss);
  state.connectionQuality.lastUpdate = Date.now();
  
  if (DOM.qualityBadgeInline) {
    DOM.qualityBadgeInline.className = `quality-badge ${state.connectionQuality.quality}`;
    DOM.qualityBadgeInline.textContent = state.connectionQuality.quality.charAt(0).toUpperCase() + state.connectionQuality.quality.slice(1);
  }
  if (DOM.qualityStats) {
    DOM.qualityStats.textContent = `${state.connectionQuality.latency}ms`;
  }
  if (DOM.connectionQualityInline && currentProxy) {
    DOM.connectionQualityInline.style.display = 'flex';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkIpAddresses, toggleDnsLeakProtection, toggleWebRtcProtection, calculateConnectionQuality, updateConnectionQuality, escapeHtml };
}
