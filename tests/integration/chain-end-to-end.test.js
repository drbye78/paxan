// Integration: Proxy chain CRUD and testing through proxy-chain.js
import * as proxyChain from '../../src/background/proxy-chain.js';

describe('Proxy Chain Integration', () => {
  let storage;

  beforeEach(async () => {
    // Reset storage to known state
    storage = {};

    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      let result = {};
      if (Array.isArray(keys)) keys.forEach(k => { result[k] = storage[k]; });
      if (callback) callback(result);
      return Promise.resolve(result);
    });

    global.chrome.storage.local.set.mockImplementation((items) => {
      Object.assign(storage, items);
      return Promise.resolve();
    });

    // Seed with test proxies
    storage.proxies = [
      { ip: '10.0.0.1', port: 8080, ipPort: '10.0.0.1:8080', country: 'Germany', type: 'HTTPS', speedMs: 45 },
      { ip: '10.0.0.2', port: 8081, ipPort: '10.0.0.2:8081', country: 'France', type: 'SOCKS5', speedMs: 80 },
      { ip: '10.0.0.3', port: 8082, ipPort: '10.0.0.3:8082', country: 'Japan', type: 'HTTP', speedMs: 120 },
    ];
    storage.proxyChains = {};
  });

  describe('CRUD operations', () => {
    test('create chain validates proxy IDs', async () => {
      const result = await proxyChain.createChain('Test Chain', ['10.0.0.1:8080', '10.0.0.2:8081']);
      expect(result.success).toBe(true);
      expect(result.chain.proxies).toHaveLength(2);
    });

    test('create chain rejects invalid proxy IDs', async () => {
      const result = await proxyChain.createChain('Bad Chain', ['nonexistent', 'also-fake']);
      expect(result.success).toBe(false);
    });

    test('create chain rejects single proxy', async () => {
      const result = await proxyChain.createChain('Single', ['10.0.0.1:8080']);
      expect(result.success).toBe(false);
    });

    test('list chains returns empty when none exist', async () => {
      const result = await proxyChain.listChains();
      expect(result.success).toBe(true);
      expect(result.chains).toEqual([]);
    });

    test('list chains after creating one', async () => {
      await proxyChain.createChain('Chain A', ['10.0.0.1:8080', '10.0.0.2:8081']);
      const result = await proxyChain.listChains();
      expect(result.chains).toHaveLength(1);
    });

    test('get chain by ID', async () => {
      const created = await proxyChain.createChain('My Chain', ['10.0.0.1:8080', '10.0.0.2:8081']);
      const result = await proxyChain.getChain(created.chain.id);
      expect(result.success).toBe(true);
      expect(result.chain.name).toBe('My Chain');
    });

    test('update chain', async () => {
      const created = await proxyChain.createChain('Old', ['10.0.0.1:8080', '10.0.0.2:8081']);
      const result = await proxyChain.updateChain(created.chain.id, { name: 'New Name' });
      expect(result.success).toBe(true);
    });

    test('delete chain', async () => {
      const created = await proxyChain.createChain('To Delete', ['10.0.0.1:8080', '10.0.0.2:8081']);
      const result = await proxyChain.deleteChain(created.chain.id);
      expect(result.success).toBe(true);
    });

    test('chain falls back to null when no explicit fallback', async () => {
      const result = await proxyChain.createChain('Test', ['10.0.0.1:8080', '10.0.0.2:8081']);
      expect(result.chain.fallback).toBeNull();
    });
  });

  describe('stats', () => {
    test('get stats for chain with no history', async () => {
      const result = await proxyChain.getChainStats('nonexistent');
      expect(result.success).toBe(true);
      expect(result.stats.totalTests).toBe(0);
    });
  });
});
