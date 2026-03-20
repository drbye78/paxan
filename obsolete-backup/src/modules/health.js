// Health Monitoring Module - Simplified for MV3
// Removed duplicate message handlers (now handled by background.js)

class HealthMonitor {
  constructor() {
    this.monitoringActive = false;
    this.currentProxy = null;
    this.healthData = {
      connectionQuality: 'excellent',
      lastCheck: null,
      qualityHistory: [],
      latencyHistory: [],
      avgLatency: 0
    };
    
    this.qualityThresholds = {
      excellent: { latency: 100, packetLoss: 1 },
      good: { latency: 300, packetLoss: 5 },
      fair: { latency: 500, packetLoss: 10 },
      poor: { latency: 9999, packetLoss: 50 }
    };
    
    this.init();
  }

  async init() {
    await this.loadHealthData();
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

  startHealthMonitoring(proxy) {
    this.stopHealthMonitoring();
    this.currentProxy = proxy;
    this.monitoringActive = true;
    console.log('Health monitoring started for:', proxy?.ipPort);
  }

  stopHealthMonitoring() {
    this.monitoringActive = false;
    this.currentProxy = null;
    console.log('Health monitoring stopped');
  }

  calculateConnectionQuality(latency, packetLoss = 0) {
    if (!latency || packetLoss > 50) return 'poor';
    if (latency <= this.qualityThresholds.excellent.latency && 
        packetLoss <= this.qualityThresholds.excellent.packetLoss) return 'excellent';
    if (latency <= this.qualityThresholds.good.latency && 
        packetLoss <= this.qualityThresholds.good.packetLoss) return 'good';
    if (latency <= this.qualityThresholds.fair.latency && 
        packetLoss <= this.qualityThresholds.fair.packetLoss) return 'fair';
    return 'poor';
  }

  updateHealthData(latency, quality) {
    this.healthData.lastCheck = Date.now();
    this.healthData.connectionQuality = quality;
    
    if (latency) {
      this.healthData.latencyHistory.push(latency);
      if (this.healthData.latencyHistory.length > 20) {
        this.healthData.latencyHistory.shift();
      }
      
      const sum = this.healthData.latencyHistory.reduce((a, b) => a + b, 0);
      this.healthData.avgLatency = Math.round(sum / this.healthData.latencyHistory.length);
    }
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
}

const healthMonitor = new HealthMonitor();
