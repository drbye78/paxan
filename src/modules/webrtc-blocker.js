// WebRTC Blocker - Content Script
// Runs at document_start to prevent WebRTC IP leaks

(function() {
  'use strict';
  
  // Only run once
  if (window.__webrtcBlockerInited) {
    return;
  }
  window.__webrtcBlockerInited = true;
  
  let protectionApplied = false;
  
  // Filter SDP to remove host and server reflexive candidates
  // Shared by both createOffer and createAnswer
  function filterSDP(sdp) {
    if (!sdp || !sdp.sdp) return sdp;
    const lines = sdp.sdp.split('\r\n');
    const filtered = lines.filter(line => {
      if (line.startsWith('a=candidate:')) {
        // Extract candidate type from the line
        const parts = line.split(' ');
        const typeIndex = parts.indexOf('typ');
        if (typeIndex >= 0 && typeIndex + 1 < parts.length) {
          const candidateType = parts[typeIndex + 1];
          if (candidateType === 'host' || candidateType === 'srflx') {
            return false; // remove this line
          }
        }
      }
      return true;
    });
    return new RTCSessionDescription({ type: sdp.type, sdp: filtered.join('\r\n') });
  }
  
  // Apply WebRTC protection
  function applyProtection() {
    if (protectionApplied) return;
    protectionApplied = true;
    
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
    
    // Preserve prototype chain and fix constructor bypass
    window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
    window.RTCPeerConnection.prototype.constructor = window.RTCPeerConnection;
    
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
    
    // Block WebRTC IP detection via createOffer with SDP filtering
    const originalCreateOffer = window.RTCPeerConnection.prototype.createOffer;
    window.RTCPeerConnection.prototype.createOffer = function() {
      return originalCreateOffer.apply(this, arguments).then(offer => {
        return filterSDP(offer);
      });
    };
    
    // Block WebRTC IP detection via createAnswer with same SDP filtering
    const originalCreateAnswer = window.RTCPeerConnection.prototype.createAnswer;
    window.RTCPeerConnection.prototype.createAnswer = function() {
      return originalCreateAnswer.apply(this, arguments).then(answer => {
        return filterSDP(answer);
      });
    };
    
    console.log('[WebRTC Blocker] Protection active');
  }
  
  // Apply protection immediately (synchronous), then adjust based on settings
  applyProtection();
  
  // Then asynchronously check if protection should be active
  function checkAndApplyProtection() {
    chrome.storage.local.get(['security']).then(data => {
      const security = data.security || {};
      const enabled = security.webRtcProtection !== false;
      if (!enabled && protectionApplied) {
        // Can't undo — would need page reload, but at least log
        console.debug('[WebRTC Blocker] Protection was disabled but already applied');
      }
    }).catch(() => {});
  }
  
  checkAndApplyProtection();
  
  // Listen for security storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.security) {
      const security = changes.security.newValue || {};
      const enabled = security.webRtcProtection !== false;
      if (enabled) {
        applyProtection();
      }
      // Note: can't easily undo protection once applied without page reload
    }
  });
})();
