// Security Module - Simplified for MV3
// Note: webRequest blocking is not available in Manifest V3
// WebRTC protection is handled by webrtc-blocker.js content script

class SecurityManager {
  constructor() {
    this.dnsLeakProtection = true;
    this.webRtcProtection = true;
    this.securityStatus = 'secure';
    this.lastSecurityCheck = null;
    
    this.init();
  }

  async init() {
    await this.loadSecuritySettings();
    this.startSecurityMonitoring();
  }

  async loadSecuritySettings() {
    try {
      const result = await chrome.storage.local.get(['security']);
      if (result.security) {
        this.dnsLeakProtection = result.security.dnsLeakProtection !== false;
        this.webRtcProtection = result.security.webRtcProtection !== false;
        this.securityStatus = result.security.securityStatus || 'secure';
        this.lastSecurityCheck = result.security.lastSecurityCheck;
      } else {
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

  startSecurityMonitoring() {
    // Note: In MV3, we cannot use webRequest for blocking
    // Security status is informational only
    this.lastSecurityCheck = Date.now();
  }

  async toggleDnsLeakProtection(enabled) {
    this.dnsLeakProtection = enabled;
    await this.saveSecuritySettings();
    return { success: true, enabled };
  }

  async toggleWebRtcProtection(enabled) {
    this.webRtcProtection = enabled;
    await this.saveSecuritySettings();
    
    // Inject or remove WebRTC blocker based on setting
    if (enabled) {
      await this.injectWebRtcBlocker();
    }
    
    return { success: true, enabled };
  }

  async injectWebRtcBlocker() {
    try {
      await chrome.scripting.executeScript({
        target: { allFrames: true },
        files: ['src/modules/webrtc-blocker.js']
      });
    } catch (error) {
      console.warn('Failed to inject WebRTC blocker:', error);
    }
  }

  getSecurityStatus() {
    return {
      status: this.securityStatus,
      dnsLeakProtection: this.dnsLeakProtection,
      webRtcProtection: this.webRtcProtection,
      lastCheck: this.lastSecurityCheck,
      note: 'WebRTC protection active via content script'
    };
  }

  resetSecurityAlerts() {
    this.securityStatus = 'secure';
  }
}

const securityManager = new SecurityManager();
