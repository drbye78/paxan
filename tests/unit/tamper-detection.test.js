/**
 * Unit tests for Tamper Detector.
 *
 * Validates ES module imports, API surface, and smoke-tests the
 * computational detection methods (no storage/network dependencies).
 */

import { TamperDetector, ENDPOINTS, TEST_ENDPOINTS } from '../../src/security/tamper-detection.js';

describe('TamperDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new TamperDetector();
  });

  // ==========================================================================
  // API surface
  // ==========================================================================

  describe('imports and construction', () => {
    test('should import TamperDetector class', () => {
      expect(TamperDetector).toBeDefined();
      expect(typeof TamperDetector).toBe('function');
    });

    test('should import ENDPOINTS and TEST_ENDPOINTS', () => {
      expect(ENDPOINTS).toBeDefined();
      expect(TEST_ENDPOINTS).toBeDefined();
    });

    test('should construct without error', () => {
      expect(detector).toBeDefined();
      expect(detector).toBeInstanceOf(TamperDetector);
    });

    test('should have expected methods', () => {
      const expectedMethods = [
        'testProxy',
        'verifyContent',
        'detectTampering',
        'detectSuspiciousContent',
        'init',
        'establishBaseline',
        'hashContent',
        'addToSuspicious',
        'removeFromSuspicious',
        'isSuspicious',
        'getSuspiciousList',
        'clearBaselines',
      ];

      expectedMethods.forEach(method => {
        expect(typeof detector[method]).toBe('function');
      });
    });

    test('should have empty initial state', () => {
      expect(detector.baselines).toEqual({});
      expect(detector.suspiciousProxies).toBeInstanceOf(Set);
      expect(detector.suspiciousProxies.size).toBe(0);
    });
  });

  // ==========================================================================
  // ENTPOINTS exports
  // ==========================================================================

  describe('ENDPOINTS', () => {
    test('should be a non-empty array of HTTPS URLs', () => {
      expect(Array.isArray(ENDPOINTS)).toBe(true);
      expect(ENDPOINTS.length).toBeGreaterThan(0);
      ENDPOINTS.forEach(endpoint => {
        expect(endpoint).toMatch(/^https:\/\//);
      });
    });
  });

  describe('TEST_ENDPOINTS', () => {
    test('should be a non-empty array of objects with url property', () => {
      expect(Array.isArray(TEST_ENDPOINTS)).toBe(true);
      expect(TEST_ENDPOINTS.length).toBeGreaterThan(0);
      TEST_ENDPOINTS.forEach(endpoint => {
        expect(endpoint).toHaveProperty('url');
        expect(endpoint.url).toMatch(/^https:\/\//);
      });
    });
  });

  // ==========================================================================
  // detectTampering — legacy signature (headers, content, url) → boolean
  // ==========================================================================

  describe('detectTampering (legacy signature)', () => {
    test('should detect tampering with suspiciously long user-agent', () => {
      const headers = { 'user-agent': 'a'.repeat(550) };
      const result = detector.detectTampering(headers, '{}', 'https://httpbin.org/headers');
      expect(result).toBe(true);
    });

    test('should detect tampering with script injection in content', () => {
      const headers = { 'user-agent': 'Mozilla/5.0' };
      const result = detector.detectTampering(headers, '<script>malicious()</script>', 'https://httpbin.org/headers');
      expect(result).toBe(true);
    });

    test('should detect tampering with eval in content', () => {
      const headers = { 'user-agent': 'Mozilla/5.0' };
      const result = detector.detectTampering(headers, 'eval(malicious_code)', 'https://httpbin.org/headers');
      expect(result).toBe(true);
    });

    test('should not detect tampering for valid JSON response', () => {
      const headers = {
        'user-agent': 'Mozilla/5.0',
        'content-type': 'application/json'
      };
      const result = detector.detectTampering(headers, '{"origin": "1.1.1.1"}', 'https://httpbin.org/ip');
      expect(result).toBe(false);
    });

    test('should detect tampering with missing origin in ip response', () => {
      const headers = { 'user-agent': 'Mozilla/5.0' };
      const result = detector.detectTampering(headers, '{"wrong_key": "value"}', 'https://httpbin.org/ip');
      expect(result).toBe(true);
    });

    test('should detect tampering with invalid JSON in ip response', () => {
      const headers = { 'user-agent': 'Mozilla/5.0' };
      const result = detector.detectTampering(headers, 'not json', 'https://httpbin.org/ip');
      expect(result).toBe(true);
    });
  });

  // ==========================================================================
  // detectTampering — new array-based signature → { tampered }
  // ==========================================================================

  describe('detectTampering (array-based signature)', () => {
    test('should return { tampered: false } for clean results', () => {
      const results = [
        {
          headers: { 'user-agent': 'normal' },
          content: '<html><body>ok</body></html>',
          url: 'https://httpbin.org/headers',
          status: 200
        }
      ];
      const result = detector.detectTampering(results);
      expect(result).toEqual({ tampered: false });
    });

    test('should return { tampered: true } when a result is tampered', () => {
      const results = [
        {
          headers: { 'user-agent': 'a'.repeat(550) },
          content: '{}',
          url: 'https://httpbin.org/headers',
          status: 200
        }
      ];
      const result = detector.detectTampering(results);
      expect(result).toEqual({ tampered: true });
    });

    test('should skip results with errors', () => {
      const results = [
        {
          error: 'Network error',
          headers: {},
          content: '',
          url: 'https://httpbin.org/headers',
          status: 0
        }
      ];
      const result = detector.detectTampering(results);
      expect(result).toEqual({ tampered: false });
    });
  });

  // ==========================================================================
  // detectSuspiciousContent
  // ==========================================================================

  describe('detectSuspiciousContent', () => {
    test('should detect suspicious script tags with eval/b64 src', () => {
      const headers = {};
      const content = '<script src="eval.js"></script>';
      expect(detector.detectSuspiciousContent(headers, content)).toBe(true);
    });

    test('should detect eval with atob/btoa', () => {
      const headers = {};
      const content = 'eval(atob("base64code"))';
      expect(detector.detectSuspiciousContent(headers, content)).toBe(true);
    });

    test('should detect document.cookie assignment', () => {
      const headers = {};
      const content = 'document.cookie = "session=abc123"';
      expect(detector.detectSuspiciousContent(headers, content)).toBe(true);
    });

    test('should detect excessive script tags', () => {
      const headers = {};
      const content = '<script></script><script></script><script></script><script></script>';
      expect(detector.detectSuspiciousContent(headers, content)).toBe(true);
    });

    test('should not flag normal JSON content', () => {
      const headers = { 'content-type': 'application/json' };
      const content = '{"status": "ok", "data": []}';
      expect(detector.detectSuspiciousContent(headers, content)).toBe(false);
    });

    test('should not flag normal HTML content', () => {
      const headers = { 'content-type': 'text/html' };
      const content = '<html><body><h1>Hello World</h1></body></html>';
      expect(detector.detectSuspiciousContent(headers, content)).toBe(false);
    });
  });

  // ==========================================================================
  // Suspicious proxy tracking
  // ==========================================================================

  describe('suspicious proxy tracking', () => {
    test('addToSuspicious should mark a proxy as suspicious', () => {
      detector.addToSuspicious('1.1.1.1:8080');
      expect(detector.isSuspicious('1.1.1.1:8080')).toBe(true);
    });

    test('removeFromSuspicious should unmark a proxy', () => {
      detector.addToSuspicious('1.1.1.1:8080');
      detector.removeFromSuspicious('1.1.1.1:8080');
      expect(detector.isSuspicious('1.1.1.1:8080')).toBe(false);
    });

    test('isSuspicious returns false for unknown proxies', () => {
      expect(detector.isSuspicious('unknown:8080')).toBe(false);
    });

    test('getSuspiciousList should return all suspicious proxies', () => {
      detector.addToSuspicious('1.1.1.1:8080');
      detector.addToSuspicious('2.2.2.2:8080');

      const list = detector.getSuspiciousList();
      expect(list.length).toBe(2);
      expect(list).toContain('1.1.1.1:8080');
      expect(list).toContain('2.2.2.2:8080');
    });
  });

  // ==========================================================================
  // clearBaselines
  // ==========================================================================

  describe('clearBaselines', () => {
    test('should clear all baselines', async () => {
      detector.baselines['https://example.com'] = {
        hash: 'abc123',
        content: 'test',
        established: Date.now()
      };

      await detector.clearBaselines();
      expect(detector.baselines).toEqual({});
    });
  });
});
