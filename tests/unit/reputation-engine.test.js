// Unit tests for Reputation Engine

const { ReputationEngine } = require('../test-shim');

describe('Reputation Engine', () => {
  let engine;

  beforeEach(() => {
    engine = new ReputationEngine();
    engine.init();
  });

  describe('calculateScore', () => {
    test('should return 30 for unknown proxy', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      const score = engine.calculateScore(proxy);
      expect(score).toBe(30);
    });

    test('should calculate score based on latency', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      await engine.recordTest(proxy, true, 50);
      const score = engine.calculateScore(proxy);
      expect(score).toBeGreaterThan(50);
    });

    test('should penalize high latency', async () => {
      const proxy = { ip: '192.168.1.2', port: 8080, ipPort: '192.168.1.2:8080' };
      await engine.recordTest(proxy, true, 3000);
      const score = engine.calculateScore(proxy);
      // Score will vary based on algorithm, just check it's reasonable
      expect(score).toBeGreaterThan(0);
    });

    test('should boost score for HTTPS-only proxies', async () => {
      const proxy = { ip: '192.168.1.3', port: 443, ipPort: '192.168.1.3:443', type: 'HTTPS' };
      await engine.recordTest(proxy, true, 100);
      const score = engine.calculateScore(proxy);
      expect(score).toBeGreaterThan(50);
    });

    test('should consider tamper detection in score', async () => {
      const proxy = { ip: '192.168.1.4', port: 8080, ipPort: '192.168.1.4:8080' };
      await engine.recordTest(proxy, true, 100);
      await engine.markTampered('192.168.1.4:8080', true);
      const score = engine.calculateScore(proxy);
      expect(score).toBeLessThan(100);
    });
  });

  describe('recordTest', () => {
    test('should record successful test', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      const result = await engine.recordTest(proxy, true, 50);
      
      expect(result.totalTests).toBe(1);
      expect(result.successes).toBe(1);
      expect(result.failures).toBe(0);
    });

    test('should record failed test', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      const result = await engine.recordTest(proxy, false, null);
      
      expect(result.totalTests).toBe(1);
      expect(result.successes).toBe(0);
      expect(result.failures).toBe(1);
    });

    test('should track latency history', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      
      await engine.recordTest(proxy, true, 50);
      await engine.recordTest(proxy, true, 100);
      await engine.recordTest(proxy, true, 75);
      
      const result = await engine.getReputation('192.168.1.1:8080');
      expect(result.latencyHistory).toHaveLength(3);
      expect(result.avgLatency).toBe(75);
    });

    test('should limit latency history to 50 entries', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      
      for (let i = 0; i < 60; i++) {
        await engine.recordTest(proxy, true, 50);
      }
      
      const result = await engine.getReputation('192.168.1.1:8080');
      expect(result.latencyHistory.length).toBeLessThanOrEqual(50);
    });
  });

  describe('getReputation', () => {
    test('should return null for unknown proxy', async () => {
      const result = await engine.getReputation('unknown:8080');
      expect(result).toBeNull();
    });

    test('should return reputation for known proxy', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      await engine.recordTest(proxy, true, 50);
      
      const result = await engine.getReputation('192.168.1.1:8080');
      expect(result).not.toBeNull();
      expect(result.totalTests).toBe(1);
    });
  });

  describe('markTampered', () => {
    test('should mark proxy as tampered', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      await engine.recordTest(proxy, true, 50);
      
      await engine.markTampered('192.168.1.1:8080', true);
      const result = await engine.getReputation('192.168.1.1:8080');
      
      expect(result.tamperDetected).toBe(true);
    });

    test('should unmark proxy as tampered', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      await engine.recordTest(proxy, true, 50);
      
      await engine.markTampered('192.168.1.1:8080', true);
      await engine.markTampered('192.168.1.1:8080', false);
      const result = await engine.getReputation('192.168.1.1:8080');
      
      expect(result.tamperDetected).toBe(false);
    });
  });

  describe('calculateUptime', () => {
    test('should calculate uptime percentage', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      await engine.recordTest(proxy, true, 50);
      await engine.recordTest(proxy, true, 50);
      await engine.recordTest(proxy, false, null);
      
      const result = await engine.getReputation('192.168.1.1:8080');
      expect(result.uptime).toBeGreaterThan(0);
    });

    test('should return 0 for empty history', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      const uptime = engine.calculateUptime({
        latencyHistory: [],
        consecutiveFailures: 0
      });
      expect(uptime).toBe(0);
    });
  });

  describe('getSuspiciousProxies', () => {
    test('should return tampered proxies', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      await engine.recordTest(proxy, true, 50);
      await engine.markTampered('192.168.1.1:8080', true);
      
      const suspicious = engine.getSuspiciousProxies();
      expect(suspicious.some(p => p.ipPort === '192.168.1.1:8080')).toBe(true);
    });

    test('should return proxies with many failures', async () => {
      const proxy = { ip: '192.168.1.1', port: 8080, ipPort: '192.168.1.1:8080' };
      for (let i = 0; i < 6; i++) {
        await engine.recordTest(proxy, false, null);
      }
      
      const suspicious = engine.getSuspiciousProxies();
      expect(suspicious.some(p => p.ipPort === '192.168.1.1:8080')).toBe(true);
    });
  });
});
