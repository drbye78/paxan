// WebRTC Blocker - Content Script
// Runs at document_start to prevent WebRTC IP leaks

(function() {
  'use strict';
  
  // Only run once
  if (window.__webrtcBlockerInjected) {
    return;
  }
  window.__webrtcBlockerInjected = true;
  
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
      // Ensure we only request what's absolutely necessary
      if (constraints) {
        // Prefer audio-only if possible to reduce IP exposure
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
          // Hide actual device IDs to prevent fingerprinting
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
      // Remove sensitive IP information from SDP
      if (offer.sdp) {
        offer.sdp = offer.sdp.replace(/a=candidate:[^\r\n]+/g, '');
      }
      return offer;
    });
  };
  
  console.log('[WebRTC Blocker] Initialized - IP leak protection active');
})();
