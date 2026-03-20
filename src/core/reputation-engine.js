import { THRESHOLDS, TRUST_THRESHOLDS, REPUTATION_WEIGHTS } from '../popup/constants.js';

const REPUTATION_KEY = 'proxyReputation';
const MAX_LATENCY_HISTORY = 50;
const MAX_TEST_AGE_DAYS = 7;

class ReputationEngine {
  constructor() {
    this.reputation = {};
  }

  async init() {
    const result = await chrome.storage.local.get([REPUTATION_KEY]);
    this.reputation = result[REPUTATION_KEY] || {};
  }

  async save() {
    await chrome.storage.local.set({ [REPUTATION_KEY]: this.reputation });
  }

  getKey(ipPort) {
    return ipPort;
  }

  async recordTest(proxy, success, latency) {
    const key = this.getKey(proxy.ipPort);
    
    if (!this.reputation[key]) {
      this.reputation[key] = this.createEmptyReputation(proxy);
    }
    
    const rep = this.reputation[key];
    rep.totalTests++;
    
    if (success) {
      rep.successes++;
      rep.lastSuccess = Date.now();
      
      if (latency) {
        rep.latencyHistory.push(latency);
        if (rep.latencyHistory.length > MAX_LATENCY_HISTORY) {
          rep.latencyHistory.shift();
        }
        rep.avgLatency = Math.round(
          rep.latencyHistory.reduce((a, b) => a + b, 0) / rep.latencyHistory.length
        );
      }
    } else {
      rep.failures++;
      rep.consecutiveFailures++;
      rep.lastFailure = Date.now();
    }
    
    rep.lastTested = Date.now();
    
    if (success) {
      rep.consecutiveFailures = 0;
    }
    
    rep.successRate = Math.round((rep.successes / rep.totalTests) * 100);
    rep.uptime = this.calculateUptime(rep);
    
    await this.save();
    return rep;
  }

  async recordFailure(proxy, error) {
    return this.recordTest(proxy, false, null);
  }

  createEmptyReputation(proxy) {
    return {
      ip: proxy.ip,
      port: proxy.port,
      ipPort: proxy.ipPort,
      country: proxy.country,
      type: proxy.type,
      
      totalTests: 0,
      successes: 0,
      failures: 0,
      successRate: 0,
      
      latencyHistory: [],
      avgLatency: null,
      
      consecutiveFailures: 0,
      uptime: 0,
      
      tamperDetected: false,
      httpsOnly: proxy.type === 'HTTPS',
      
      firstSeen: Date.now(),
      lastTested: Date.now(),
      lastSuccess: null,
      lastFailure: null,
      
      reputationScore: 0
    };
  }

  calculateUptime(rep) {
    const hourMs = 3600000;
    const now = Date.now();
    const hourAgo = now - hourMs;
    
    if (!rep.totalTests || rep.totalTests === 0) return 0;
    
    return Math.max(0, Math.round((rep.successes / rep.totalTests) * 100));
  }

  async getReputation(proxyIpPort) {
    const key = this.getKey(proxyIpPort);
    return this.reputation[key] || null;
  }

  calculateScore(proxy) {
    const rep = this.reputation[proxy.ipPort];
    if (!rep) return 30;
    
    const speedScore = this.calculateSpeedScore(rep.avgLatency);
    const reliabilityScore = rep.successRate || 0;
    const trustScore = this.calculateTrustScore(rep);
    const freshnessScore = this.calculateFreshnessScore(rep.lastTested);
    
    const score = Math.round(
      (speedScore * REPUTATION_WEIGHTS.SPEED) +
      (reliabilityScore * REPUTATION_WEIGHTS.RELIABILITY) +
      (trustScore * REPUTATION_WEIGHTS.TRUST) +
      (freshnessScore * REPUTATION_WEIGHTS.FRESHNESS)
    );
    
    rep.reputationScore = score;
    return score;
  }

  calculateSpeedScore(latency) {
    if (!latency || latency === null) return 50;
    if (latency < 50) return 100;
    if (latency > 2000) return 0;
    return Math.max(0, Math.round(100 - latency / 20));
  }

  calculateTrustScore(rep) {
    let score = 50;
    
    if (rep.httpsOnly) score += 20;
    if (!rep.tamperDetected) score += 15;
    if (rep.uptime > 90) score += 10;
    if (rep.totalTests > 10) score += 5;
    
    return Math.min(100, score);
  }

  calculateFreshnessScore(lastTested) {
    if (!lastTested) return 50;
    
    const now = Date.now();
    const hourMs = 3600000;
    const hoursSinceTest = (now - lastTested) / hourMs;
    
    if (hoursSinceTest < 1) return 100;
    if (hoursSinceTest > 24) return 30;
    
    return Math.round(100 - (hoursSinceTest * 3));
  }

  getTrustedProxies(threshold = TRUST_THRESHOLDS.UNVERIFIED) {
    return Object.values(this.reputation)
      .filter(rep => rep.reputationScore >= threshold)
      .sort((a, b) => b.reputationScore - a.reputationScore);
  }

  getSuspiciousProxies() {
    return Object.values(this.reputation)
      .filter(rep => rep.tamperDetected || rep.consecutiveFailures > 5)
      .sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);
  }

  async markTampered(proxyIpPort, tampered = true) {
    const key = this.getKey(proxyIpPort);
    if (this.reputation[key]) {
      this.reputation[key].tamperDetected = tampered;
      await this.save();
    }
  }

  async getStats() {
    const reps = Object.values(this.reputation);
    if (reps.length === 0) {
      return {
        totalProxies: 0,
        avgScore: 0,
        trustedCount: 0,
        suspiciousCount: 0
      };
    }
    
    const scores = reps.map(r => r.reputationScore);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    
    return {
      totalProxies: reps.length,
      avgScore,
      trustedCount: reps.filter(r => r.reputationScore >= TRUST_THRESHOLDS.UNVERIFIED).length,
      suspiciousCount: reps.filter(r => r.tamperDetected || r.consecutiveFailures > 5).length
    };
  }

  async clearOldData() {
    const now = Date.now();
    const maxAge = MAX_TEST_AGE_DAYS * 24 * 3600000;
    
    for (const [key, rep] of Object.entries(this.reputation)) {
      if (now - rep.lastTested > maxAge) {
        delete this.reputation[key];
      }
    }
    
    await this.save();
  }
}

export { ReputationEngine };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ReputationEngine };
}
