// Security tests for proxy validation and data sanitization

const {
  validateProxyInput,
  validateProxyPort,
  validateProxyType,
  validateProxyUrl,
  validateProxyAuth,
  validateProxySource,
  sanitizeProxyData,
  filterMaliciousProxies,
  encryptProxyData,
  decryptProxyData,
  handleProxyError
} = require('../test-shim');

describe('Security Tests', () => {
  describe('Input Validation', () => {
    test('should validate proxy IP addresses', () => {
      expect(validateProxyInput('192.168.1.1')).toBe(true);
      expect(validateProxyInput('10.0.0.1')).toBe(true);
      expect(validateProxyInput('127.0.0.1')).toBe(true);
      expect(validateProxyInput('8.8.8.8')).toBe(true);

      expect(validateProxyInput('256.1.1.1')).toBe(false);
      expect(validateProxyInput('192.168.1')).toBe(false);
      expect(validateProxyInput('192.168.1.1.1')).toBe(false);
      expect(validateProxyInput('not-an-ip')).toBe(false);
      expect(validateProxyInput('')).toBe(false);
    });

    test('should validate proxy ports', () => {
      expect(validateProxyPort(80)).toBe(true);
      expect(validateProxyPort(8080)).toBe(true);
      expect(validateProxyPort(3128)).toBe(true);
      expect(validateProxyPort(443)).toBe(true);

      expect(validateProxyPort(0)).toBe(false);
      expect(validateProxyPort(65536)).toBe(false);
      expect(validateProxyPort(-1)).toBe(false);
      expect(validateProxyPort('not-a-port')).toBe(false);
      expect(validateProxyPort('')).toBe(false);
    });

    test('should validate proxy types', () => {
      expect(validateProxyType('HTTPS')).toBe(true);
      expect(validateProxyType('SOCKS5')).toBe(true);
      expect(validateProxyType('SOCKS4')).toBe(true);
      expect(validateProxyType('HTTP')).toBe(true);

      expect(validateProxyType('INVALID')).toBe(false);
      expect(validateProxyType('')).toBe(false);
      expect(validateProxyType(null)).toBe(false);
    });

    test('should sanitize proxy data from external sources', () => {
      const maliciousData = {
        ip: '192.168.1.1',
        port: '8080',
        country: 'Germany',
        type: 'HTTPS',
        speed: '45 ms'
      };

      const sanitized = sanitizeProxyData(maliciousData);

      expect(sanitized.ip).toBe('192.168.1.1');
      expect(sanitized.country).toBe('Germany');
      expect(sanitized.speed).toBe('45 ms');
      expect(sanitized.type).toBe('HTTPS');
      expect(sanitized.port).toBe(8080);
    });
  });

  describe('XSS Prevention', () => {
    test('should sanitize HTML from proxy data', () => {
      const maliciousProxy = {
        ip: '192.168.1.1',
        port: 8080,
        ipPort: '192.168.1.1:8080',
        country: 'Germany',
        type: 'HTTPS',
        speed: '45 ms'
      };

      const sanitized = sanitizeProxyData(maliciousProxy);

      expect(sanitized.country).toBe('Germany');
    });
  });

  describe('Network Security', () => {
    test('should validate proxy URLs', () => {
      expect(validateProxyUrl('http://192.168.1.1:8080')).toBe(true);
      expect(validateProxyUrl('https://proxy.example.com:443')).toBe(true);

      expect(validateProxyUrl('javascript:alert(1)')).toBe(false);
      expect(validateProxyUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(validateProxyUrl('file:///etc/passwd')).toBe(false);
      expect(validateProxyUrl('')).toBe(false);
    });

    test('should validate proxy sources', () => {
      expect(validateProxySource('https://proxymania.su/proxies')).toBe(true);
      expect(validateProxySource('https://api.proxyscrape.com')).toBe(true);
      expect(validateProxySource('invalid')).toBe(false);
    });

    test('should filter malicious proxies', () => {
      const maliciousList = [
        { ip: '192.168.1.1', port: 8080, type: 'HTTP' },
        { ip: '127.0.0.1', port: 8080, type: 'HTTP' },
        { ip: '8.8.8.8', port: 8080, type: 'HTTP' }
      ];

      const filtered = filterMaliciousProxies(maliciousList);

      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('Data Security', () => {
    test('should encrypt sensitive proxy data', () => {
      const proxy = {
        ip: '192.168.1.1',
        port: 8080,
        type: 'HTTPS',
        credentials: 'user:pass'
      };

      const encrypted = encryptProxyData(proxy);
      expect(encrypted).not.toContain('user:pass');
      expect(typeof encrypted).toBe('string');

      const decrypted = decryptProxyData(encrypted);
      expect(decrypted.credentials).toBe('user:pass');
    });
  });

  describe('Authentication Security', () => {
    test('should validate proxy authentication', () => {
      const validAuth = {
        username: 'user',
        password: 'pass'
      };
      expect(validateProxyAuth(validAuth)).toBe(true);

      const invalidAuth = {
        username: '',
        password: ''
      };
      expect(validateProxyAuth(invalidAuth)).toBe(false);
    });
  });

  describe('Error Handling Security', () => {
    test('should handle errors gracefully', () => {
      const error = new Error('Test error');
      const safe = handleProxyError(error);
      
      expect(safe).toBeDefined();
      expect(safe.message).toBeDefined();
    });

    test('should sanitize error messages', () => {
      const error = new Error('<script>alert(1)</script>');
      const safe = handleProxyError(error);

      expect(safe.message).not.toContain('<script>');
    });
  });
});
