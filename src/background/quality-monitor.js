// ProxyMania VPN - Quality Monitor Module
// Implements connection quality metrics and monitoring

const { THRESHOLDS, QUALITY_THRESHOLDS } = require('../popup/constants.js');

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
      packetLoss <= QUALITY_THRESHOLDS.EXCELLENT_PACKET_LOSS
    ) {
      return QUALITY_LEVELS.EXCELLENT;
    }

    // Check for good quality
    if (
      latency <= QUALITY_THRESHOLDS.GOOD_LATENCY &&
      packetLoss <= QUALITY_THRESHOLDS.GOOD_PACKET_LOSS
    ) {
      return QUALITY_LEVELS.GOOD;
    }

    // Check for fair quality
    if (
      latency <= QUALITY_THRESHOLDS.FAIR_LATENCY &&
      packetLoss <= QUALITY_THRESHOLDS.FAIR_PACKET_LOSS
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

// Measure latency
async function measureLatency(proxy) {
  const startTime = Date.now();
  
  try {
    const testConfig = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
          host: proxy.ip,
          port: proxy.port
        },
        bypassList: ['localhost', '127.0.0.1']
      }
    };

    await chrome.proxy.settings.set({ value: testConfig, scope: 'regular' });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://httpbin.org/ip', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store'
    });

    clearTimeout(timeoutId);

    await chrome.proxy.settings.clear({ scope: 'regular' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      success: true,
      latency: Date.now() - startTime
    };
  } catch (error) {
    await chrome.proxy.settings.clear({ scope: 'regular' });
    return {
      success: false,
      latency: null,
      error: error.message
    };
  }
}

// Measure jitter (latency variation)
function calculateJitter(latencies) {
  if (latencies.length < 2) return 0;

  const differences = [];
  for (let i = 1; i < latencies.length; i++) {
    differences.push(Math.abs(latencies[i] - latencies[i - 1]));
  }

  return Math.round(
    differences.reduce((a, b) => a + b, 0) / differences.length
  );
}

// Estimate packet loss
async function estimatePacketLoss(proxy, samples = 5) {
  let successes = 0;
  let failures = 0;

  for (let i = 0; i < samples; i++) {
    const result = await measureLatency(proxy);
    if (result.success) {
      successes++;
    } else {
      failures++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return {
    successes,
    failures,
    packetLoss: Math.round((failures / samples) * 100)
  };
}

// Estimate bandwidth
async function estimateBandwidth(proxy) {
  try {
    const testConfig = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
          host: proxy.ip,
          port: proxy.port
        },
        bypassList: ['localhost', '127.0.0.1']
      }
    };

    await chrome.proxy.settings.set({ value: testConfig, scope: 'regular' });

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Download a small test file
    const response = await fetch('https://httpbin.org/bytes/102400', {
      signal: controller.signal,
      cache: 'no-store'
    });

    clearTimeout(timeoutId);

    await chrome.proxy.settings.clear({ scope: 'regular' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.arrayBuffer();
    const duration = (Date.now() - startTime) / 1000; // seconds
    const bytes = data.byteLength;
    const bitsPerSecond = (bytes * 8) / duration;
    const megabitsPerSecond = bitsPerSecond / 1000000;

    return {
      success: true,
      bandwidth: Math.round(megabitsPerSecond * 10) / 10
    };
  } catch (error) {
    await chrome.proxy.settings.clear({ scope: 'regular' });
    return {
      success: false,
      bandwidth: null,
      error: error.message
    };
  }
}

// Calculate stability score
function calculateStability(metricsHistory) {
  if (metricsHistory.length < 2) return 100;

  const latencies = metricsHistory.map(m => m.latency).filter(l => l > 0);
  if (latencies.length < 2) return 100;

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
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
async function startQualityMonitoring(proxy, intervalMs = 30000) {
  try {
    // Initial measurement
    const latencyResult = await measureLatency(proxy);
    const packetLossResult = await estimatePacketLoss(proxy, 3);
    
    const metrics = {
      latency: latencyResult.latency || 0,
      jitter: 0,
      packetLoss: packetLossResult.packetLoss,
      bandwidth: 0,
      stability: 100
    };

    // Update monitor
    qualityMonitor.updateMetrics(metrics);

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
  qualityMonitor.reset();
  return { success: true };
}

// Get quality status
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

module.exports = {
  // Constants
  QUALITY_LEVELS,
  
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
  getQualityRecommendations
};