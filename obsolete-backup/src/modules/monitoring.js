// ProxyMania VPN - Monitoring Module
// Connection monitoring, speed graph, health status

import { getState, setState, getHealthStatus, setHealthStatus, setSpeedData, getSpeedData } from './state.js';
import { showToast } from './toast.js';
import { updateConnectionQuality, updateHealthUI } from './ui-core.js';

// ============================================================================
// HEALTH MONITORING
// ============================================================================

/**
 * Start health monitoring
 * @param {Object} proxy - Proxy to monitor
 * @returns {Promise<void>}
 */
export async function startHealthMonitoring(proxy) {
  try {
    await chrome.runtime.sendMessage({ 
      action: 'startHealthMonitoring', 
      proxy 
    });
    
    setState({ monitoringActive: true });
    
    showToast('Health monitoring started', 'info');
  } catch (error) {
    showToast('Failed to start health monitoring', 'error');
  }
}

/**
 * Stop health monitoring
 * @returns {Promise<void>}
 */
export async function stopHealthMonitoring() {
  try {
    await chrome.runtime.sendMessage({ action: 'stopHealthMonitoring' });
    
    setState({ monitoringActive: false });
    
    showToast('Health monitoring stopped', 'info');
  } catch (error) {
    showToast('Failed to stop health monitoring', 'error');
  }
}

/**
 * Check health status
 * @returns {Promise<Object>} - Health status
 */
export async function checkHealthStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ action: 'getHealthStatus' });
    showToast(`Quality: ${status.quality} | Avg Latency: ${status.avgLatency}ms`, 'info');
    return status;
  } catch (error) {
    showToast('Failed to get health status', 'error');
    return null;
  }
}

/**
 * Update health status from background message
 * @param {Object} message - Status update message
 */
export function updateHealthStatus(message) {
  const { quality, avgLatency, lastCheck } = message;
  
  setHealthStatus({
    active: true,
    quality: quality || 'excellent',
    avgLatency: avgLatency || 0,
    lastCheck: lastCheck || Date.now()
  });
  
  updateHealthUI();
}

// ============================================================================
// SPEED GRAPH
// ============================================================================

/**
 * Start speed graph updates
 */
export function startSpeedGraph() {
  const { speedGraphInterval } = getState();
  
  if (speedGraphInterval) return;
  
  // Update speed data every 2 seconds
  const interval = setInterval(() => {
    updateSpeedData();
  }, 2000);
  
  setState({ speedGraphInterval: interval });
}

/**
 * Stop speed graph updates
 */
export function stopSpeedGraph() {
  const { speedGraphInterval } = getState();
  
  if (speedGraphInterval) {
    clearInterval(speedGraphInterval);
    setState({ speedGraphInterval: null });
  }
}

/**
 * Update speed data
 */
async function updateSpeedData() {
  const { getCurrentProxy } = require('./state.js');
  const currentProxy = getCurrentProxy();
  
  if (!currentProxy) return;
  
  try {
    // Test latency
    const start = Date.now();
    await fetch('https://www.google.com/favicon.ico', { 
      method: 'HEAD',
      cache: 'no-store'
    });
    const latency = Date.now() - start;
    
    // Update connection quality
    updateConnectionQuality(latency);
    
    // Update speed data
    const speedData = getSpeedData();
    speedData.push({ time: Date.now(), latency });
    
    // Keep last 30 data points
    if (speedData.length > 30) {
      speedData.shift();
    }
    
    setState({ speedData });
    
    // Draw graph
    drawSpeedGraph();
    
  } catch (error) {
    // Ignore errors in speed testing
  }
}

/**
 * Draw speed graph
 */
export function drawSpeedGraph() {
  const canvas = document.getElementById('speedGraph');
  if (!canvas) return;
  
  const speedData = getSpeedData();
  if (speedData.length < 2) return;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Get max latency for scaling
  const maxLatency = Math.max(...speedData.map(d => d.latency), 100);
  
  // Draw line
  ctx.beginPath();
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = 2;
  
  speedData.forEach((data, index) => {
    const x = (index / (speedData.length - 1)) * width;
    const y = height - (data.latency / maxLatency) * height;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // Draw area under line
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
  ctx.fill();
}

// ============================================================================
// CONNECTION DEGRADATION
// ============================================================================

/**
 * Handle connection degradation
 * @param {Object} message - Degradation message
 */
export function handleConnectionDegraded(message) {
  const { latency, packetLoss } = message;
  
  updateConnectionQuality(latency, packetLoss);
  
  if (latency > 1000 || packetLoss > 20) {
    showToast('Connection quality poor', 'warning');
  }
}

// ============================================================================
// SETUP
// ============================================================================

/**
 * Setup health monitoring listeners
 */
export function setupHealthListeners() {
  const startHealthBtn = document.getElementById('startHealthBtn');
  const stopHealthBtn = document.getElementById('stopHealthBtn');
  const checkHealthBtn = document.getElementById('checkHealthBtn');
  
  if (startHealthBtn) {
    startHealthBtn.addEventListener('click', () => {
      const { getCurrentProxy } = require('./state.js');
      const currentProxy = getCurrentProxy();
      
      if (currentProxy) {
        startHealthMonitoring(currentProxy);
      } else {
        showToast('Connect to a proxy first', 'warning');
      }
    });
  }
  
  if (stopHealthBtn) {
    stopHealthBtn.addEventListener('click', stopHealthMonitoring);
  }
  
  if (checkHealthBtn) {
    checkHealthBtn.addEventListener('click', checkHealthStatus);
  }
}
