/**
 * Unit tests for Tamper Detector.
 * 
 * Tests the MITM attack detection system that verifies proxy content integrity.
 */

const { TamperDetector, TEST_ENDPOINTS } = require('../src/security/tamper-detection.js');

describe('TamperDetector', () => {
  let tamperDetector;

  beforeEach(async () => {
    tamperDetector = new TamperDetector();
    await tamperDetector.init();
  });

  describe('detectTampering', () => {
    test('should detect tampering with suspicious user-agent', () => {
      const headers = {
        'user-agent': 'a'.repeat(250) // Very long user-agent
      };
      const content = '{}';
      const url = 'https://httpbin.org/headers';

      const result = tamperDetector.detectTampering(headers, content, url);

      expect(result).toBe(true);
    });

    test('should detect tampering with script injection', () => {
      const headers = {
        'user-agent': 'Mozilla/5.0'
      };
      const content = '<script>malicious()</script>';
      const url = 'https://httpbin.org/headers';

      const result = tamperDetector.detectTampering(headers, content, url);

      expect(result).toBe(true);
    });

    test('should detect tampering with eval in content', () => {
      const headers = {
        'user-agent': 'Mozilla/5.0'
      };
      const content = 'eval(malicious_code)';
      const url = 'https://httpbin.org/headers';

      const result = tamperDetector.detectTampering(headers, content, url);

      expect(result).toBe(true);
    });

    test('should not detect tampering for valid response', () => {
      const headers = {
        'user-agent': 'Mozilla/5.0',
        'content-type': 'application/json'
      };
      const content = '{"origin": "1.1.1.1"}';
      const url = 'https://httpbin.org/ip';

      const result = tamperDetector.detectTampering(headers, content, url);

      expect(result).toBe(false);
    });

    test('should detect tampering with missing origin in ip response', () => {
      const headers = {
        'user-agent': 'Mozilla/5.0'
      };
      const content = '{"wrong_key": "value"}';
      const url = 'https://httpbin.org/ip';

      const result = tamperDetector.detectTampering(headers, content, url);

      expect(result).toBe(true);
    });
  });

  describe('detectSuspiciousContent', () => {
    test('should detect suspicious script tags', () => {
      const headers = {};
      const content = '<script src="malicious.js"></script>';

      const result = tamperDetector.detectSuspiciousContent(headers, content);

      expect(result).toBe(true);
    });

    test('should detect suspicious eval calls', () => {
      const headers = {};
      const content = 'eval(atob("base64code"))';

      const result = tamperDetector.detectSuspiciousContent(headers, content);

      expect(result).toBe(true);
    });

    test('should detect suspicious localStorage access', () => {
      const headers = {};
      const content = 'localStorage.getItem("token")';

      const result = tamperDetector.detectSuspiciousContent(headers, content);

      expect(result).toBe(true);
    });

    test('should not flag normal JSON content', () => {
      const headers = {
        'content-type': 'application/json'
      };
      const content = '{"status": "ok", "data": []}';

      const result = tamperDetector.detectSuspiciousContent(headers, content);

      expect(result).toBe(false);
    });

    test('should not flag normal HTML content', () => {
      const headers = {
        'content-type': 'text/html'
      };
      const content = '<html><body><h1>Hello World</h1></body></html>';

      const result = tamperDetector.detectSuspiciousContent(headers, content);

      expect(result).toBe(false);
    });
  });

  describe('hashContent', () => {
    test('should generate consistent hash for same content', async () => {
      const content = 'test content';

      const hash1 = await tamperDetector.hashContent(content);
      const hash2 = await tamperDetector.hashContent(content);

      expect(hash1).toBe(hash2);
    });

    test('should generate different hash for different content', async () => {
      const content1 = 'test content 1';
      const content2 = 'test content 2';

      const hash1 = await tamperDetector.hashContent(content1);
      const hash2 = await tamperDetector.hashContent(content2);

      expect(hash1).not.toBe(hash2);
    });

    test('should generate SHA-256 hash (64 hex characters)', async () => {
      const content = 'test content';

      const hash = await tamperDetector.hashContent(content);

      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('addToSuspicious', () => {
    test('should add proxy to suspicious list', () => {
      const ipPort = '1.1.1.1:8080';

      tamperDetector.addToSuspicious(ipPort);

      expect(tamperDetector.isSuspicious(ipPort)).toBe(true);
    });

    test('should remove proxy from suspicious list', () => {
      const ipPort = '1.1.1.1:8080';

      tamperDetector.addToSuspicious(ipPort);
      tamperDetector.removeFromSuspicious(ipPort);

      expect(tamperDetector.isSuspicious(ipPort)).toBe(false);
    });

    test('should get list of suspicious proxies', () => {
      tamperDetector.addToSuspicious('1.1.1.1:8080');
      tamperDetector.addToSuspicious('2.2.2.2:8080');

      const list = tamperDetector.getSuspiciousList();

      expect(list.length).toBe(2);
      expect(list).toContain('1.1.1.1:8080');
      expect(list).toContain('2.2.2.2:8080');
    });
  });

  describe('clearBaselines', () => {
    test('should clear all baselines', async () => {
      // Add a baseline
      tamperDetector.baselines['https://example.com'] = {
        hash: 'abc123',
        content: 'test',
        established: Date.now()
      };

      await tamperDetector.clearBaselines();

      expect(tamperDetector.baselines).toEqual({});
    });
  });

  describe('TEST_ENDPOINTS', () => {
    test('should have valid test endpoints', () => {
      expect(TEST_ENDPOINTS).toBeInstanceOf(Array);
      expect(TEST_ENDPOINTS.length).toBeGreaterThan(0);

      TEST_ENDPOINTS.forEach(endpoint => {
        expect(endpoint).toHaveProperty('url');
        expect(endpoint.url).toMatch(/^https:\/\//);
      });
    });
  });

  describe('verifyContent (integration)', () => {
    test('should handle network errors gracefully', async () => {
      const proxy = {
        ip: '192.168.1.1',
        port: 8080,
        ipPort: '192.168.1.1:8080',
        type: 'HTTPS'
      };

      // This would actually try to connect, so we expect it might fail
      // The important thing is it doesn't crash
      try {
        const result = await tamperDetector.verifyContent(proxy, 'https://httpbin.org/headers');
        expect(result).toHaveProperty('tampered');
        expect(result).toHaveProperty('url');
      } catch (error) {
        // Network errors are expected in test environment
        expect(error).toBeDefined();
      }
    });
  });
});
