// PeasyProxy - Popup Connection Management
// Handles proxy connection, disconnection, and monitoring logic

import {
  getCurrentProxy,
  setCurrentProxy,
  getConnectionStartTime,
  setConnectionStartTime,
  getSettings,
  setSettings,
  getSecurityStatus,
  setSecurityStatus,
  getHealthStatus,
  setHealthStatus,
  getConnectionQuality,
  setConnectionQuality,
  getIpInfo,
  setIpInfo,
  getDailyStats,
  updateDailyStats,
  setProxies,
  getProxies,
  addToRecentlyUsed,
  saveAllState,
  getSiteRules
} from './popup.state.js';

import {
  updateUI,
  updateFab,
  updateSecurityUI,
  updateHealthUI,
  updateConnectionQuality,
  showToast,
  getFlag
} from './popup.ui.js';

import {
  renderQuickConnect,
  renderRecommended,
  filterProxies,
  loadProxyStats,
  loadProxyReputation,
  loadProxies
} from './popup.proxy-list.js';



// Global variables
let monitoringActive = false;
let lastDisconnectedProxy = null;
let disconnectTimeout = null;
let timerInterval = null;

// ============================================================================
// PROXY CONNECTION
// ============================================================================

async function connectToProxy(proxy, event) {
  const proxyItem = event.target.closest('.proxy-item') || event.target;
  proxyItem?.classList.add('connecting');
  
  // Find the connect button
  const connectBtn = event.target.querySelector?.('.connect-btn') || event.target;
  if (connectBtn && connectBtn.textContent) {
    connectBtn.textContent = '🧪 Testing...';
  }
  
  const testStatus = document.getElementById('testStatus');
  const testText = testStatus?.querySelector('.test-text');
  
  if (testStatus) {
    testStatus.style.display = 'block';
    if (testText) testText.textContent = 'Testing proxy connectivity...';
  }
  
  const settings = getSettings();
  
  try {
    if (settings.testBeforeConnect) {
      const testResult = await chrome.runtime.sendMessage({ action: 'testProxy', proxy });
      await chrome.runtime.sendMessage({ action: 'updateProxyStats', proxy, success: testResult.success, latency: testResult.latency });
      await loadProxyStats();
      if (!testResult.success) throw new Error('Proxy test failed');
      if (testText) testText.textContent = `✓ Test passed (${testResult.latency}ms)`;
      
      // Run tamper detection
      try {
        const tamperResult = await chrome.runtime.sendMessage({ action: 'testProxyTampering', proxy });
        if (tamperResult.tampered || tamperResult.suspicious) {
          await chrome.runtime.sendMessage({ 
            action: 'markProxyTampered', 
            proxyIpPort: proxy.ipPort, 
            tampered: true 
          });
          await loadProxyReputation();
          showToast('⚠️ Warning: Tampering detected on this proxy!', 'warning');
        }
      } catch (e) {
        console.log('Tamper detection skipped:', e.message);
      }
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    await chrome.runtime.sendMessage({ action: 'setProxy', proxy });
    const currentProxies = getProxies();
    await chrome.runtime.sendMessage({ action: 'setFailoverProxies', proxies: currentProxies, currentProxy: proxy });
    
    setCurrentProxy(proxy);
    const startTime = Date.now();
    setConnectionStartTime(startTime);
    await chrome.storage.local.set({ activeProxy: proxy, connectionStartTime: startTime });
    await addToRecentlyUsed(proxy);
    updateDailyStats({ proxiesUsed: getDailyStats().proxiesUsed + 1 });
    
    startConnectionTimer();
    startMonitoring();
    startSpeedGraph();
    updateUI();
    filterProxies();
    renderQuickConnect();
    renderRecommended();
    showToast(`Connected to ${proxy.country} (${proxy.speedMs}ms)`, 'success');
  } catch (error) {
    // Reset button text on failure
    if (connectBtn && connectBtn.textContent) {
      connectBtn.textContent = '✕ Failed';
      connectBtn.classList.add('btn-failed');
    }
    // Mark proxy item as failed
    proxyItem?.classList.remove('connecting');
    proxyItem?.classList.add('failed');
    
    showToast(`Connection failed: ${error.message}`, 'error');
    updateDailyStats({ attempts: getDailyStats().attempts + 1 });
    
    // Reset button after 2 seconds
    setTimeout(() => {
      if (connectBtn && connectBtn.textContent) {
        connectBtn.textContent = 'Connect';
        connectBtn.classList.remove('btn-failed');
      }
      proxyItem?.classList.remove('failed');
    }, 2000);
    
    if (settings.autoFailover) {
      try {
        const result = await chrome.runtime.sendMessage({ action: 'getNextFailoverProxy' });
        if (result.proxy) {
          showToast('Auto-failover: Trying ' + result.proxy.country, 'info');
          await connectToProxy(result.proxy, event);
          return;
        }
      } catch (err) {
        console.error('Auto-failover failed:', err);
      }
    }
  } finally {
    proxyItem?.classList.remove('connecting');
    if (testStatus) testStatus.style.display = 'none';
  }
}

async function disconnectProxy() {
  try {
    // Save for undo
    lastDisconnectedProxy = getCurrentProxy();
    
    await chrome.runtime.sendMessage({ action: 'clearProxy' });
    await chrome.runtime.sendMessage({ action: 'stopMonitoring' });
    await chrome.storage.local.remove(['activeProxy', 'connectionStartTime']);
    stopConnectionTimer();
    stopMonitoring();
    stopSpeedGraph();
    setCurrentProxy(null);
    setConnectionStartTime(null);
    updateUI();
    filterProxies();
    renderQuickConnect();
    renderRecommended();
    
    // Show undo toast
    showToast('Disconnected', 'info', () => {
      // Undo callback - clear timeout and reconnect
      if (disconnectTimeout) {
        clearTimeout(disconnectTimeout);
        disconnectTimeout = null;
      }
      reconnectToLastProxy();
    });
    
    // Auto-clear after 5 seconds
    disconnectTimeout = setTimeout(() => {
      lastDisconnectedProxy = null;
      disconnectTimeout = null;
    }, 5000);
    
  } catch (error) {
    showToast('Disconnect failed', 'error');
  }
}

async function reconnectToLastProxy() {
  if (!lastDisconnectedProxy) return;
  
  const proxy = lastDisconnectedProxy;
  lastDisconnectedProxy = null;
  
  try {
    await chrome.runtime.sendMessage({ action: 'setProxy', proxy });
    setCurrentProxy(proxy);
    const startTime = Date.now();
    setConnectionStartTime(startTime);
    await chrome.storage.local.set({ activeProxy: proxy, connectionStartTime: startTime });
    startConnectionTimer();
    startMonitoring();
    startSpeedGraph();
    updateUI();
    filterProxies();
    renderQuickConnect();
    renderRecommended();
    showToast(`Reconnected to ${proxy.country}`, 'success');
  } catch (error) {
    showToast('Reconnect failed', 'error');
  }
}

// ============================================================================
// MONITORING & TIMERS
// ============================================================================

function startMonitoring() {
  const currentProxy = getCurrentProxy();
  if (currentProxy && !monitoringActive) {
    chrome.runtime.sendMessage({ action: 'startMonitoring', proxy: currentProxy });
    monitoringActive = true;
  }
}

function stopMonitoring() {
  if (monitoringActive) {
    chrome.runtime.sendMessage({ action: 'stopMonitoring' });
    monitoringActive = false;
  }
}

function startConnectionTimer() {
  const connectionTimer = document.getElementById('connectionTimer');
  if (connectionTimer) {
    connectionTimer.style.display = 'flex';
  }
  updateTimerDisplay();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  const connectionStartTime = getConnectionStartTime();
  if (!connectionStartTime) return;
  
  const timerValue = document.querySelector('.timer-value');
  if (!timerValue) return;
  
  const elapsed = Date.now() - connectionStartTime;
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  timerValue.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function stopConnectionTimer() {
  const connectionTimer = document.getElementById('connectionTimer');
  const timerValue = document.querySelector('.timer-value');
  
  if (connectionTimer) connectionTimer.style.display = 'none';
  if (timerInterval) clearInterval(timerInterval);
  if (timerValue) timerValue.textContent = '00:00';
}

function updateConnectionTime() {
  const connectionStartTime = getConnectionStartTime();
  if (connectionStartTime) {
    const elapsed = Math.floor((Date.now() - connectionStartTime) / 1000);
    updateDailyStats({ connectionTime: getDailyStats().connectionTime + elapsed });
  }
}

// ============================================================================
// IP DETECTOR
// ============================================================================

async function checkIpAddresses() {
  const ipInfo = getIpInfo();
  if (ipInfo.isLoading) return;
  
  ipInfo.isLoading = true;
  const ipCheckBtn = document.getElementById('ipCheckBtn');
  if (ipCheckBtn) {
    ipCheckBtn.textContent = 'Checking...';
    ipCheckBtn.disabled = true;
  }
  
  try {
    // Check real IP (without proxy)
    const realIpPromise = (async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json', {
          method: 'GET',
          cache: 'no-store'
        });
        const data = await response.json();
        return data.ip;
      } catch (error) {
        return 'Unable to detect';
      }
    })();
    
    // Check proxy IP (through current proxy)
    const proxyIpPromise = (async () => {
      const currentProxy = getCurrentProxy();
      if (!currentProxy) {
        return 'Not connected';
      }
      try {
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
        
        const response = await fetch('https://api.ipify.org?format=json', {
          method: 'GET',
          cache: 'no-store'
        });
        
        await chrome.proxy.settings.clear({ scope: 'regular' });
        
        const data = await response.json();
        return data.ip;
      } catch (error) {
        return 'Proxy blocked';
      }
    })();
    
    const [realIp, proxyIp] = await Promise.all([realIpPromise, proxyIpPromise]);
    
    setIpInfo({ realIp, proxyIp, lastCheck: Date.now(), isLoading: false });
    
    const ipRealValue = document.getElementById('ipRealValue');
    const ipProxyValue = document.getElementById('ipProxyValue');
    
    if (ipRealValue) ipRealValue.textContent = realIp;
    if (ipProxyValue) ipProxyValue.textContent = proxyIp;
    
    // Check if IPs match (proxy not working)
    if (realIp && proxyIp && realIp === proxyIp && proxyIp !== 'Not connected') {
      showToast('⚠️ Warning: Proxy IP matches real IP!', 'warning');
    } else if (proxyIp && proxyIp !== 'Not connected' && proxyIp !== 'Proxy blocked') {
      // Run DNS leak test when connected
      const settings = getSettings();
      if (settings.dnsLeakProtection) {
        try {
          const dnsResult = await chrome.runtime.sendMessage({ 
            action: 'testDnsLeak', 
            proxyIp: proxyIp 
          });
          
          if (dnsResult && dnsResult.success) {
            if (dnsResult.leaking) {
              showToast('⚠️ DNS Leak Detected! Your real IP may be visible', 'error');
              // Update security indicator
              const securityStatus = getSecurityStatus();
              securityStatus.status = 'warning';
              setSecurityStatus(securityStatus);
              updateSecurityUI();
            } else {
              showToast('✅ DNS protection active - No leaks detected', 'success');
            }
          }
        } catch (e) {
          console.log('DNS leak test skipped:', e.message);
        }
      } else {
        showToast('✓ Proxy is working correctly', 'success');
      }
    }
    
  } catch (error) {
    showToast('IP check failed: ' + error.message, 'error');
  } finally {
    const ipInfo = getIpInfo();
    ipInfo.isLoading = false;
    setIpInfo(ipInfo);
    
    if (ipCheckBtn) {
      ipCheckBtn.textContent = 'Check IPs';
      ipCheckBtn.disabled = false;
    }
  }
}

// ============================================================================
// SECURITY TOGGLES
// ============================================================================

async function toggleDnsLeakProtection() {
  const securityStatus = getSecurityStatus();
  const enabled = !securityStatus.dnsLeakProtection;
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'toggleDnsLeakProtection',
      enabled: enabled
    });
    
    if (result.success) {
      securityStatus.dnsLeakProtection = enabled;
      setSecurityStatus(securityStatus);
      updateSecurityUI();
      showToast(`DNS leak protection ${enabled ? 'enabled' : 'disabled'}`, 'info');
    }
  } catch (error) {
    showToast('Failed to toggle DNS leak protection', 'error');
  }
}

async function toggleWebRtcProtection() {
  const securityStatus = getSecurityStatus();
  const enabled = !securityStatus.webRtcProtection;
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'toggleWebRtcProtection',
      enabled: enabled
    });
    
    if (result.success) {
      securityStatus.webRtcProtection = enabled;
      setSecurityStatus(securityStatus);
      updateSecurityUI();
      showToast(`WebRTC protection ${enabled ? 'enabled' : 'disabled'}`, 'info');
    }
  } catch (error) {
    showToast('Failed to toggle WebRTC protection', 'error');
  }
}

// ============================================================================
// HEALTH MONITORING
// ============================================================================

async function startHealthMonitoring() {
  const currentProxy = getCurrentProxy();
  if (currentProxy) {
    try {
      await chrome.runtime.sendMessage({ action: 'startHealthMonitoring', proxy: currentProxy });
      showToast('Health monitoring started', 'info');
    } catch (error) {
      showToast('Failed to start health monitoring', 'error');
    }
  } else {
    showToast('Connect to a proxy first', 'warning');
  }
}

async function stopHealthMonitoring() {
  try {
    await chrome.runtime.sendMessage({ action: 'stopHealthMonitoring' });
    showToast('Health monitoring stopped', 'info');
  } catch (error) {
    showToast('Failed to stop health monitoring', 'error');
  }
}

async function checkHealthStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ action: 'getHealthStatus' });
    showToast(`Quality: ${status.quality} | Avg Latency: ${status.avgLatency}ms`, 'info');
  } catch (error) {
    showToast('Failed to get health status', 'error');
  }
}

// ============================================================================
// AUTO-ROTATION
// ============================================================================

async function toggleAutoRotation() {
  const autoRotation = getAutoRotation();
  autoRotation.enabled = !autoRotation.enabled;
  
  const rotationToggle = document.getElementById('rotationToggle');
  if (rotationToggle) {
    rotationToggle.classList.toggle('active', autoRotation.enabled);
  }
  
  await chrome.storage.local.set({ autoRotation });
  
  if (autoRotation.enabled) {
    startAutoRotation();
    showToast(`Auto-rotation enabled (${autoRotation.interval / 60000} min)`, 'info');
  } else {
    stopAutoRotation();
    showToast('Auto-rotation disabled', 'info');
  }
}

function startAutoRotation() {
  const autoRotation = getAutoRotation();
  if (autoRotation.timer) clearInterval(autoRotation.timer);
  
  autoRotation.timer = setInterval(async () => {
    const currentProxy = getCurrentProxy();
    if (!currentProxy || !autoRotation.enabled) return;
    
    try {
      const currentCountry = currentProxy.country;
      const currentProxies = getProxies();
      const alternatives = currentProxies.filter(p =>
        p.country === currentCountry &&
        p.ipPort !== currentProxy.ipPort &&
        p.speedMs < 300
      );
      
      if (alternatives.length === 0) {
        console.log('No alternative proxies found');
        return;
      }
      
      const newProxy = alternatives.sort((a, b) => a.speedMs - b.speedMs)[0];
      showToast(`Auto-rotating to ${newProxy.ipPort} (${newProxy.speedMs}ms)`, 'info');
      
      await chrome.runtime.sendMessage({ action: 'setProxy', proxy: newProxy });
      setCurrentProxy(newProxy);
      const startTime = Date.now();
      setConnectionStartTime(startTime);
      autoRotation.lastRotation = startTime;
      await chrome.storage.local.set({ activeProxy: newProxy, connectionStartTime: startTime });
      
      startConnectionTimer();
      startSpeedGraph();
      updateUI();
      filterProxies();
      
    } catch (error) {
      console.error('Auto-rotation failed:', error);
    }
  }, autoRotation.interval);
}

function stopAutoRotation() {
  const autoRotation = getAutoRotation();
  if (autoRotation.timer) {
    clearInterval(autoRotation.timer);
    autoRotation.timer = null;
  }
}

async function updateRotationInterval(e) {
  const autoRotation = getAutoRotation();
  autoRotation.interval = parseInt(e.target.value);
  await chrome.storage.local.set({ autoRotation });
  
  if (autoRotation.enabled) {
    stopAutoRotation();
    startAutoRotation();
  }
  showToast(`Rotation interval: ${autoRotation.interval / 60000} min`, 'info');
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

function handleProxyDegraded(message) {
  const { proxy, latency, success, monitoringTime } = message;
  
  if (!success) {
    showToast(`⚠️ Proxy ${proxy.ipPort} stopped working`, 'warning');
    
    // Auto-failover if enabled
    const settings = getSettings();
    if (settings.autoFailover) {
      chrome.runtime.sendMessage({ action: 'getNextFailoverProxy' })
        .then(result => {
          if (result.proxy) {
            showToast('Auto-failover: Trying ' + result.proxy.country, 'info');
            const currentProxy = getCurrentProxy();
            if (currentProxy) {
              connectToProxy(result.proxy, { target: document.body });
            }
          }
        })
        .catch(error => {
          showToast('Auto-failover failed: ' + error.message, 'error');
        });
    }
  } else if (latency > 500) {
    showToast(`⚠️ High latency (${latency}ms)`, 'warning');
  }
  
  // Log degradation event
  console.log('Proxy degradation detected:', {
    proxy: proxy.ipPort,
    latency: latency,
    success: success,
    monitoringTime: monitoringTime
  });
}

function handleSecurityAlert(message) {
  const { type, details } = message;
  
  if (type === 'dnsLeak') {
    showToast('⚠️ DNS leak detected! Protection is active.', 'warning');
  } else if (type === 'webRtcLeak') {
    showToast('⚠️ WebRTC leak detected! Protection is active.', 'warning');
  }
  
  // Update security status
  const securityStatus = getSecurityStatus();
  securityStatus.status = 'warning';
  setSecurityStatus(securityStatus);
  updateSecurityUI();
}

function updateSecurityStatus(message) {
  const securityStatus = getSecurityStatus();
  setSecurityStatus({ ...securityStatus, ...message });
  updateSecurityUI();
  
  if (message.status === 'breach') {
    showToast('🚨 Security breach detected! Check connection status.', 'error');
  }
}

function handleConnectionDegraded(message) {
  const { type, quality, latency, packetLoss } = message;
  
  if (type === 'quality' && quality === 'poor') {
    showToast('⚠️ Connection quality degraded to poor', 'warning');
  } else if (type === 'latency' && latency > 500) {
    showToast(`⚠️ High latency detected: ${latency}ms`, 'warning');
  } else if (type === 'packetLoss' && packetLoss > 10) {
    showToast(`⚠️ High packet loss: ${packetLoss}%`, 'warning');
  }
  
  // Update health status
  const healthStatus = getHealthStatus();
  if (healthStatus) {
    healthStatus.quality = quality || 'poor';
    setHealthStatus(healthStatus);
    updateHealthUI();
  }
}

function updateHealthStatus(message) {
  const healthStatus = getHealthStatus();
  setHealthStatus({ ...healthStatus, ...message });
  updateHealthUI();
  
  // Also update connection quality badge
  if (message.avgLatency !== undefined) {
    updateConnectionQuality(message.avgLatency, message.packetLoss || 0);
  }
  
  if (message.quality === 'poor') {
    showToast('🚨 Connection quality is poor. Consider switching proxies.', 'error');
  }
}

// ============================================================================
// SPEED GRAPH
// ============================================================================

let speedData = [];
let speedGraphInterval = null;

function startSpeedGraph() {
  const speedGraphCanvas = document.getElementById('speedGraph');
  const speedGraphSection = document.getElementById('speedGraphSection');
  const currentLatencyEl = document.getElementById('currentLatency');
  const currentProxy = getCurrentProxy();
  
  if (!speedGraphCanvas || !currentProxy) return;
  
  speedData = [];
  if (speedGraphSection) speedGraphSection.style.display = 'block';
  
  speedGraphInterval = setInterval(async () => {
    if (!currentProxy) {
      stopSpeedGraph();
      return;
    }
    
    try {
      const testResult = await chrome.runtime.sendMessage({ 
        action: 'quickTest', 
        proxy: currentProxy 
      });
      
      if (testResult.success && testResult.latency) {
        speedData.push(testResult.latency);
        if (speedData.length > 30) speedData.shift();
        drawSpeedGraph();
        
        if (currentLatencyEl) {
          currentLatencyEl.textContent = testResult.latency + 'ms';
        }
      }
    } catch (error) {
      console.error('Speed test error:', error);
    }
  }, 2000);
}

function stopSpeedGraph() {
  if (speedGraphInterval) {
    clearInterval(speedGraphInterval);
    speedGraphInterval = null;
  }
  
  const speedGraphSection = document.getElementById('speedGraphSection');
  if (speedGraphSection) {
    speedGraphSection.style.display = 'none';
  }
  speedData = [];
}

function drawSpeedGraph() {
  const speedGraphCanvas = document.getElementById('speedGraph');
  if (!speedGraphCanvas || speedData.length < 2) return;
  
  const ctx = speedGraphCanvas.getContext('2d');
  const width = speedGraphCanvas.width;
  const height = speedGraphCanvas.height;
  
  ctx.clearRect(0, 0, width, height);
  
  const maxLatency = Math.max(...speedData, 100);
  const minLatency = 0;
  const range = maxLatency - minLatency || 1;
  
  ctx.beginPath();
  ctx.strokeStyle = '#64ffda';
  ctx.lineWidth = 2;
  
  speedData.forEach((latency, index) => {
    const x = (index / (speedData.length - 1)) * width;
    const y = height - ((latency - minLatency) / range) * (height - 4) - 2;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // Fill under the line
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = 'rgba(100, 255, 218, 0.15)';
  ctx.fill();
}

// ============================================================================
// SITE RULES
// ============================================================================

async function applyRuleForCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.url) {
      showToast('No active tab found', 'warning');
      return;
    }
    
    let hostname;
    try {
      hostname = new URL(tab.url).hostname;
    } catch (e) {
      showToast('Invalid tab URL', 'error');
      return;
    }
    
    // Find matching rule
    const rules = getSiteRules().filter(r => r.enabled).sort((a, b) => a.priority - b.priority);
    const rule = rules.find(r => matchesPattern(r.url, hostname, r.patternType));
    
    if (!rule) {
      showToast('No rule for this site. Create one in Settings.', 'warning');
      return;
    }
    
    // Apply the rule's proxy
    const proxies = getProxies();
    const proxy = proxies.find(p => rule.proxyIps.includes(p.ipPort));
    
    if (!proxy) {
      showToast('No available proxies for ' + rule.country, 'warning');
      return;
    }
    
    // Create a mock event object that works with connectToProxy
    const mockEvent = {
      target: document.createElement('div'),
      stopPropagation: () => {}
    };
    mockEvent.target.closest = () => null;
    mockEvent.target.querySelector = () => null;
    
    await connectToProxy(proxy, mockEvent);
    
    showToast(`Applied ${rule.country} proxy for ${hostname}`, 'success');
    
  } catch (error) {
    console.error('Error applying rule:', error);
    showToast('Failed to apply rule: ' + error.message, 'error');
  }
}

function matchesPattern(pattern, hostname, patternType) {
  switch (patternType) {
    case 'exact':
      return hostname === pattern;
    case 'wildcard':
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(hostname);
    case 'contains':
      return hostname.includes(pattern);
    case 'regex':
      try {
        return new RegExp(pattern).test(hostname);
      } catch {
        return false;
      }
    default:
      return hostname === pattern;
  }
}

// Export functions for testing
export {
  connectToProxy,
  disconnectProxy,
  reconnectToLastProxy,
  checkIpAddresses,
  applyRuleForCurrentTab,
  toggleDnsLeakProtection,
  toggleWebRtcProtection,
  startHealthMonitoring,
  stopHealthMonitoring,
  checkHealthStatus,
  toggleAutoRotation,
  updateRotationInterval,
  startConnectionTimer,
  stopConnectionTimer,
  updateConnectionTime,
  startSpeedGraph,
  stopSpeedGraph,
  handleProxyDegraded,
  handleSecurityAlert,
  updateSecurityStatus,
  updateHealthStatus,
  handleConnectionDegraded
};
