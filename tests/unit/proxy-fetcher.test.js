// Unit tests for Proxy Fetcher

const {
  parseSpeed,
  normalizeProxyType,
  getCountryName,
  createProxyObject,
  parseCSVLine,
  parseProxyMania,
  parseProxyScrapeCSV
} = require('../test-shim');

describe('Proxy Fetcher', () => {
  describe('parseSpeed', () => {
    test('should parse speed in milliseconds', () => {
      expect(parseSpeed('45 ms')).toBe(45);
      expect(parseSpeed('100ms')).toBe(100);
      expect(parseSpeed('150 ms')).toBe(150);
    });

    test('should parse speed in seconds', () => {
      expect(parseSpeed('1.5 sec')).toBe(1500);
      expect(parseSpeed('2 sec')).toBe(2000);
      expect(parseSpeed('0.5 seconds')).toBe(500);
    });

    test('should handle missing speed', () => {
      expect(parseSpeed(null)).toBe(9999);
      expect(parseSpeed('')).toBe(9999);
      expect(parseSpeed(undefined)).toBe(9999);
    });

    test('should handle invalid speed', () => {
      expect(parseSpeed('fast')).toBe(9999);
      expect(parseSpeed('unknown')).toBe(9999);
    });
  });

  describe('normalizeProxyType', () => {
    test('should normalize HTTPS types', () => {
      expect(normalizeProxyType('HTTPS')).toBe('HTTPS');
      expect(normalizeProxyType('HTTP')).toBe('HTTPS');
      expect(normalizeProxyType('http')).toBe('HTTPS');
      expect(normalizeProxyType('https')).toBe('HTTPS');
    });

    test('should normalize SOCKS5 types', () => {
      expect(normalizeProxyType('SOCKS5')).toBe('SOCKS5');
      expect(normalizeProxyType('SOCKS')).toBe('SOCKS5');
      expect(normalizeProxyType('socks5')).toBe('SOCKS5');
    });

    test('should normalize SOCKS4 types', () => {
      expect(normalizeProxyType('SOCKS4')).toBe('SOCKS4');
      expect(normalizeProxyType('socks4')).toBe('SOCKS4');
    });

    test('should default to HTTPS for unknown types', () => {
      expect(normalizeProxyType('UNKNOWN')).toBe('HTTPS');
      expect(normalizeProxyType(null)).toBe('HTTPS');
      expect(normalizeProxyType('')).toBe('HTTPS');
    });
  });

  describe('getCountryName', () => {
    test('should return country name for known codes', () => {
      expect(getCountryName('US')).toBe('United States');
      expect(getCountryName('DE')).toBe('Germany');
      expect(getCountryName('FR')).toBe('France');
      expect(getCountryName('JP')).toBe('Japan');
    });

    test('should return code for unknown countries', () => {
      expect(getCountryName('XX')).toBe('XX');
      expect(getCountryName('ZZ')).toBe('ZZ');
    });

    test('should handle null/undefined', () => {
      expect(getCountryName(null)).toBe('Unknown');
      expect(getCountryName(undefined)).toBe('Unknown');
      expect(getCountryName('')).toBe('Unknown');
    });

    test('should be case-insensitive', () => {
      expect(getCountryName('us')).toBe('United States');
      expect(getCountryName('de')).toBe('Germany');
    });
  });

  describe('createProxyObject', () => {
    test('should create proxy object with all fields', () => {
      const proxy = createProxyObject('192.168.1.1', 8080, 'Germany', 'HTTPS', '45 ms', 'Recently');
      
      expect(proxy.ip).toBe('192.168.1.1');
      expect(proxy.port).toBe(8080);
      expect(proxy.ipPort).toBe('192.168.1.1:8080');
      expect(proxy.country).toBe('Germany');
      expect(proxy.type).toBe('HTTPS');
      expect(proxy.speed).toBe('45 ms');
      expect(proxy.lastCheck).toBe('Recently');
      expect(proxy.speedMs).toBe(45);
    });

    test('should normalize proxy type', () => {
      const proxy = createProxyObject('192.168.1.1', 8080, 'Germany', 'HTTP', '100 ms', 'Recently');
      expect(proxy.type).toBe('HTTPS');
    });

    test('should parse speed to milliseconds', () => {
      const proxy = createProxyObject('192.168.1.1', 8080, 'Germany', 'HTTPS', '1.5 sec', 'Recently');
      expect(proxy.speedMs).toBe(1500);
    });
  });

  describe('parseCSVLine', () => {
    test('should parse simple CSV line', () => {
      const result = parseCSVLine('192.168.1.1,8080,Germany,HTTPS,45 ms,Recently');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe('192.168.1.1');
      expect(result[1]).toBe('8080');
    });

    test('should handle quoted values', () => {
      const result = parseCSVLine('"192.168.1.1","8080","Germany","HTTPS","45 ms","Recently"');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe('192.168.1.1');
    });

    test('should handle escaped quotes', () => {
      const result = parseCSVLine('"192.168.1.1","8080","Germany","HTTPS","45 ms","Recently ""just now"""');
      expect(result[5]).toBe('Recently "just now"');
    });

    test('should handle empty line', () => {
      const result = parseCSVLine('');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('');
    });
  });

  describe('parseProxyMania', () => {
    test('should parse HTML table rows', () => {
      const html = `
        <table>
          <tr>
            <td>192.168.1.1:8080</td>
            <td>Germany</td>
            <td>HTTPS</td>
            <td>Elite</td>
            <td>45 ms</td>
            <td>Recently</td>
          </tr>
          <tr>
            <td>10.0.0.1:3128</td>
            <td>United States</td>
            <td>HTTP</td>
            <td>Anonymous</td>
            <td>120 ms</td>
            <td>1 min</td>
          </tr>
        </table>
      `;
      
      const proxies = parseProxyMania(html);
      expect(proxies).toHaveLength(2);
      expect(proxies[0].ipPort).toBe('192.168.1.1:8080');
      expect(proxies[0].country).toBe('Germany');
      expect(proxies[0].type).toBe('HTTPS');
      expect(proxies[0].speedMs).toBe(45);
    });

    test('should handle empty HTML', () => {
      const proxies = parseProxyMania('');
      expect(proxies).toHaveLength(0);
    });

    test('should skip invalid rows', () => {
      const html = `
        <table>
          <tr>
            <td>192.168.1.1:8080</td>
            <td>Germany</td>
            <td>HTTPS</td>
            <td>Elite</td>
            <td>45 ms</td>
            <td>Recently</td>
          </tr>
          <tr>
            <td>invalid</td>
            <td>Germany</td>
          </tr>
        </table>
      `;
      
      const proxies = parseProxyMania(html);
      expect(proxies).toHaveLength(1);
    });
  });

  describe('parseProxyScrapeCSV', () => {
    test('should parse CSV with headers', () => {
      const csv = `ip,port,ip_data_countryCode,ip_data_country,protocol,average_timeout
192.168.1.1,8080,DE,Germany,HTTPS,45
10.0.0.1,3128,US,United States,HTTP,120`;
      
      const proxies = parseProxyScrapeCSV(csv);
      expect(proxies).toHaveLength(2);
      expect(proxies[0].ipPort).toBe('192.168.1.1:8080');
      expect(proxies[0].country).toBe('Germany');
      expect(proxies[0].speedMs).toBe(45);
    });

    test('should handle empty CSV', () => {
      const proxies = parseProxyScrapeCSV('');
      expect(proxies).toHaveLength(0);
    });

    test('should handle CSV with only headers', () => {
      const csv = `ip,port,ip_data_countryCode,ip_data_country,protocol,average_timeout`;
      const proxies = parseProxyScrapeCSV(csv);
      expect(proxies).toHaveLength(0);
    });

    test('should skip invalid rows', () => {
      const csv = `ip,port,ip_data_countryCode,ip_data_country,protocol,average_timeout
192.168.1.1,8080,DE,Germany,HTTPS,45
invalid,row`;
      
      const proxies = parseProxyScrapeCSV(csv);
      expect(proxies).toHaveLength(1);
    });
  });
});