// Unit tests for popup.js - Revised using extracted pure functions

const { mockChrome, setupStorageWith } = require('../__mocks__/chrome-api-mock');

// Import pure utility functions for testing from new popup modules
const {
  calculateProxyScore,
  getRecommendedProxies,
  getBestProxy,
  getWorkingStatus,
  renderSparkline
} = require('../../src/popup-modules/popup.proxy-list.js');

describe('Proxy Utils (Pure Functions)', () => {
  describe('calculateProxyScore', () => {
    test('should calculate score based on multiple factors', () => {
      const proxy = { 
        speedMs: 100,
        ipPort: '192.168.1.1:8080'
      };
      const stats = { 
        successRate: 80, 
        avgLatency: 120,
        attempts: 10
      };

      const proxyStats = {
        '192.168.1.1:8080': stats
      };
      const favorites = [];

      const score = calculateProxyScore(proxy, proxyStats, favorites);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
      expect(typeof score).toBe('number');
    });

    test('should boost score for favorites', () => {
      const proxy = { 
        speedMs: 100, 
        ipPort: '192.168.1.1:8080'
      };

      const proxyStats = {};
      const favorites = [{ ipPort: '192.168.1.1:8080' }];

      const score = calculateProxyScore(proxy, proxyStats, favorites);

      // Score should be higher than without favorites
      expect(score).toBeGreaterThan(50);
    });

    test('should handle missing stats gracefully', () => {
      const proxy = { 
        speedMs: 100,
        ipPort: '192.168.1.1:8080'
      };

      const proxyStats = {};
      const favorites = [];

      const score = calculateProxyScore(proxy, proxyStats, favorites);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });
  });

  // TODO: These are smoke tests that verify getRecommendedProxies/getBestProxy don't crash
  // with empty internal state. They provide no behavioral coverage. Mock the internal state
  // functions to return test data for proper unit tests.
  describe('getRecommendedProxies', () => {
    test('should return an array without crashing (smoke test)', () => {
      const recommended = getRecommendedProxies();
      expect(Array.isArray(recommended)).toBe(true);
    });

    test('should accept excludeProxy param without crashing (smoke test)', () => {
      const currentProxy = { ipPort: '1', speedMs: 100 };
      const recommended = getRecommendedProxies(currentProxy);
      expect(Array.isArray(recommended)).toBe(true);
    });
  });

  describe('getBestProxy', () => {
    test('should return undefined with empty state (smoke test)', () => {
      const best = getBestProxy();
      expect(best).toBeUndefined();
    });

    test('should not crash when called repeatedly (smoke test)', () => {
      expect(getBestProxy()).toBeUndefined();
      expect(getBestProxy()).toBeUndefined();
    });
  });

  describe('getWorkingStatus', () => {
    test('should return correct status for recent proxy', () => {
      const proxy = { lastCheck: 'Recently' };
      expect(getWorkingStatus(proxy)).toBe('good');
    });

    test('should return warning for old proxy', () => {
      const proxy = { lastCheck: '1 hour ago' };
      expect(getWorkingStatus(proxy)).toBe('warning');
    });

    test('should return unknown for missing data', () => {
      expect(getWorkingStatus({})).toBe('unknown');
      expect(getWorkingStatus(null)).toBe('unknown');
    });
  });

  describe('renderSparkline', () => {
    test('should generate sparkline SVG', () => {
      const latencies = [100, 120, 90, 110, 95];
      const svg = renderSparkline(latencies);

      expect(svg).toContain('<svg');
      expect(svg).toContain('<polyline');
      expect(svg).toContain('points=');
    });

    test('should handle empty latencies array', () => {
      const svg = renderSparkline([]);
      expect(svg).toBe('');
    });
  });

  describe('Proxy Utils - Edge Cases', () => {
    test('should handle null/undefined proxies in scoring', () => {
      expect(calculateProxyScore(null)).toBe(0);
      expect(calculateProxyScore(undefined)).toBe(0);
    });

    test('should handle empty proxies array in getRecommendedProxies', () => {
      const result = getRecommendedProxies();
      expect(result).toEqual([]);
    });

    test('should return null when no proxies in getBestProxy', () => {
      const result = getBestProxy();
      expect(result).toBeUndefined();
    });
  });
});
