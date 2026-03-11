// Security Module - DNS Leak Protection & WebRTC Leak Prevention
// Phase 1: Security & Core UX

class SecurityManager {
  constructor() {
    this.dnsLeakProtection = true;
    this.webRtcProtection = true;
    this.securityStatus = 'secure';
    this.lastSecurityCheck = null;
    this.dnsLeakDetected = false;
    this.webRtcLeakDetected = false;
    
    this.init();
  }

  async init() {
    // Load security settings from storage
    await this.loadSecuritySettings();
    
    // Set up security monitoring
    if (this.dnsLeakProtection) {
      this.setupDnsLeakProtection();
    }
    
    if (this.webRtcProtection) {
      this.setupWebRtcProtection();
    }
    
    // Start periodic security checks
    this.startSecurityMonitoring();
  }

  // DNS Leak Protection
  setupDnsLeakProtection() {
    // Monitor webRequest for DNS requests
    if (chrome.webRequest && chrome.webRequest.onBeforeRequest) {
      chrome.webRequest.onBeforeRequest.addListener(
        this.handleDnsRequest.bind(this),
        { urls: ["<all_urls>"] },
        ["blocking"]
      );
    }
  }

  async handleDnsRequest(details) {
    // Check if this is a DNS request that might leak
    const isDnsRequest = this.isDnsRequest(details);
    
    if (isDnsRequest && this.dnsLeakProtection) {
      const currentProxy = await this.getCurrentProxy();
      
      if (!currentProxy) {
        // No proxy active, allow request
        return { cancel: false };
      }
      
      // Check if request would bypass proxy
      const wouldBypassProxy = this.wouldBypassProxy(details, currentProxy);
      
      if (wouldBypassProxy) {
        this.reportDnsLeak(details);
        return { cancel: true }; // Block the leak
      }
    }
    
    return { cancel: false };
  }

  isDnsRequest(details) {
    // Identify DNS-related requests
    const url = details.url || '';
    const type = details.type || '';
    
    // DNS over HTTPS requests
    if (url.includes('dns.google') || url.includes('cloudflare-dns.com')) {
      return true;
    }
    
    // DNS API requests
    if (type === 'xmlhttprequest' && (
      url.includes('/dns-query') || 
      url.includes('/resolve') ||
      url.includes('dns.')
    )) {
      return true;
    }
    
    return false;
  }

  wouldBypassProxy(details, proxy) {
    // Check if request would bypass the configured proxy
    const url = details.url || '';
    
    // Allow bypass for proxy itself
    if (url.includes(`${proxy.ip}:${proxy.port}`)) {
      return false;
    }
    
    // Allow bypass for essential services
    const bypassList = [
      'localhost', '127.0.0.1', '::1',
      'chrome-extension://', 'chrome://',
      'https://proxymania.su'
    ];
    
    for (const bypass of bypassList) {
      if (url.includes(bypass)) {
        return false;
      }
    }
    
    // Block if not in bypass list
    return true;
  }

  reportDnsLeak(details) {
    this.dnsLeakDetected = true;
    this.securityStatus = 'warning';
    this.lastSecurityCheck = Date.now();
    
    // Notify popup of security issue
    chrome.runtime.sendMessage({
      action: 'securityAlert',
      type: 'dnsLeak',
      details: details
    });
    
    // Log security event
    console.warn('DNS leak detected:', details.url);
  }

  // WebRTC Leak Prevention
  setupWebRtcProtection() {
    // Inject content script to control WebRTC
    this.injectWebRtcBlocker();
    
    // Monitor for WebRTC attempts
    chrome.webRequest.onBeforeRequest.addListener(
      this.handleWebRtcRequest.bind(this),
      { urls: ["<all_urls>"] },
      ["blocking"]
    );
  }

  injectWebRtcBlocker() {
    const webRtcBlocker = `
      // Block WebRTC IP exposure
      (function() {
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
        
        navigator.mediaDevices.getUserMedia = function(constraints) {
          // Add audio constraint to prevent video access
          if (constraints.video && !constraints.audio) {
            constraints.audio = true;
          }
          return originalGetUserMedia.call(this, constraints);
        };
        
        navigator.mediaDevices.enumerateDevices = function() {
          return originalEnumerateDevices.call(this).then(devices => {
            // Filter out device IDs that could leak IP
            return devices.map(device => ({
              ...device,
              deviceId: device.kind === 'audioinput' ? device.deviceId : 'default',
              groupId: 'default'
            }));
          });
        };
        
        // Override RTCPeerConnection to prevent IP gathering
        const originalRTCPeerConnection = window.RTCPeerConnection;
        window.RTCPeerConnection = function(config, constraints) {
          // Modify config to prevent IP gathering
          if (config && config.iceServers) {
            config.iceServers = config.iceServers.filter(server => 
              server.urls && server.urls.includes('stun:stun.l.google.com')
            );
          }
          
          const pc = new originalRTCPeerConnection(config, constraints);
          
          // Override addIceCandidate to block local candidates
          const originalAddIceCandidate = pc.addIceCandidate;
          pc.addIceCandidate = function(candidate) {
            if (candidate && candidate.candidate && 
                (candidate.candidate.includes('typ host') || 
                 candidate.candidate.includes('typ srflx'))) {
              console.log('Blocked WebRTC IP candidate');
              return Promise.resolve();
            }
            return originalAddIceCandidate.call(this, candidate);
          };
          
          return pc;
        };
      })();
    `;
    
    // Inject into all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.executeScript(tab.id, {
            code: webRtcBlocker,
            runAt: 'document_start'
          });
        }
      });
    });
  }

  handleWebRtcRequest(details) {
    const url = details.url || '';
    
    // Block WebRTC signaling requests that could leak IP
    if (url.includes('webrtc') || url.includes('peerconnection')) {
      this.reportWebRtcLeak(details);
      return { cancel: true };
    }
    
    return { cancel: false };
  }

  reportWebRtcLeak(details) {
    this.webRtcLeakDetected = true;
    this.securityStatus = 'warning';
    this.lastSecurityCheck = Date.now();
    
    // Notify popup of security issue
    chrome.runtime.sendMessage({
      action: 'securityAlert',
      type: 'webRtcLeak',
      details: details
    });
    
    // Log security event
    console.warn('WebRTC leak detected:', details.url);
  }

  // Security Monitoring
  startSecurityMonitoring() {
    // Check security status every 30 seconds
    setInterval(async () => {
      await this.performSecurityCheck();
    }, 30000);
  }

  async performSecurityCheck() {
    const currentProxy = await this.getCurrentProxy();
    
    if (!currentProxy) {
      this.securityStatus = 'secure';
      return;
    }
    
    // Test for DNS leaks
    const dnsLeakTest = await this.testDnsLeak(currentProxy);
    
    // Test for WebRTC leaks
    const webRtcLeakTest = await this.testWebRtcLeak();
    
    // Update security status
    if (dnsLeakTest.leaked || webRtcLeakTest.leaked) {
      this.securityStatus = 'breach';
      this.lastSecurityCheck = Date.now();
      
      // Notify popup
      chrome.runtime.sendMessage({
        action: 'securityStatusUpdate',
        status: this.securityStatus,
        issues: {
          dnsLeak: dnsLeakTest.leaked,
          webRtcLeak: webRtcLeakTest.leaked
        }
      });
    } else if (this.dnsLeakDetected || this.webRtcLeakDetected) {
      this.securityStatus = 'warning';
    } else {
      this.securityStatus = 'secure';
    }
  }

  async testDnsLeak(proxy) {
    // Test DNS resolution through proxy
    try {
      const testUrl = `http://${proxy.ip}:${proxy.port}/dns-test`;
      const response = await fetch(testUrl, {
        method: 'HEAD',
        timeout: 5000
      });
      
      return {
        leaked: !response.ok,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        leaked: true,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  async testWebRtcLeak() {
    // Test WebRTC IP exposure
    return new Promise((resolve) => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        pc.createDataChannel('');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
        pc.onicecandidate = (ice) => {
          if (!ice || !ice.candidate || ice.candidate.candidate === '') {
            pc.close();
            resolve({ leaked: false, timestamp: Date.now() });
            return;
          }
          
          // Check if candidate reveals local IP
          const hasLocalIp = ice.candidate.candidate.includes('typ host') ||
                           ice.candidate.candidate.includes('192.168.') ||
                           ice.candidate.candidate.includes('10.') ||
                           ice.candidate.candidate.includes('172.');
          
          pc.close();
          resolve({
            leaked: hasLocalIp,
            candidate: ice.candidate.candidate,
            timestamp: Date.now()
          });
        };
        
        // Timeout after 3 seconds
        setTimeout(() => {
          pc.close();
          resolve({ leaked: false, timeout: true, timestamp: Date.now() });
        }, 3000);
        
      } catch (error) {
        resolve({
          leaked: true,
          error: error.message,
          timestamp: Date.now()
        });
      }
    });
  }

  // Storage Management
  async loadSecuritySettings() {
    try {
      const result = await chrome.storage.local.get(['security']);
      if (result.security) {
        this.dnsLeakProtection = result.security.dnsLeakProtection !== false;
        this.webRtcProtection = result.security.webRtcProtection !== false;
        this.securityStatus = result.security.securityStatus || 'secure';
        this.lastSecurityCheck = result.security.lastSecurityCheck;
      } else {
        // Initialize with defaults
        await this.saveSecuritySettings();
      }
    } catch (error) {
      console.error('Error loading security settings:', error);
    }
  }

  async saveSecuritySettings() {
    try {
      await chrome.storage.local.set({
        security: {
          dnsLeakProtection: this.dnsLeakProtection,
          webRtcProtection: this.webRtcProtection,
          securityStatus: this.securityStatus,
          lastSecurityCheck: this.lastSecurityCheck
        }
      });
    } catch (error) {
      console.error('Error saving security settings:', error);
    }
  }

  // Public API
  async toggleDnsLeakProtection(enabled) {
    this.dnsLeakProtection = enabled;
    await this.saveSecuritySettings();
    
    if (enabled) {
      this.setupDnsLeakProtection();
    }
    
    return { success: true, enabled };
  }

  async toggleWebRtcProtection(enabled) {
    this.webRtcProtection = enabled;
    await this.saveSecuritySettings();
    
    if (enabled) {
      this.setupWebRtcProtection();
    }
    
    return { success: true, enabled };
  }

  getSecurityStatus() {
    return {
      status: this.securityStatus,
      dnsLeakProtection: this.dnsLeakProtection,
      webRtcProtection: this.webRtcProtection,
      lastCheck: this.lastSecurityCheck,
      dnsLeakDetected: this.dnsLeakDetected,
      webRtcLeakDetected: this.webRtcLeakDetected
    };
  }

  async getCurrentProxy() {
    try {
      const result = await chrome.storage.local.get(['activeProxy']);
      return result.activeProxy || null;
    } catch (error) {
      return null;
    }
  }

  resetSecurityAlerts() {
    this.dnsLeakDetected = false;
    this.webRtcLeakDetected = false;
    this.securityStatus = 'secure';
  }
}

// Initialize security manager
const securityManager = new SecurityManager();

// Export for use in background.js
if (typeof module !== 'undefined') {
  module.exports = SecurityManager;
}

// Message handlers for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleDnsLeakProtection') {
    securityManager.toggleDnsLeakProtection(request.enabled)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'toggleWebRtcProtection') {
    securityManager.toggleWebRtcProtection(request.enabled)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getSecurityStatus') {
    sendResponse(securityManager.getSecurityStatus());
    return false;
  }
  
  if (request.action === 'resetSecurityAlerts') {
    securityManager.resetSecurityAlerts();
    sendResponse({ success: true });
    return false;
  }
});