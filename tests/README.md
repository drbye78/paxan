# ProxyMania VPN - Comprehensive Test Suite

This document outlines the complete testing strategy for the ProxyMania VPN Chrome extension, covering unit tests, integration tests, end-to-end tests, and performance tests.

## Test Suite Overview

### Test Categories

1. **Unit Tests** - Individual function testing
2. **Integration Tests** - Component interaction testing
3. **End-to-End Tests** - Full user workflow testing
4. **Performance Tests** - Load and performance testing
5. **Security Tests** - Security vulnerability testing
6. **Accessibility Tests** - WCAG compliance testing

### Testing Frameworks

- **Jest** - Unit and integration tests
- **Playwright** - End-to-end and browser tests
- **Lighthouse CI** - Performance and accessibility
- **ESLint + Security Plugins** - Code quality and security

## Test Structure

```
tests/
├── __mocks__/                    # Mock implementations
│   ├── chrome-api-mock.js       # Chrome API mocks
│   ├── storage-mock.js          # Storage API mock
│   └── fetch-mock.js            # Network request mock
├── __fixtures__/                 # Test data fixtures
│   ├── proxy-data.json          # Sample proxy data
│   ├── proxymania-html.html     # HTML fixtures
│   └── proxyscrape-csv.csv      # CSV fixtures
├── unit/                        # Unit tests
│   ├── background.test.js       # Background script tests
│   ├── popup.test.js           # Popup script tests
│   ├── utils.test.js           # Utility function tests
│   └── modules/                # Module-specific tests
│       ├── webrtc-blocker.test.js
│       ├── security.test.js
│       └── proxy-validator.test.js
├── integration/                 # Integration tests
│   ├── message-handling.test.js # Message passing tests
│   ├── storage-integration.test.js
│   └── proxy-connection.test.js
├── e2e/                        # End-to-end tests
│   ├── user-workflows.test.js  # User scenario tests
│   ├── proxy-management.test.js
│   └── settings.test.js
├── performance/                 # Performance tests
│   ├── load-time.test.js       # Load performance
│   ├── memory-usage.test.js    # Memory tests
│   └── proxy-fetching.test.js  # Network performance
├── security/                   # Security tests
│   ├── xss-prevention.test.js  # XSS vulnerability tests
│   └── injection-prevention.test.js
├── accessibility/              # Accessibility tests
│   └── wcag-compliance.test.js
└── helpers/                    # Test utilities
    ├── test-utils.js           # Common test utilities
    └── mock-data.js            # Mock data generators
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  collectCoverageFrom: [
    'src/**/*.js',
    'background.js',
    'popup.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

### Playwright Configuration

```javascript
// playwright.config.js
module.exports = {
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 2,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
};
```

## Unit Tests

### Background Script Tests

```javascript
// tests/unit/background.test.js
describe('Background Script', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchProxies', () => {
    test('should fetch from ProxyMania by default', async () => {
      const result = await fetchProxies();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should fetch from ProxyScrape when configured', async () => {
      await chrome.storage.local.set({ settings: { proxySource: 'proxyscrape' } });
      const result = await fetchProxies();
      expect(result).toBeDefined();
    });

    test('should handle fetch errors gracefully', async () => {
      // Mock fetch to throw error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      await expect(fetchProxies()).rejects.toThrow();
    });
  });

  describe('parseProxyMania', () => {
    test('should parse HTML table correctly', () => {
      const html = `
        <table>
          <tr><td>192.168.1.1:8080</td><td>Germany</td><td>HTTPS</td></tr>
          <tr><td>192.168.1.2:8080</td><td>USA</td><td>SOCKS5</td></tr>
        </table>
      `;
      const result = parseProxyMania(html);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        ip: '192.168.1.1',
        port: 8080,
        country: 'Germany',
        type: 'HTTPS'
      });
    });
  });

  describe('testProxyConnectivity', () => {
    test('should test proxy successfully', async () => {
      const proxy = { ip: '127.0.0.1', port: 8080, type: 'HTTPS' };
      const result = await testProxyConnectivity(proxy);
      expect(result).toMatchObject({
        success: expect.any(Boolean),
        latency: expect.any(Number)
      });
    });
  });
});
```

### Popup Script Tests

```javascript
// tests/unit/popup.test.js
describe('Popup Script', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="proxyList"></div>
      <div id="proxyCount"></div>
      <div id="statusBadge"></div>
    `;
  });

  describe('calculateProxyScore', () => {
    test('should calculate score based on multiple factors', () => {
      const proxy = { speedMs: 100 };
      const stats = { successRate: 80, avgLatency: 120 };
      
      const score = calculateProxyScore(proxy);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    test('should boost score for favorites', () => {
      const proxy = { speedMs: 100, ipPort: '192.168.1.1:8080' };
      const favorites = [{ ipPort: '192.168.1.1:8080' }];
      
      const score = calculateProxyScore(proxy);
      // Score should be higher than without favorites
      expect(score).toBeGreaterThan(50);
    });
  });

  describe('filterProxies', () => {
    test('should filter by country', () => {
      const proxies = [
        { country: 'Germany', ipPort: '1' },
        { country: 'USA', ipPort: '2' }
      ];
      
      // Mock DOM elements
      document.getElementById = jest.fn().mockImplementation((id) => {
        if (id === 'countryFilter') {
          return { value: 'Germany' };
        }
        return null;
      });

      // Test filtering logic
      const filtered = proxies.filter(p => p.country === 'Germany');
      expect(filtered).toHaveLength(1);
    });
  });
});
```

## Integration Tests

### Message Handling Tests

```javascript
// tests/integration/message-handling.test.js
describe('Message Handling Integration', () => {
  beforeEach(() => {
    // Setup Chrome API mocks
    setupChromeMocks();
  });

  test('should handle proxy connection workflow', async () => {
    const proxy = { ip: '127.0.0.1', port: 8080, type: 'HTTPS' };
    
    // Send connect message
    const response = await chrome.runtime.sendMessage({
      action: 'setProxy',
      proxy: proxy
    });

    expect(response.success).toBe(true);
    
    // Verify proxy was set
    const config = await chrome.proxy.settings.get({ scope: 'regular' });
    expect(config.value.rules.singleProxy.host).toBe(proxy.ip);
  });

  test('should handle proxy statistics updates', async () => {
    const proxy = { ipPort: '127.0.0.1:8080' };
    
    // Update stats
    await chrome.runtime.sendMessage({
      action: 'updateProxyStats',
      proxy: proxy,
      success: true,
      latency: 100
    });

    // Verify stats were updated
    const stats = await chrome.storage.local.get(['proxyStats']);
    expect(stats.proxyStats[proxy.ipPort].attempts).toBe(1);
    expect(stats.proxyStats[proxy.ipPort].successes).toBe(1);
  });
});
```

## End-to-End Tests

### User Workflow Tests

```javascript
// tests/e2e/user-workflows.test.js
import { test, expect } from '@playwright/test';

test.describe('User Workflows', () => {
  test('complete proxy connection workflow', async ({ page }) => {
    // Load extension popup
    await page.goto('chrome-extension://test-id/popup.html');
    
    // Wait for proxies to load
    await page.waitForSelector('#proxyList');
    
    // Verify proxies are displayed
    const proxyItems = await page.locator('.proxy-item').count();
    expect(proxyItems).toBeGreaterThan(0);
    
    // Select fastest proxy
    const fastestProxy = await page.locator('.proxy-item').first();
    await fastestProxy.click();
    
    // Wait for connection
    await page.waitForSelector('.status-badge.connected');
    
    // Verify connection status
    const statusText = await page.locator('.status-text').textContent();
    expect(statusText).toBe('Connected');
  });

  test('settings management workflow', async ({ page }) => {
    await page.goto('chrome-extension://test-id/popup.html');
    
    // Open settings
    await page.click('#settingsBtn');
    await page.waitForSelector('#settingsPanel');
    
    // Change theme
    await page.selectOption('#themeSelect', 'light');
    
    // Verify theme change
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
```

## Performance Tests

### Load Time Tests

```javascript
// tests/performance/load-time.test.js
describe('Performance Tests', () => {
  test('popup should load in under 3 seconds', async () => {
    const startTime = performance.now();
    
    // Simulate popup load
    await loadPopup();
    
    const loadTime = performance.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });

  test('proxy filtering should respond in under 100ms', async () => {
    const proxies = generateMockProxies(1000);
    
    const startTime = performance.now();
    const filtered = filterProxies(proxies, 'Germany');
    const responseTime = performance.now() - startTime;
    
    expect(responseTime).toBeLessThan(100);
    expect(filtered.length).toBeGreaterThan(0);
  });

  test('proxy fetching should complete in under 5 seconds', async () => {
    const startTime = performance.now();
    
    try {
      const proxies = await fetchProxies();
      const fetchTime = performance.now() - startTime;
      
      expect(fetchTime).toBeLessThan(5000);
      expect(proxies.length).toBeGreaterThan(0);
    } catch (error) {
      // Network errors are acceptable, but should timeout quickly
      const fetchTime = performance.now() - startTime;
      expect(fetchTime).toBeLessThan(5000);
    }
  });
});
```

## Security Tests

### XSS Prevention Tests

```javascript
// tests/security/xss-prevention.test.js
describe('Security Tests', () => {
  test('should prevent XSS in proxy data', () => {
    const maliciousData = {
      country: '<script>alert("xss")</script>',
      ip: '127.0.0.1',
      port: 8080
    };

    // Test HTML escaping
    const escaped = escapeHtml(maliciousData.country);
    expect(escaped).toBe('<script>alert("xss")</script>');
    expect(escaped).not.toContain('<script>');
  });

  test('should validate proxy input', () => {
    const invalidProxies = [
      { ip: 'not-an-ip', port: 8080 },
      { ip: '127.0.0.1', port: 99999 },
      { ip: '', port: 8080 }
    ];

    invalidProxies.forEach(proxy => {
      expect(validateProxy(proxy)).toBe(false);
    });
  });
});
```

## Accessibility Tests

### WCAG Compliance Tests

```javascript
// tests/accessibility/wcag-compliance.test.js
import { test, expect } from '@playwright/test';

test.describe('Accessibility Tests', () => {
  test('should meet WCAG AA contrast requirements', async ({ page }) => {
    await page.goto('chrome-extension://test-id/popup.html');
    
    // Check color contrast
    const elements = await page.locator('*').all();
    
    for (const element of elements) {
      const styles = await element.evaluate(el => {
        return {
          color: getComputedStyle(el).color,
          backgroundColor: getComputedStyle(el).backgroundColor
        };
      });
      
      // Verify contrast ratio (simplified check)
      expect(verifyContrast(styles.color, styles.backgroundColor)).toBe(true);
    }
  });

  test('should be navigable via keyboard', async ({ page }) => {
    await page.goto('chrome-extension://test-id/popup.html');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus is on interactive element
    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    expect(['BUTTON', 'INPUT', 'SELECT']).toContain(focusedElement);
  });
});
```

## Test Data Fixtures

### Mock Proxy Data

```javascript
// tests/__fixtures__/proxy-data.json
{
  "proxies": [
    {
      "ip": "192.168.1.1",
      "port": 8080,
      "ipPort": "192.168.1.1:8080",
      "country": "Germany",
      "type": "HTTPS",
      "speed": "45 ms",
      "lastCheck": "Recently",
      "speedMs": 45
    },
    {
      "ip": "192.168.1.2",
      "port": 8080,
      "ipPort": "192.168.1.2:8080",
      "country": "USA",
      "type": "SOCKS5",
      "speed": "120 ms",
      "lastCheck": "Recently",
      "speedMs": 120
    }
  ]
}
```

### Chrome API Mocks

```javascript
// tests/__mocks__/chrome-api-mock.js
export const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn()
    }
  },
  proxy: {
    settings: {
      set: jest.fn(),
      get: jest.fn(),
      clear: jest.fn()
    }
  },
  tabs: {
    query: jest.fn()
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  }
};

// Setup global chrome object
global.chrome = mockChrome;
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Run unit tests
      run: npm run test:unit
      
    - name: Run integration tests
      run: npm run test:integration
      
    - name: Run performance tests
      run: npm run test:performance
      
    - name: Run security tests
      run: npm run test:security
      
    - name: Run accessibility tests
      run: npm run test:accessibility

  e2e:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install Playwright
      run: npx playwright install
      
    - name: Run E2E tests
      run: npm run test:e2e
      
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: test-results
        path: test-results/
```

## Test Scripts

### Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "playwright test",
    "test:performance": "jest tests/performance",
    "test:security": "jest tests/security",
    "test:accessibility": "playwright test tests/accessibility",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "lint": "eslint src/ tests/",
    "security:audit": "npm audit",
    "performance:audit": "lighthouse-ci autorun"
  }
}
```

## Test Coverage Goals

### Coverage Targets

- **Unit Tests**: 90% line coverage, 85% branch coverage
- **Integration Tests**: All critical workflows covered
- **E2E Tests**: All user scenarios covered
- **Performance Tests**: All critical paths measured
- **Security Tests**: All input validation covered
- **Accessibility Tests**: WCAG AA compliance verified

### Coverage Reporting

```javascript
// jest.config.js coverage settings
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

## Test Execution Strategy

### Local Development

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### CI/CD Pipeline

1. **Pre-commit**: Lint and unit tests
2. **Push to branch**: Full test suite
3. **Pull request**: All tests + security scan
4. **Merge to main**: Performance audit + accessibility

## Test Maintenance

### Regular Tasks

- **Weekly**: Review test failures and flaky tests
- **Monthly**: Update test data and mock responses
- **Quarterly**: Review coverage reports and improve gaps
- **Annually**: Update testing frameworks and dependencies

### Test Documentation

- Each test file includes clear documentation
- Test scenarios are mapped to user stories
- Performance baselines are documented
- Security test cases are reviewed regularly

This comprehensive test suite ensures the ProxyMania VPN extension maintains high quality, security, and performance standards throughout its development lifecycle.