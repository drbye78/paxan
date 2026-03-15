// ProxyMania VPN - Auto-Rotation Module
// Automatic proxy switching at intervals

import { getState, setState, getAutoRotation, setAutoRotation } from './state.js';
import { showToast } from './toast.js';
import { saveAutoRotationSettings } from './storage.js';
import { getBestProxy, connectToProxy } from './connection.js';

// ============================================================================
// AUTO-ROTATION MANAGEMENT
// ============================================================================

/**
 * Toggle auto-rotation
 * @returns {Promise<void>}
 */
export async function toggleAutoRotation() {
  const autoRotation = getAutoRotation();
  const enabled = !autoRotation.enabled;
  
  setAutoRotation({ ...autoRotation, enabled });
  await saveAutoRotationSettings(getAutoRotation());
  
  const rotationToggle = document.getElementById('rotationToggle');
  if (rotationToggle) {
    rotationToggle.classList.toggle('active', enabled);
  }
  
  if (enabled) {
    startAutoRotation();
    showToast(`Auto-rotation enabled (${autoRotation.interval / 60000} min)`, 'info');
  } else {
    stopAutoRotation();
    showToast('Auto-rotation disabled', 'info');
  }
}

/**
 * Update rotation interval
 * @param {Event} e - Change event
 * @returns {Promise<void>}
 */
export async function updateRotationInterval(e) {
  const autoRotation = getAutoRotation();
  const interval = parseInt(e.target.value);
  
  setAutoRotation({ ...autoRotation, interval });
  await saveAutoRotationSettings(getAutoRotation());
  
  if (autoRotation.enabled) {
    stopAutoRotation();
    startAutoRotation();
  }
  
  showToast(`Rotation interval: ${interval / 60000} min`, 'info');
}

/**
 * Start auto-rotation timer
 */
export function startAutoRotation() {
  const autoRotation = getAutoRotation();
  
  if (!autoRotation.enabled) return;
  
  stopAutoRotation();
  
  const timer = setInterval(() => {
    rotateProxy();
  }, autoRotation.interval);
  
  setAutoRotation({ ...autoRotation, timer, lastRotation: Date.now() });
}

/**
 * Stop auto-rotation timer
 */
export function stopAutoRotation() {
  const autoRotation = getAutoRotation();
  
  if (autoRotation.timer) {
    clearInterval(autoRotation.timer);
  }
  
  setAutoRotation({ ...autoRotation, timer: null });
}

/**
 * Rotate to a new proxy
 */
async function rotateProxy() {
  const currentProxy = getCurrentProxy();
  const bestProxy = getBestProxy();
  
  if (!bestProxy) {
    showToast('No proxies available for rotation', 'warning');
    return;
  }
  
  // Don't rotate to the same proxy
  if (currentProxy && bestProxy.ipPort === currentProxy.ipPort) {
    // Find next best
    const proxies = getProxies();
    const alternatives = proxies.filter(p => p.ipPort !== currentProxy.ipPort);
    
    if (alternatives.length === 0) {
      return;
    }
    
    // Pick random alternative
    const nextProxy = alternatives[Math.floor(Math.random() * alternatives.length)];
    await connectToProxy(nextProxy);
  } else {
    await connectToProxy(bestProxy);
  }
  
  setAutoRotation({ ...getAutoRotation(), lastRotation: Date.now() });
  
  showToast('Auto-rotated to new proxy', 'info');
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get current proxy
 * @returns {Object|null} - Current proxy
 */
function getCurrentProxy() {
  const { getCurrentProxy } = require('./state.js');
  return getCurrentProxy();
}

/**
 * Get proxies
 * @returns {Array} - Proxies array
 */
function getProxies() {
  const { getProxies } = require('./state.js');
  return getProxies();
}

// Helper for require
function require(module) {
  console.warn(`Dynamic import not implemented: ${module}`);
  return {};
}
