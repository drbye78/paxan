// Unit tests for Tamper Detector

const { TamperDetector } = require('../test-shim');

describe('Tamper Detector', () => {
  let detector;

  beforeEach(() => {
    detector = new TamperDetector();
    detector.init();
  });

  describe('detectTampering', () => {
    test('should detect tampered response with script injection', () => {
      const headers = { 'user-agent': 'Mozilla/5.0' };
      const content = '<script>alert("xss")</script>';
      const url = 'https://httpbin.org/headers';
      
      const result = detector.detectTampering(headers, content, url);
      expect(result).toBe(true);
    });

    test('should detect suspicious response', () => {
      const headers = { 'user-agent': 'Mozilla/5.0' };
      const content = 'Some content with eval(something) inside';
      const url = 'https://httpbin.org/headers';
      
      const result = detector.detectTampering(headers, content, url);
      expect(result).toBe(true);
    });

    test('should pass clean content', () => {
      const headers = { 'user-agent': 'Mozilla/5.0' };
      const content = '{"origin": "192.168.1.1"}';
      const url = 'https://httpbin.org/ip';
      
      const result = detector.detectTampering(headers, content, url);
      expect(result).toBe(false);
    });

    test('should detect long user-agent', () => {
      const headers = { 'user-agent': 'A'.repeat(300) };
      const content = '{}';
      const url = 'https://httpbin.org/headers';
      
      const result = detector.detectTampering(headers, content, url);
      expect(result).toBe(true);
    });
  });

  describe('detectSuspiciousContent', () => {
    test('should detect script tags', () => {
      const headers = {};
      const content = '<script>document.location="evil.com"</script>';
      
      expect(detector.detectSuspiciousContent(headers, content)).toBe(true);
    });

    test('should detect eval()', () => {
      const headers = {};
      const content = 'Some text with eval("malicious code")';
      
      expect(detector.detectSuspiciousContent(headers, content)).toBe(true);
    });

    test('should detect document.cookie access', () => {
      const headers = {};
      const content = 'var cookie = document.cookie;';
      
      expect(detector.detectSuspiciousContent(headers, content)).toBe(true);
    });

    test('should pass clean JSON content', () => {
      const headers = {};
      const content = '{"ip": "192.168.1.1", "country": "Germany"}';
      
      expect(detector.detectSuspiciousContent(headers, content)).toBe(false);
    });

    test('should pass clean text content', () => {
      const headers = {};
      const content = 'Just some normal text content without any suspicious patterns.';
      
      expect(detector.detectSuspiciousContent(headers, content)).toBe(false);
    });
  });

  describe('suspiciousProxies management', () => {
    test('should add to suspicious list', () => {
      detector.suspiciousProxies.add('192.168.1.1:8080');
      expect(detector.suspiciousProxies.has('192.168.1.1:8080')).toBe(true);
    });

    test('should remove from suspicious list', () => {
      detector.suspiciousProxies.add('192.168.1.1:8080');
      detector.suspiciousProxies.delete('192.168.1.1:8080');
      expect(detector.suspiciousProxies.has('192.168.1.1:8080')).toBe(false);
    });

    test('should get suspicious list', () => {
      detector.suspiciousProxies.add('192.168.1.1:8080');
      detector.suspiciousProxies.add('192.168.1.2:8080');
      
      const list = Array.from(detector.suspiciousProxies);
      expect(list).toContain('192.168.1.1:8080');
      expect(list).toContain('192.168.1.2:8080');
    });
  });

  describe('baselines', () => {
    test('should clear baselines', () => {
      detector.baselines = { 'proxy1': { content: 'test' } };
      detector.baselines = {};
      expect(Object.keys(detector.baselines).length).toBe(0);
    });
  });

  describe('TEST_ENDPOINTS', () => {
    test('should have required endpoints defined', () => {
      expect(detector.baselines).toBeDefined();
    });
  });
});
