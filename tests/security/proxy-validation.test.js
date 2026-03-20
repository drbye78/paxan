// Security Tests for Proxy Validation

import {
  validateProxyInput,
  validateProxyPort,
  validateProxyType,
  validateProxyUrl,
  validateProxyAuth,
  validateProxySource,
  validateStorageData,
  sanitizeProxyData,
  sanitizeProxyForDisplay,
  filterMaliciousProxies
} from '../test-shim.js';

describe('Proxy Validation Security Tests', () => {
  describe('Input Validation', () => {
    test('should validate proxy IP addresses', () => {
      expect(validateProxyInput('192.168.1.1')).toBe(true);
      expect(validateProxyInput('256.256.256.256')).toBe(false);
      expect(validateProxyInput('not-an-ip')).toBe(false);
    });

    test('should validate proxy ports', () => {
      expect(validateProxyPort(8080)).toBe(true);
      expect(validateProxyPort(65536)).toBe(false);
      expect(validateProxyPort(0)).toBe(false);
    });

    test('should validate proxy types', () => {
      expect(validateProxyType('HTTP')).toBe(true);
      expect(validateProxyType('SOCKS5')).toBe(true);
      expect(validateProxyType('INVALID')).toBe(false);
    });
  });

  describe('URL Validation', () => {
    test('should validate proxy URLs', () => {
      expect(validateProxyUrl('http://proxy.example.com:8080')).toBe(true);
      expect(validateProxyUrl('invalid-url')).toBe(false);
    });
  });

  describe('Authentication Validation', () => {
    test('should validate proxy authentication', () => {
      expect(validateProxyAuth('user:pass')).toBe(true);
      expect(validateProxyAuth('')).toBe(false);
    });
  });

  describe('Data Sanitization', () => {
    test('should sanitize proxy data', () => {
      const proxy = { ip: '192.168.1.1', port: 8080, type: 'HTTP' };
      const sanitized = sanitizeProxyData(proxy);
      expect(sanitized.ip).toBe('192.168.1.1');
    });

    test('should sanitize for display', () => {
      const proxy = { ip: '192.168.1.1', port: 8080, type: 'HTTP' };
      const display = sanitizeProxyForDisplay(proxy);
      expect(display).toContain('192.168.1.1:8080');
    });
  });

  describe('Malicious Proxy Filtering', () => {
    test('should filter malicious proxies', () => {
      const proxies = [
        { ip: '192.168.1.1', port: 8080, type: 'HTTP' },
        { ip: '0.0.0.0', port: 8080, type: 'HTTP' }
      ];
      const filtered = filterMaliciousProxies(proxies);
      expect(filtered.length).toBe(1);
    });
  });
});
