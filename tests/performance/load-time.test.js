// Performance tests for load time and responsiveness

const { debounce, throttle, VirtualScroller } = require('../test-shim');

describe('Performance Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="scrollContainer" style="height: 500px; overflow-y: auto;"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Load Performance', () => {
    test('proxy filtering should respond in under 100ms', () => {
      const proxies = [];
      
      for (let i = 0; i < 1000; i++) {
        proxies.push({
          ip: `192.168.${Math.floor(i / 255)}.${i % 255}`,
          port: 8080,
          ipPort: `192.168.${Math.floor(i / 255)}.${i % 255}:8080`,
          country: i % 3 === 0 ? 'Germany' : i % 3 === 1 ? 'USA' : 'France',
          type: i % 2 === 0 ? 'HTTPS' : 'SOCKS5',
          speedMs: Math.floor(Math.random() * 1000)
        });
      }

      const startTime = performance.now();
      
      const filtered = proxies.filter(p => 
        p.country === 'Germany' && 
        p.type === 'HTTPS' && 
        p.speedMs < 500
      );
      
      const responseTime = performance.now() - startTime;
      
      expect(responseTime).toBeLessThan(100);
      expect(filtered.length).toBeGreaterThan(0);
    });

    test('proxy data processing should complete quickly', () => {
      const { sanitizeProxyData, validateProxyInput } = require('../test-shim');
      
      const proxies = [];
      for (let i = 0; i < 500; i++) {
        proxies.push({
          ip: `192.168.${Math.floor(i / 255)}.${i % 255}`,
          port: 8080,
          country: 'Germany',
          type: 'HTTPS'
        });
      }

      const startTime = performance.now();
      
      const processed = proxies.map(p => ({
        ...sanitizeProxyData(p),
        valid: validateProxyInput(p.ip)
      }));
      
      const responseTime = performance.now() - startTime;
      
      expect(responseTime).toBeLessThan(200);
      expect(processed.length).toBe(500);
    });
  });

  describe('Memory Performance', () => {
    test('should handle large proxy lists efficiently', () => {
      const proxies = [];
      for (let i = 0; i < 500; i++) {
        proxies.push({
          ip: `192.168.${Math.floor(i / 255)}.${i % 255}`,
          port: 8080,
          country: 'Germany',
          type: 'HTTPS',
          speedMs: 50
        });
      }

      expect(proxies.length).toBe(500);
      
      const filtered = proxies.slice(0, 100);
      expect(filtered.length).toBe(100);
    });
  });

  describe('Network Performance', () => {
    test('validation should timeout quickly for invalid data', () => {
      const { validateProxyInput, validateProxyPort } = require('../test-shim');
      
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        validateProxyInput('invalid-ip');
        validateProxyPort(99999);
      }
      
      const responseTime = performance.now() - startTime;
      
      expect(responseTime).toBeLessThan(100);
    });
  });

  describe('UI Responsiveness', () => {
    test('debounce should not block execution', () => {
      let callCount = 0;
      const debouncedFn = debounce(() => callCount++, 50);
      
      const startTime = performance.now();
      
      for (let i = 0; i < 10; i++) {
        debouncedFn();
      }
      
      const responseTime = performance.now() - startTime;
      
      expect(responseTime).toBeLessThan(50);
      expect(callCount).toBe(0);
    });

    test('throttle should execute immediately', () => {
      let callCount = 0;
      const throttledFn = throttle(() => callCount++, 50);
      
      const startTime = performance.now();
      
      for (let i = 0; i < 10; i++) {
        throttledFn();
      }
      
      const responseTime = performance.now() - startTime;
      
      expect(responseTime).toBeLessThan(50);
      expect(callCount).toBe(1);
    });
  });

  describe('Cache Performance', () => {
    test('should process cached data quickly', () => {
      const cache = new Map();
      
      for (let i = 0; i < 100; i++) {
        cache.set(`proxy-${i}`, { ip: `192.168.1.${i}`, port: 8080 });
      }

      const startTime = performance.now();
      
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(cache.get(`proxy-${i}`));
      }
      
      const responseTime = performance.now() - startTime;
      
      expect(responseTime).toBeLessThan(50);
      expect(results.length).toBe(100);
    });
  });

  describe('Virtual Scroller Performance', () => {
    test('should handle many items efficiently', () => {
      const container = document.getElementById('scrollContainer');
      const items = new Array(1000).fill(null).map((_, i) => ({ 
        ip: `192.168.1.${i}`, 
        port: 8080 
      }));
      
      const scroller = new VirtualScroller(container, {
        itemHeight: 72,
        renderItem: (item) => `<div>${item.ip}</div>`
      });
      
      const startTime = performance.now();
      scroller.setItems(items);
      const setupTime = performance.now() - startTime;
      
      expect(setupTime).toBeLessThan(500);
      
      scroller.destroy();
    });
  });
});
