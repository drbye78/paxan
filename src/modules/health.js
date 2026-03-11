// Health Monitoring Module - Connection Quality & Health Tracking
// Phase 2: Intelligence & Quality Assurance

class HealthMonitor {
  constructor() {
    this.monitoringActive = false;
    this.monitoringInterval = null;
    this.currentProxy = null;
    this.healthData = {
      connectionQuality: 'excellent',
      lastCheck: null,
      qualityHistory: [],
      latencyHistory: [],
      packetLoss: 0,
      jitter: 0
    };
    
    this.qualityThresholds = {
      excellent: { latency: 0, packetLoss: 0, jitter: 0 },
      good: { latency: 100, packetLoss: 1, jitter: 10 },
      fair: { latency: 300, packetLoss: 5, jitter: 30 },
      poor: { latency: 500, packetLoss: 10, jitter: 50 }
    };
    
    this.init();
  }

  async init() {
    await this.loadHealthData();
    this.setupHealthMonitoring();
  }

  async loadHealthData() {
    try {
      const result = await chrome.storage.local.get(['healthData']);
      if (result.healthData) {
        this.healthData = { ...this.healthData, ...result.healthData };
      }
    } catch (error) {
      console.error('Error loading health data:', error);
    }
  }

  async saveHealthData() {
    try {
      await chrome.storage.local.set({ healthData: this.healthData });
    } catch (error) {
      console.error('Error saving health data:', error);
    }
  }

  setupHealthMonitoring() {
    // Listen for proxy connection changes
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'startHealthMonitoring') {
        this.startHealthMonitoring(request.proxy);
        sendResponse({ success: true });
        return false;
      }
      
      if (request.action === 'stopHealthMonitoring') {
        this.stopHealthMonitoring();
        sendResponse({ success: true });
        return false;
      }
      
      if (request.action === 'getHealthStatus') {
        sendResponse(this.getHealthStatus());
        return false;
      }
    });
  }

  startHealthMonitoring(proxy) {
    this.stopHealthMonitoring(); // Clear any existing monitoring
    
    this.currentProxy = proxy;
    this.monitoringActive = true;
    
    // Initial health check
    this.performHealthCheck();
    
    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
    
    console.log('Started health monitoring for:', proxy.ipPort);
  }

  stopHealthMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.monitoringActive = false;
    this.currentProxy = null;
    console.log('Stopped health monitoring');
  }

  async performHealthCheck() {
    if (!this.currentProxy || !this.monitoringActive) return;
    
    try {
      const healthResult = await this.measureConnectionHealth(this.currentProxy);
      
      // Update health data
      this.updateHealthData(healthResult);
      
      // Calculate connection quality
      const quality = this.calculateConnectionQuality(healthResult);
      this.healthData.connectionQuality = quality;
      
      // Store in history
      this.addToHistory(healthResult);
      
      // Check for degradation
      this.checkForDegradation(healthResult);
      
      // Save data
      await this.saveHealthData();
      
      // Notify popup of health status
      chrome.runtime.sendMessage({
        action: 'healthStatusUpdate',
        health: this.healthData
      }).catch(() => {});
      
    } catch (error) {
      console.error('Health check failed:', error);
      this.handleHealthCheckError(error);
    }
  }

  async measureConnectionHealth(proxy) {
    const startTime = Date.now();
    const testResults = [];
    
    // Perform multiple ping tests for accuracy
    for (let i = 0; i < 5; i++) {
      const result = await this.performPingTest(proxy);
      if (result.success) {
        testResults.push(result);
      }
      await this.sleep(100); // Small delay between tests
    }
    
    if (testResults.length === 0) {
      return {
        success: false,
        latency: null,
        packetLoss: 100,
        jitter: null,
        timestamp: Date.now()
      };
    }
    
    // Calculate statistics
    const latencies = testResults.map(r => r.latency);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    const jitter = maxLatency - minLatency;
    const packetLoss = ((5 - testResults.length) / 5) * 100;
    
    return {
      success: true,
      latency: Math.round(avgLatency),
      minLatency: minLatency,
      maxLatency: maxLatency,
      jitter: jitter,
      packetLoss: packetLoss,
      timestamp: Date.now()
    };
  }

  async performPingTest(proxy) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const testConfig = {
        mode: 'fixed_servers',
        rules: {
          singleProxy: {
            scheme: proxy.type === 'SOCKS5' ? 'socks5' : 'http',
            host: proxy.ip,
            port: proxy.port
          },
          bypassList: ['localhost', '127.0.0.1', '::1']
        }
      };
      
      chrome.proxy.settings.set({ value: testConfig, scope: 'regular' }, async () => {
        try {
          const response = await fetch('https://httpbin.org/ip', {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-store'
          });
          
          clearTimeout(timeoutId);
          
          // Restore original proxy settings
          await this.restoreProxySettings();
          
          const latency = Date.now() - startTime;
          
          resolve({
            success: response.ok,
            latency: latency,
            status: response.status
          });
          
        } catch (error) {
          clearTimeout(timeoutId);
          
          // Restore original proxy settings
          await this.restoreProxySettings();
          
          resolve({
            success: false,
            latency: null,
            error: error.message
          });
        }
      });
    });
  }

  async restoreProxySettings() {
    // Restore to current active proxy or clear if none
    try {
      const result = await chrome.storage.local.get(['activeProxy']);
      if (result.activeProxy) {
        await chrome.runtime.sendMessage({
          action: 'setProxy',
          proxy: result.activeProxy
        });
      } else {
        await chrome.runtime.sendMessage({ action: 'clearProxy' });
      }
    } catch (error) {
      console.error('Failed to restore proxy settings:', error);
    }
  }

  calculateConnectionQuality(healthResult) {
    const { latency, packetLoss, jitter } = healthResult;
    
    if (!latency || packetLoss > 50) {
      return 'poor';
    }
    
    // Check against thresholds
    if (latency <= this.qualityThresholds.excellent.latency && 
        packetLoss <= this.qualityThresholds.excellent.packetLoss &&
        jitter <= this.qualityThresholds.excellent.jitter) {
      return 'excellent';
    } else if (latency <= this.qualityThresholds.good.latency && 
               packetLoss <= this.qualityThresholds.good.packetLoss &&
               jitter <= this.qualityThresholds.good.jitter) {
      return 'good';
    } else if (latency <= this.qualityThresholds.fair.latency && 
               packetLoss <= this.qualityThresholds.fair.packetLoss &&
               jitter <= this.qualityThresholds.fair.jitter) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  updateHealthData(healthResult) {
    this.healthData.lastCheck = healthResult.timestamp;
    
    // Update averages for display
    if (healthResult.success) {
      this.healthData.avgLatency = this.calculateMovingAverage(
        this.healthData.latencyHistory,
        healthResult.latency
      );
    }
  }

  addToHistory(healthResult) {
    // Add to latency history (keep last 20)
    if (healthResult.success) {
      this.healthData.latencyHistory.push(healthResult.latency);
      if (this.healthData.latencyHistory.length > 20) {
        this.healthData.latencyHistory.shift();
      }
    }
    
    // Add to quality history (keep last 10)
    this.healthData.qualityHistory.push({
      quality: this.healthData.connectionQuality,
      timestamp: healthResult.timestamp
    });
    if (this.healthData.qualityHistory.length > 10) {
      this.healthData.qualityHistory.shift();
    }
  }

  calculateMovingAverage(history, newValue) {
    const sum = history.reduce((a, b) => a + b, 0);
    return Math.round((sum + newValue) / (history.length + 1));
  }

  checkForDegradation(healthResult) {
    const currentQuality = this.healthData.connectionQuality;
    
    // Check for quality degradation
    if (currentQuality === 'poor') {
      chrome.runtime.sendMessage({
        action: 'connectionDegraded',
        type: 'quality',
        quality: currentQuality,
        latency: healthResult.latency,
        packetLoss: healthResult.packetLoss
      }).catch(() => {});
    }
    
    // Check for high latency
    if (healthResult.latency && healthResult.latency > 500) {
      chrome.runtime.sendMessage({
        action: 'connectionDegraded',
        type: 'latency',
        latency: healthResult.latency
      }).catch(() => {});
    }
    
    // Check for high packet loss
    if (healthResult.packetLoss > 10) {
      chrome.runtime.sendMessage({
        action: 'connectionDegraded',
        type: 'packetLoss',
        packetLoss: healthResult.packetLoss
      }).catch(() => {});
    }
  }

  handleHealthCheckError(error) {
    // Log error but don't stop monitoring
    console.error('Health check error:', error);
    
    // Notify of monitoring issue
    chrome.runtime.sendMessage({
      action: 'healthCheckError',
      error: error.message
    }).catch(() => {});
  }

  getHealthStatus() {
    return {
      active: this.monitoringActive,
      proxy: this.currentProxy,
      quality: this.healthData.connectionQuality,
      lastCheck: this.healthData.lastCheck,
      avgLatency: this.healthData.avgLatency,
      latencyHistory: this.healthData.latencyHistory.slice(-10),
      qualityHistory: this.healthData.qualityHistory.slice(-5)
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  getConnectionQuality() {
    return this.healthData.connectionQuality;
  }

  getLatencyHistory() {
    return this.healthData.latencyHistory;
  }

  getQualityHistory() {
    return this.healthData.qualityHistory;
  }

  getAverageLatency() {
    return this.healthData.avgLatency || 0;
  }

  isMonitoring() {
    return this.monitoringActive;
  }
}

// Export for use in background.js
if (typeof module !== 'undefined') {
  module.exports = HealthMonitor;
}

// Initialize health monitor
const healthMonitor = new HealthMonitor();

// Message handlers for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startHealthMonitoring') {
    healthMonitor.startHealthMonitoring(request.proxy);
    sendResponse({ success: true });
    return false;
  }
  
  if (request.action === 'stopHealthMonitoring') {
    healthMonitor.stopHealthMonitoring();
    sendResponse({ success: true });
    return false;
  }
  
  if (request.action === 'getHealthStatus') {
    sendResponse(healthMonitor.getHealthStatus());
    return false;
  }
});