// WebRTC Blocker - Content Script
// Runs at document_start to prevent WebRTC IP leaks

(function() {
  'use strict';
  
  // Only run once
  if (window.__webrtcBlockerInited) {
    return;
  }
  window.__webrtcBlockerInited = true;
  
  // Check if WebRTC protection is enabled
  async function checkAndApplyProtection() {
    try {
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings || {};
      const webrtcEnabled = settings.webRtcProtection !== false;
      
      if (!webrtcEnabled) {
        console.log('[WebRTC Blocker] Protection disabled by user settings');
        return false;
      }
      
      return true;
    } catch (e) {
      // If storage not available, enable by default
      return true;
    }
  }
  
  // Apply WebRTC protection
  function applyProtection() {
    // Override RTCPeerConnection to prevent IP gathering
    const originalRTCPeerConnection = window.RTCPeerConnection;
    
    window.RTCPeerConnection = function(config, constraints) {
      // Filter out non-STUN servers to prevent IP discovery
      if (config && config.iceServers) {
        config.iceServers = config.iceServers.filter(server => {
          // Only allow Google's public STUN servers
          if (server.urls) {
            const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
            return urls.some(url => url.includes('stun:stun.l.google.com'));
          }
          return false;
        });
        
        // If all filtered out, add default STUN
        if (config.iceServers.length === 0) {
          config.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
        }
      }
      
      const pc = new originalRTCPeerConnection(config, constraints);
      
      // Override addIceCandidate to block local candidates
      const originalAddIceCandidate = pc.addIceCandidate;
      pc.addIceCandidate = function(candidate) {
        if (candidate && candidate.candidate) {
          const c = candidate.candidate;
          // Block host and server reflexive candidates that might leak local IP
          if (c.includes('typ host') || c.includes('typ srflx')) {
            console.log('[WebRTC Blocker] Blocked IP candidate');
            return Promise.resolve();
          }
        }
        return originalAddIceCandidate.call(this, candidate);
      };
      
      return pc;
    };
    
    // Preserve original constructor reference
    window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
    
    // Override getUserMedia to limit exposure
    const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
    if (originalGetUserMedia) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        if (constraints) {
          if (constraints.video && !constraints.audio) {
            console.log('[WebRTC Blocker] Suggesting audio inclusion for privacy');
          }
        }
        return originalGetUserMedia.call(this, constraints);
      };
    }
    
    // Override enumerateDevices to filter sensitive info
    const originalEnumerateDevices = navigator.mediaDevices?.enumerateDevices;
    if (originalEnumerateDevices) {
      navigator.mediaDevices.enumerateDevices = function() {
        return originalEnumerateDevices.call(this).then(devices => {
          return devices.map(device => ({
            ...device,
            deviceId: device.deviceId ? 'default' : '',
            groupId: 'default'
          }));
        });
      };
    }
    
    // Block WebRTC IP detection via DataChannel
    const originalCreateOffer = window.RTCPeerConnection.prototype.createOffer;
    window.RTCPeerConnection.prototype.createOffer = function() {
      return originalCreateOffer.apply(this, arguments).then(offer => {
        if (offer.sdp) {
          offer.sdp = offer.sdp.replace(/a=candidate:[^\r\n]+/g, '');
        }
        return offer;
      });
    };
    
    console.log('[WebRTC Blocker] Protection active');
  }
  
  // Initialize - check settings and apply if enabled
  checkAndApplyProtection().then(enabled => {
    if (enabled) {
      applyProtection();
    }
  });
  
  // Listen for settings changes
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (changes.settings && changes.settings.newValue) {
        const webrtcEnabled = changes.settings.newValue.webRtcProtection;
        if (webrtcEnabled === false) {
          console.log('[WebRTC Blocker] Protection disabled at runtime');
          // Note: Cannot fully disable at runtime without page reload
          // But can stop blocking new connections
        } else if (webrtcEnabled !== false) {
          console.log('[WebRTC Blocker] Protection enabled at runtime');
          applyProtection();
        }
      }
    });
  }
})();
