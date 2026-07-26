// Integration: DNS leak detection flow through dns-leak-test.js
import {
  captureRealIp,
  getStoredRealIp,
  testDnsLeak,
  enableDnsProtection,
  disableDnsProtection,
  getDnsProtectionStatus,
  saveDnsTestResult,
  getDnsHistory
} from '../../src/background/dns-leak-test.js';

describe('DNS Leak Detection Integration', () => {
  let sessionStorage;
  let localStorage;

  beforeEach(() => {
    sessionStorage = {};
    localStorage = {};

    // --- Session storage mock ---
    global.chrome.storage.session.get.mockImplementation((keys, callback) => {
      let result = {};
      if (Array.isArray(keys)) keys.forEach(k => { result[k] = sessionStorage[k]; });
      if (callback) callback(result);
      return Promise.resolve(result);
    });
    global.chrome.storage.session.set.mockImplementation((items) => {
      Object.assign(sessionStorage, items);
      return Promise.resolve();
    });

    // --- Local storage mock (for saveDnsTestResult, getDnsHistory, protection toggles) ---
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      let result = {};
      if (Array.isArray(keys)) keys.forEach(k => { result[k] = localStorage[k]; });
      if (callback) callback(result);
      return Promise.resolve(result);
    });
    global.chrome.storage.local.set.mockImplementation((items) => {
      Object.assign(localStorage, items);
      return Promise.resolve();
    });

    // --- Proxy settings mock (callback-compatible for proxyConfig.fetchDirect / withTestConfig) ---
    // proxy-config-manager.js uses callback style: chrome.proxy.settings.get({ scope }, cb)
    // The default mock from jest.setup.js uses Promise-only style, so we override here.
    global.chrome.proxy.settings.get.mockImplementation((options, callback) => {
      const config = {
        levelOfControl: 'controlled_by_this_extension',
        value: {
          mode: 'direct',
          rules: {}
        }
      };
      if (callback) callback(config);
      return Promise.resolve(config);
    });
    global.chrome.proxy.settings.set.mockImplementation((config, callback) => {
      if (callback) callback();
      return Promise.resolve();
    });
    global.chrome.proxy.settings.clear.mockImplementation((options, callback) => {
      if (callback) callback();
      return Promise.resolve();
    });

    // --- Fetch mock for IP detection ---
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ip: '203.0.113.1' })
    });
  });

  describe('Real IP capture', () => {
    test('getStoredRealIp returns null when not captured', async () => {
      const ip = await getStoredRealIp();
      expect(ip).toBeNull();
    });

    test('captureRealIp stores IP in session storage', async () => {
      const ip = await captureRealIp();
      expect(ip).toBe('203.0.113.1');
      const stored = await getStoredRealIp();
      expect(stored).toBe('203.0.113.1');
    });
  });

  describe('DNS leak test', () => {
    test('returns error when real IP not available', async () => {
      const result = await testDnsLeak();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Real IP not available');
    });

    test('fetches from DNS leak endpoint when IP is stored', async () => {
      await captureRealIp();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ip: '198.51.100.1' })
      });
      const result = await testDnsLeak();
      expect(result.success).toBe(true);
      expect(result.leaking).toBe(false);
    });
  });

  describe('DNS history', () => {
    test('save and retrieve DNS test results', async () => {
      await saveDnsTestResult({ realIp: '1.2.3.4', resolverIp: '5.6.7.8', leaking: false });
      const history = await getDnsHistory();
      expect(history.history).toHaveLength(1);
    });
  });

  describe('DNS protection toggles', () => {
    test('default protection is enabled', async () => {
      const response = await getDnsProtectionStatus();
      expect(response.status.enabled).toBe(true);
    });

    test('disable and enable protection', async () => {
      await disableDnsProtection();
      let response = await getDnsProtectionStatus();
      expect(response.status.enabled).toBe(false);

      await enableDnsProtection();
      response = await getDnsProtectionStatus();
      expect(response.status.enabled).toBe(true);
    });
  });
});
