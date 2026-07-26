// PeasyProxy - Quality Monitor Module
// Implements connection quality metrics and monitoring

import { THRESHOLDS, QUALITY_THRESHOLDS } from '../popup/constants.js';
import { proxyConfig } from './proxy-config-manager.js';
import { buildProxyConfig } from '../shared/utils.js';

const QUALITY_MONITOR_ALARM = 'qualityMonitoring';
const QUALITY_METRICS_STORAGE_KEY = 'qualityMonitorMetrics';

// ============================================================================
// QUALITY METRICS
// ============================================================================

// Quality levels
const QUALITY_LEVELS = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor'
};

// ============================================================================
// QUALITY MONITORING
// ============================================================================

// Monitor connection quality
class QualityMonitor {
  constructor() {
    this.metrics = {
      latency: 0,
      jitter: 0,
      packetLoss: 0,
      bandwidth: 0,
      stability: 100,
      score: QUALITY_LEVELS.EXCELLENT
    };
    this.history = [];
    this.maxHistorySize = 100;
  }

  // Update metrics
  updateMetrics(newMetrics) {
    this.metrics = {
      ...this.metrics,
      ...newMetrics,
      score: this.calculateQualityScore(newMetrics)
    };

    // Add to history
    this.history.push({
      ...this.metrics,
      timestamp: Date.now()
    });

    // Keep history size limited
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    return this.metrics;
  }

  // Calculate quality score
  calculateQualityScore(metrics) {
    const { latency, jitter, packetLoss } = metrics;

    // Check for excellent quality
    if (
      latency <= QUALITY_THRESHOLDS.EXCELLENT_LATENCY &&
      packetLoss <= QUALITY_THRESHOLDS.EXCELLENT_PACKET_LOSS &&
      jitter <= 20
    ) {
      return QUALITY_LEVELS.EXCELLENT;
    }

    // Check for good quality
    if (
      latency <= QUALITY_THRESHOLDS.GOOD_LATENCY &&
      packetLoss <= QUALITY_THRESHOLDS.GOOD_PACKET_LOSS &&
      jitter <= 50
    ) {
      return QUALITY_LEVELS.GOOD;
    }

    // Check for fair quality
    if (
      latency <= QUALITY_THRESHOLDS.FAIR_LATENCY &&
      packetLoss <= QUALITY_THRESHOLDS.FAIR_PACKET_LOSS &&
      jitter <= 100
    ) {
      return QUALITY_LEVELS.FAIR;
    }

    // Poor quality
    return QUALITY_LEVELS.POOR;
  }

  // Get current metrics
  getMetrics() {
    return { ...this.metrics };
  }

  // Get history
  getHistory() {
    return [...this.history];
  }

  // Get average metrics
  getAverageMetrics() {
    if (this.history.length === 0) {
      return this.metrics;
    }

    const sum = this.history.reduce(
      (acc, m) => ({
        latency: acc.latency + m.latency,
        jitter: acc.jitter + m.jitter,
        packetLoss: acc.packetLoss + m.packetLoss,
        bandwidth: acc.bandwidth + m.bandwidth,
        stability: acc.stability + m.stability
      }),
      { latency: 0, jitter: 0, packetLoss: 0, bandwidth: 0, stability: 0 }
    );

    const count = this.history.length;

    return {
      latency: Math.round(sum.latency / count),
      jitter: Math.round(sum.jitter / count),
      packetLoss: Math.round(sum.packetLoss / count * 10) / 10,
      bandwidth: Math.round(sum.bandwidth / count * 10) / 10,
      stability: Math.round(sum.stability / count)
    };
  }

  // Reset metrics
  reset() {
    this.metrics = {
      latency: 0,
      jitter: 0,
      packetLoss: 0,
      bandwidth: 0,
      stability: 100,
      score: QUALITY_LEVELS.EXCELLENT
    };
    this.history = [];
  }
}

// Create singleton instance
const qualityMonitor = new QualityMonitor();

// ============================================================================
// QUALITY MEASUREMENTS
// ============================================================================

// Measure latency using proxyConfig.withTestConfig
async function measureLatency(proxy) {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const testConfig = buildProxyConfig(proxy);
    return await proxyConfig.withTestConfig(testConfig, async () => {
      const response = await fetch('https://httpbin.org/ip', {
        signal: controller.signal, cache: 'no-store'
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const latency = Math.round(performance.now() - startTime);
        return { success: true, latency };
      }
      return { success: false, latency: null };
    }, { timeoutMs: 5000, settleMs: 50 });
  } catch (error) {
    clearTimeout(timeoutId);
    return { success: false, latency: null };
  }
}

// Measure jitter (latency variation) — now takes a proxy object and runs multiple measurements
async function calculateJitter(proxy) {
  const testConfig = buildProxyConfig(proxy);
  const latencies = [];

  await proxyConfig.withTestConfig(testConfig, async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        try {
          const response = await fetch('https://httpbin.org/ip', {
            signal: controller.signal, cache: 'no-store'
          });
          if (response.ok) {
            latencies.push(Math.round(performance.now() - start));
          }
        } catch { /* sample failed, skip */ }
        if (i < 4) await new Promise(r => setTimeout(r, 200));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, { timeoutMs: 20000, settleMs: 50 });

  if (latencies.length < 2) return 0;

  const differences = [];
  for (let i = 1; i < latencies.length; i++) {
    differences.push(Math.abs(latencies[i] - latencies[i - 1]));
  }

  return Math.round(
    differences.reduce((a, b) => a + b, 0) / differences.length
  );
}

// Estimate packet loss — sets proxy once then runs multiple checks
async function estimatePacketLoss(proxy, samples = 5) {
  let failures = 0;
  const testConfig = buildProxyConfig(proxy);

  await proxyConfig.withTestConfig(testConfig, async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      for (let i = 0; i < samples; i++) {
        try {
          const response = await fetch('https://httpbin.org/ip', {
            signal: controller.signal, cache: 'no-store'
          });
          if (!response.ok) failures++;
        } catch {
          failures++;
        }
        if (i < samples - 1) await new Promise(r => setTimeout(r, 200));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, { timeoutMs: 15000, settleMs: 50 });

  return Math.round((failures / samples) * 100);
}

// Estimate bandwidth — uses proxyConfig.withTestConfig
async function estimateBandwidth(proxy) {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const testConfig = buildProxyConfig(proxy);
    return await proxyConfig.withTestConfig(testConfig, async () => {
      const response = await fetch('https://httpbin.org/bytes/102400', {
        signal: controller.signal, cache: 'no-store'
      });
      clearTimeout(timeoutId);
      const elapsed = (performance.now() - startTime) / 1000;
      if (response.ok) {
        const data = await response.arrayBuffer();
        const sizeMB = data.byteLength / (1024 * 1024);
        const bandwidth = elapsed > 0 ? Math.round(sizeMB / elapsed) : 0;
        return { success: true, bandwidth };
      }
      return { success: false, bandwidth: 0 };
    }, { timeoutMs: 7000, settleMs: 50 });
  } catch (error) {
    clearTimeout(timeoutId);
    return { success: false, bandwidth: 0 };
  }
}

// Calculate stability score
function calculateStability(metricsHistory) {
  if (metricsHistory.length < 2) return 100;

  const latencies = metricsHistory.map(m => m.latency).filter(l => l > 0);
  if (latencies.length < 2) return 100;

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  // Guard against NaN when avg is 0 or latencies are all zero
  if (avg === 0 || latencies.length === 0) return 100;

  const variance = latencies.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / latencies.length;
  const stdDev = Math.sqrt(variance);

  // Stability is inverse of coefficient of variation
  const coefficientOfVariation = stdDev / avg;
  const stability = Math.max(0, Math.round(100 - (coefficientOfVariation * 100)));

  return Math.min(100, stability);
}

// ============================================================================
// QUALITY MONITORING API
// ============================================================================

// Start quality monitoring
async function startQualityMonitoring(proxy, intervalMinutes = 0.5) {
  try {
    // Store proxy reference for alarm handler
    await chrome.storage.local.set({ qualityMonitorProxy: proxy });

    // Create alarm for periodic monitoring
    await chrome.alarms.create(QUALITY_MONITOR_ALARM, {
      delayInMinutes: intervalMinutes,
      periodInMinutes: intervalMinutes
    });

    // Do initial measurement
    const latencyResult = await measureLatency(proxy);
    const packetLoss = await estimatePacketLoss(proxy, 3);

    const metrics = {
      latency: latencyResult.latency || 0,
      jitter: 0,
      packetLoss,
      bandwidth: 0,
      stability: 100
    };

    qualityMonitor.updateMetrics(metrics);

    // Also persist to storage for SW restart resilience
    await chrome.storage.local.set({ [QUALITY_METRICS_STORAGE_KEY]: qualityMonitor.getMetrics() });

    return {
      success: true,
      metrics: qualityMonitor.getMetrics()
    };
  } catch (error) {
    console.error('Quality monitoring failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Stop quality monitoring
function stopQualityMonitoring() {
  chrome.alarms.clear(QUALITY_MONITOR_ALARM);
  qualityMonitor.reset();
  return { success: true };
}

// Handle quality monitoring alarm — reads/writes directly to chrome.storage.local
// to survive service worker restarts
async function handleQualityAlarm() {
  const { qualityMonitorProxy } = await chrome.storage.local.get(['qualityMonitorProxy']);
  if (!qualityMonitorProxy) return;

  try {
    const latencyResult = await measureLatency(qualityMonitorProxy);
    const packetLoss = await estimatePacketLoss(qualityMonitorProxy);
    const jitterResult = await calculateJitter(qualityMonitorProxy);

    // Bandwidth is expensive — only measure periodically (every ~10th call)
    let bandwidth = qualityMonitor.metrics.bandwidth;
    try {
      const stored = await chrome.storage.local.get([QUALITY_METRICS_STORAGE_KEY]);
      if (stored[QUALITY_METRICS_STORAGE_KEY]?.bandwidth) {
        bandwidth = stored[QUALITY_METRICS_STORAGE_KEY].bandwidth;
      }
    } catch {}
    if (Math.random() < 0.1) {
      const bwResult = await estimateBandwidth(qualityMonitorProxy);
      bandwidth = bwResult.bandwidth || 0;
    }

    const metrics = {
      latency: latencyResult.latency || 0,
      jitter: jitterResult,
      packetLoss,
      bandwidth,
      lastCheck: Date.now()
    };

    // Update in-memory singleton for this session
    qualityMonitor.updateMetrics(metrics);

    // Persist to storage so metrics survive service worker restarts
    await chrome.storage.local.set({ [QUALITY_METRICS_STORAGE_KEY]: qualityMonitor.getMetrics() });
  } catch (error) {
    console.error('Quality alarm error:', error);
  }
}

// Get quality status — loads from storage if available (survives SW restart)
function getQualityStatus() {
  const metrics = qualityMonitor.getMetrics();
  const average = qualityMonitor.getAverageMetrics();

  return {
    success: true,
    current: metrics,
    average,
    historyCount: qualityMonitor.history.length
  };
}

// Get quality recommendations
function getQualityRecommendations(metrics) {
  const recommendations = [];

  if (metrics.latency > QUALITY_THRESHOLDS.GOOD_LATENCY) {
    recommendations.push({
      type: 'latency',
      severity: metrics.latency > QUALITY_THRESHOLDS.FAIR_LATENCY ? 'high' : 'medium',
      message: `High latency detected (${metrics.latency}ms)`,
      suggestion: 'Try a proxy closer to your location'
    });
  }

  if (metrics.packetLoss > QUALITY_THRESHOLDS.GOOD_PACKET_LOSS) {
    recommendations.push({
      type: 'packetLoss',
      severity: metrics.packetLoss > QUALITY_THRESHOLDS.FAIR_PACKET_LOSS ? 'high' : 'medium',
      message: `High packet loss (${metrics.packetLoss}%)`,
      suggestion: 'Try a different proxy or check network connection'
    });
  }

  if (metrics.jitter > 50) {
    recommendations.push({
      type: 'jitter',
      severity: metrics.jitter > 100 ? 'high' : 'medium',
      message: `High jitter detected (${metrics.jitter}ms)`,
      suggestion: 'Connection may be unstable, try another proxy'
    });
  }

  if (metrics.stability < 70) {
    recommendations.push({
      type: 'stability',
      severity: metrics.stability < 50 ? 'high' : 'medium',
      message: `Low connection stability (${metrics.stability}%)`,
      suggestion: 'Proxy may be unreliable, consider switching'
    });
  }

  return recommendations;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Constants
  QUALITY_LEVELS,
  QUALITY_MONITOR_ALARM,
  
  // Monitor
  QualityMonitor,
  qualityMonitor,
  
  // Measurements
  measureLatency,
  calculateJitter,
  estimatePacketLoss,
  estimateBandwidth,
  calculateStability,
  
  // API
  startQualityMonitoring,
  stopQualityMonitoring,
  getQualityStatus,
  getQualityRecommendations,
  handleQualityAlarm
};
