// PeasyProxy - Reputation Engine
// Tracks proxy trust scores based on test history

import { THRESHOLDS, TRUST_THRESHOLDS, REPUTATION_WEIGHTS } from '../popup/constants.js';

const REPUTATION_KEY = 'proxyReputation';
const MAX_LATENCY_HISTORY = 50;
const MAX_TEST_AGE_DAYS = 7;

class ReputationEngine {
  constructor() {
    this.reputation = {};
    this._initialized = false;
    this._saveTimer = null;
  }

  async init() {
    const result = await chrome.storage.local.get([REPUTATION_KEY]);
    this.reputation = result[REPUTATION_KEY] || {};
    this._initialized = true;
  }

  async save() {
    // Guard: never save empty/uninitialized data over existing storage
    if (!this._initialized) return;
    await chrome.storage.local.set({ [REPUTATION_KEY]: this.reputation });
  }

  getKey(ipPort) {
    return ipPort;
  }

  async recordTest(proxy, success, latency) {
    const key = typeof proxy === 'string' ? proxy : proxy.ipPort;

    if (!this.reputation[key]) {
      this.reputation[key] = {
        trustScore: 50,
        latencyHistory: [],
        successCount: 0,
        failureCount: 0,
        consecutiveFailures: 0,
        lastTested: null,
        tampered: false,
        ip: proxy.ip,
        port: proxy.port,
        ipPort: proxy.ipPort || key,
        country: proxy.country || null,
        type: proxy.type || null,
        successRate: 0,
        httpsOnly: proxy.type === 'HTTPS',
        firstSeen: Date.now()
      };
    }

    const rep = this.reputation[key];
    rep.lastTested = Date.now();

    if (success) {
      rep.successCount++;
      rep.consecutiveFailures = 0;
      if (latency != null && !Number.isNaN(latency)) {
        rep.latencyHistory.push(latency);
        if (rep.latencyHistory.length > MAX_LATENCY_HISTORY) {
          rep.latencyHistory.shift();
        }
        // Filter NaN values before averaging
        rep.latencyHistory = rep.latencyHistory.filter(v => typeof v === 'number' && !isNaN(v));
        rep.avgLatency = rep.latencyHistory.length > 0
          ? Math.round(
              rep.latencyHistory.reduce((a, b) => a + b, 0) / rep.latencyHistory.length
            )
          : null;
      }
    } else {
      rep.failureCount++;
      rep.consecutiveFailures++;
    }

    // Recalculate derived fields
    const totalTests = rep.successCount + rep.failureCount;
    rep.successRate = totalTests > 0 ? Math.round((rep.successCount / totalTests) * 100) : 0;

    // Backward-compatible aliases for existing tests and callers
    rep.totalTests = totalTests;
    rep.successes = rep.successCount;
    rep.failures = rep.failureCount;
    rep.tamperDetected = rep.tampered;

    // Recalculate trust score
    rep.trustScore = this.calculateScore(key);

    // Debounce: save at most once per 5 seconds
    this._scheduleSave();

    return rep;
  }

  _scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.save().catch(() => {});
    }, 5000);
  }

  async recordFailure(proxy, error) {
    return this.recordTest(proxy, false, null);
  }

  calculateUptime(rep) {
    if (!rep.totalTests || rep.totalTests === 0) return 0;
    return Math.max(0, Math.round((rep.successes / rep.totalTests) * 100));
  }

  async getReputation(proxyIpPort) {
    const key = this.getKey(proxyIpPort);
    return this.reputation[key] || null;
  }

  calculateScore(proxy) {
    const key = typeof proxy === 'string' ? proxy : proxy.ipPort;
    const rep = this.reputation[key];
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
    if (latency == null || Number.isNaN(latency)) return 50;
    if (latency < 50) return 100;
    if (latency > 2000) return 0;
    return Math.max(0, Math.round(100 - latency / 20));
  }

  calculateTrustScore(rep) {
    let score = 50;

    if (rep.httpsOnly) score += 20;
    if (!rep.tamperDetected) score += 15;
    if (rep.successRate > 90) score += 10;
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

    return Math.max(0, Math.round(100 - (hoursSinceTest * 3)));
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
      // Also remove entries where lastTested is null/undefined (they accumulate forever)
      if (!rep.lastTested || (now - rep.lastTested > maxAge)) {
        delete this.reputation[key];
      }
    }

    await this.save();
  }
}

export { ReputationEngine };
