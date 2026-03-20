// ProxyMania VPN - Constants
// Scoring weights and configuration constants

// Scoring weights for proxy ranking (must sum to 1.0)
const SCORING_WEIGHTS = {
  SPEED: 0.35,           // Latency-based score
  RELIABILITY: 0.35,     // Success rate score
  FRESHNESS: 0.15,       // Last check recency
  FAVORITE_BONUS: 0.05,  // Bonus for favorited proxies
  HISTORICAL_BONUS: 0.05, // Bonus for historical data
  ATTEMPTS_BONUS: 0.05   // Bonus for proxies with enough test data
};

// Thresholds
const THRESHOLDS = {
  CACHE_TTL: 300000,           // 5 minutes cache TTL
  QUICK_CONNECT_SPEED: 150,    // Max speed for quick connect (ms)
  FAST_PROXY_SPEED: 100,       // Max speed for "fast" filter (ms)
  MEDIUM_PROXY_SPEED: 300,     // Max speed for "medium" filter (ms)
  MAX_LATENCY_HISTORY: 20,     // Max latency measurements to store
  MAX_RECENTLY_USED: 10,       // Max recently used proxies
  PROXY_TEST_TIMEOUT: 5000,    // Proxy test timeout (ms)
  QUICK_TEST_TIMEOUT: 3000,    // Quick test timeout (ms)
  MONITORING_INTERVAL: 0.5,    // Health monitoring interval (minutes)
  ROTATION_INTERVAL: 600000,   // Auto-rotation interval (ms)
  HIGH_LATENCY_WARNING: 500,   // High latency warning threshold (ms)
  POOR_QUALITY_LATENCY: 500,   // Poor quality latency threshold (ms)
  POOR_QUALITY_PACKET_LOSS: 50 // Poor quality packet loss threshold (%)
};

// Trust score thresholds
const TRUST_THRESHOLDS = {
  TRUSTED: 70,     // Score >= 70 = Trusted
  UNVERIFIED: 40,  // Score >= 40 = Unverified
  RISKY: 0         // Score < 40 = Risky
};

// Reputation score weights
const REPUTATION_WEIGHTS = {
  SPEED: 0.30,
  RELIABILITY: 0.35,
  TRUST: 0.25,
  FRESHNESS: 0.10
};

// Connection quality thresholds
const QUALITY_THRESHOLDS = {
  EXCELLENT_LATENCY: 100,
  EXCELLENT_PACKET_LOSS: 1,
  GOOD_LATENCY: 300,
  GOOD_PACKET_LOSS: 5,
  FAIR_LATENCY: 500,
  FAIR_PACKET_LOSS: 10
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SCORING_WEIGHTS,
    THRESHOLDS,
    TRUST_THRESHOLDS,
    REPUTATION_WEIGHTS,
    QUALITY_THRESHOLDS
  };
}