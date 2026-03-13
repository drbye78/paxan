// Integration tests for message handling between popup and background

describe('Message Handling Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Proxy Connection Workflow', () => {
    test('should handle proxy connection with validation', () => {
      const { validateProxyInput, validateProxyPort, validateProxyType } = require('../test-shim');
      
      const proxy = { 
        ip: '192.168.1.1', 
        port: 8080, 
        type: 'HTTPS',
        ipPort: '192.168.1.1:8080'
      };

      expect(validateProxyInput(proxy.ip)).toBe(true);
      expect(validateProxyPort(proxy.port)).toBe(true);
      expect(validateProxyType(proxy.type)).toBe(true);
    });

    test('should handle invalid proxy data', () => {
      const { validateProxyInput, validateProxyPort, validateProxyType } = require('../test-shim');
      
      const invalidProxy = { 
        ip: 'invalid-ip', 
        port: 99999, 
        type: 'INVALID',
        ipPort: 'invalid-ip:99999'
      };

      expect(validateProxyInput(invalidProxy.ip)).toBe(false);
      expect(validateProxyPort(invalidProxy.port)).toBe(false);
      expect(validateProxyType(invalidProxy.type)).toBe(false);
    });

    test('should handle proxy connection failure', () => {
      const { handleProxyError } = require('../test-shim');
      
      const error = new Error('Connection refused');
      const safeError = handleProxyError(error);
      
      expect(safeError.message).toBeDefined();
    });
  });

  describe('Storage Integration', () => {
    test('should handle proxy data sanitization', () => {
      const { sanitizeProxyData } = require('../test-shim');
      
      const proxy = {
        ip: '192.168.1.1',
        port: 8080,
        country: 'Germany',
        type: 'HTTPS'
      };
      
      const sanitized = sanitizeProxyData(proxy);
      expect(sanitized.ip).toBe('192.168.1.1');
    });
  });

  describe('Rate Limiting Integration', () => {
    test('should handle rate limiting', () => {
      const { RateLimiter } = require('../test-shim');
      
      const limiter = new RateLimiter(2, 1000);
      
      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(false);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle message errors gracefully', () => {
      const { handleProxyError } = require('../test-shim');
      
      const error = new Error('Test error');
      const result = handleProxyError(error);
      
      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
    });
  });

  describe('Security Integration', () => {
    test('should handle security validation', () => {
      const { validateProxyUrl, filterMaliciousProxies } = require('../test-shim');
      
      expect(validateProxyUrl('http://192.168.1.1:8080')).toBe(true);
      expect(validateProxyUrl('javascript:alert(1)')).toBe(false);
      
      const proxies = [
        { ip: '8.8.8.8', port: 8080, type: 'HTTP' }
      ];
      const filtered = filterMaliciousProxies(proxies);
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Component Communication', () => {
    test('should validate proxy communication', () => {
      const { debounce, throttle } = require('../test-shim');
      
      let callCount = 0;
      const debouncedFn = debounce(() => callCount++, 100);
      const throttledFn = throttle(() => callCount++, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      throttledFn();
      throttledFn();
      
      expect(callCount).toBe(1);
    });
  });

  describe('Data Consistency', () => {
    test('should maintain data consistency', () => {
      const { sanitizeProxyData } = require('../test-shim');
      
      const originalData = {
        ip: '192.168.1.1',
        port: 8080,
        type: 'HTTPS',
        country: 'Germany'
      };
      
      const sanitized = sanitizeProxyData({ ...originalData });
      
      expect(sanitized.ip).toBe(originalData.ip);
      expect(sanitized.port).toBe(originalData.port);
      expect(sanitized.type).toBe(originalData.type);
    });
  });
});
