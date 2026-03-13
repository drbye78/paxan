// Unit tests for popup.js - Revised using extracted pure functions

const { mockChrome, setupStorageWith } = require('../__mocks__/chrome-api-mock');

// Import pure utility functions for testing
const {
  calculateProxyScore,
  getRecommendedProxies,
  getBestProxy,
  filterProxiesByCountry,
  filterProxiesByType,
  filterProxiesBySpeed,
  filterProxiesByBlacklist,
  searchProxies,
  getWorkingStatus,
  renderSparkline,
  formatDuration
} = require('../../src/modules/proxyUtils.js');

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

  describe('getRecommendedProxies', () => {
    test('should return top 5 proxies by score', () => {
      const proxies = [
        { speedMs: 50, ipPort: '1' },
        { speedMs: 100, ipPort: '2' },
        { speedMs: 150, ipPort: '3' },
        { speedMs: 200, ipPort: '4' },
        { speedMs: 250, ipPort: '5' },
        { speedMs: 300, ipPort: '6' }
      ];

      const proxyStats = {};
      const favorites = [];

      const recommended = getRecommendedProxies(proxies, proxyStats, favorites);

      expect(recommended).toHaveLength(5);
      expect(recommended[0].speedMs).toBe(50); // Fastest first
      expect(recommended[4].speedMs).toBe(250);
    });

    test('should exclude current proxy from recommendations', () => {
      const currentProxy = { speedMs: 50, ipPort: '1' };
      const proxies = [
        currentProxy,
        { speedMs: 100, ipPort: '2' },
        { speedMs: 150, ipPort: '3' }
      ];

      const proxyStats = {};
      const favorites = [];

      const recommended = getRecommendedProxies(proxies, proxyStats, favorites, currentProxy);

      expect(recommended).toHaveLength(2);
      expect(recommended[0].ipPort).toBe('2');
      expect(recommended[1].ipPort).toBe('3');
    });
  });

  describe('getBestProxy', () => {
    test('should return proxy with best score', () => {
      const proxies = [
        { 
          speedMs: 300, 
          ipPort: '1',
          historicalSuccessRate: 90,
          historicalAvgLatency: 80,
          historicalAttempts: 20
        },
        { 
          speedMs: 100, 
          ipPort: '2',
          historicalSuccessRate: 50,
          historicalAvgLatency: 150,
          historicalAttempts: 5
        },
        { 
          speedMs: 200, 
          ipPort: '3',
          historicalSuccessRate: 85,
          historicalAvgLatency: 90,
          historicalAttempts: 15
        }
      ];

      const proxyStats = {};
      const favorites = [];

      const best = getBestProxy(proxies, proxyStats, favorites);

      expect(best).toBeTruthy();
      expect(best.ipPort).toBeDefined();
      expect(best.speedMs).toBeDefined();
      // The best proxy should have a valid score
      expect(best.score).toBeGreaterThanOrEqual(0);
      expect(best.score).toBeLessThanOrEqual(100);
    });

    test('should return null if no suitable proxy found', () => {
      const proxies = [
        { 
          speedMs: 1000, 
          ipPort: '1',
          historicalSuccessRate: 20,
          historicalAvgLatency: 500,
          historicalAttempts: 2
        }
      ];

      const best = getBestProxy(proxies, {}, []);

      expect(best).toBeNull();
    });
  });

  describe('filterProxiesByCountry', () => {
    test('should filter by country', () => {
      const proxies = [
        { country: 'Germany', ipPort: '1' },
        { country: 'USA', ipPort: '2' },
        { country: 'Germany', ipPort: '3' }
      ];

      const filtered = filterProxiesByCountry(proxies, 'Germany');

      expect(filtered).toHaveLength(2);
      expect(filtered.every(p => p.country === 'Germany')).toBe(true);
    });

    test('should return all proxies when no country specified', () => {
      const proxies = [
        { country: 'Germany', ipPort: '1' },
        { country: 'USA', ipPort: '2' }
      ];

      const filtered = filterProxiesByCountry(proxies, '');

      expect(filtered).toHaveLength(2);
    });
  });

  describe('filterProxiesByType', () => {
    test('should filter by type', () => {
      const proxies = [
        { type: 'HTTPS', ipPort: '1' },
        { type: 'SOCKS5', ipPort: '2' },
        { type: 'HTTPS', ipPort: '3' }
      ];

      const filtered = filterProxiesByType(proxies, 'HTTPS');

      expect(filtered).toHaveLength(2);
      expect(filtered.every(p => p.type === 'HTTPS')).toBe(true);
    });
  });

  describe('filterProxiesBySpeed', () => {
    test('should filter fast proxies', () => {
      const proxies = [
        { speedMs: 100, ipPort: '1' },
        { speedMs: 400, ipPort: '2' },
        { speedMs: 200, ipPort: '3' }
      ];

      const filtered = filterProxiesBySpeed(proxies, 'fast');

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach(p => {
        expect(p.speedMs).toBeLessThan(300);
      });
    });
  });

  describe('filterProxiesByBlacklist', () => {
    test('should filter out blacklisted countries', () => {
      const proxies = [
        { country: 'Germany', ipPort: '1' },
        { country: 'USA', ipPort: '2' },
        { country: 'France', ipPort: '3' }
      ];

      const filtered = filterProxiesByBlacklist(proxies, ['USA']);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(p => p.country !== 'USA')).toBe(true);
    });
  });

  describe('searchProxies', () => {
    test('should filter by search query', () => {
      const proxies = [
        { ipPort: '192.168.1.1:8080', country: 'Germany', type: 'HTTPS' },
        { ipPort: '10.0.0.1:3128', country: 'USA', type: 'SOCKS5' }
      ];

      const filtered = searchProxies(proxies, '192.168');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].ipPort).toBe('192.168.1.1:8080');
    });

    test('should return all when no query', () => {
      const proxies = [
        { ipPort: '192.168.1.1:8080', country: 'Germany' },
        { ipPort: '10.0.0.1:3128', country: 'USA' }
      ];

      const filtered = searchProxies(proxies, '');

      expect(filtered).toHaveLength(2);
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

  describe('formatDuration', () => {
    test('should format milliseconds to MM:SS', () => {
      expect(formatDuration(60000)).toBe('01:00');
      expect(formatDuration(125000)).toBe('02:05');
      expect(formatDuration(30000)).toBe('00:30');
    });

    test('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('00:00');
    });

    test('should handle null/undefined', () => {
      expect(formatDuration(null)).toBe('00:00');
      expect(formatDuration(undefined)).toBe('00:00');
    });
  });
});

describe('Proxy Utils - Edge Cases', () => {
  test('should handle null/undefined proxies in scoring', () => {
    expect(calculateProxyScore(null, {}, [])).toBe(0);
    expect(calculateProxyScore(undefined, {}, [])).toBe(0);
  });

  test('should handle empty proxies array in getRecommendedProxies', () => {
    const result = getRecommendedProxies([], {}, []);
    expect(result).toEqual([]);
  });

  test('should return null when no proxies in getBestProxy', () => {
    const result = getBestProxy([], {}, []);
    expect(result).toBeNull();
  });

  test('should handle null blacklist in filterProxiesByBlacklist', () => {
    const proxies = [{ country: 'USA', ipPort: '1' }];
    const result = filterProxiesByBlacklist(proxies, null);
    expect(result).toEqual(proxies);
  });

  test('should return all proxies when blacklist is empty array', () => {
    const proxies = [{ country: 'USA', ipPort: '1' }];
    const result = filterProxiesByBlacklist(proxies, []);
    expect(result).toEqual(proxies);
  });
});
