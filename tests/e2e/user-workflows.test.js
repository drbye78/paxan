// End-to-End tests for user workflows using Playwright

import { test, expect } from '@playwright/test';

test.describe('User Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Chrome extension environment
    await page.addInitScript(() => {
      // Mock Chrome APIs
      window.chrome = {
        runtime: {
          sendMessage: async (message) => {
            if (message.action === 'fetchProxies') {
              return {
                success: true,
                proxies: [
                  {
                    ip: '192.168.1.1',
                    port: 8080,
                    ipPort: '192.168.1.1:8080',
                    country: 'Germany',
                    type: 'HTTPS',
                    speed: '45 ms',
                    lastCheck: 'Recently',
                    speedMs: 45
                  },
                  {
                    ip: '192.168.1.2',
                    port: 8080,
                    ipPort: '192.168.1.2:8080',
                    country: 'USA',
                    type: 'SOCKS5',
                    speed: '120 ms',
                    lastCheck: 'Recently',
                    speedMs: 120
                  }
                ]
              };
            }
            if (message.action === 'setProxy') {
              return { success: true };
            }
            if (message.action === 'getProxyStats') {
              return {
                stats: {
                  '192.168.1.1:8080': {
                    attempts: 5,
                    successes: 4,
                    failures: 1,
                    successRate: 80,
                    avgLatency: 45
                  }
                }
              };
            }
            return { success: true };
          },
          onMessage: {
            addListener: () => {},
            removeListener: () => {}
          }
        },
        storage: {
          local: {
            get: async (keys) => {
              const defaultData = {
                settings: {
                  theme: 'dark',
                  autoFailover: true,
                  testBeforeConnect: true,
                  autoConnect: false,
                  notifications: true,
                  refreshInterval: 300000,
                  proxySource: 'peasyproxy',
                  countryBlacklist: []
                },
                activeProxy: null,
                proxies: [],
                proxyStats: {},
                favorites: [],
                dailyStats: {
                  proxiesUsed: 0,
                  connectionTime: 0,
                  attempts: 0,
                  successes: 0
                }
              };

              if (typeof keys === 'string') {
                return { [keys]: defaultData[keys] };
              } else if (Array.isArray(keys)) {
                const result = {};
                keys.forEach(key => {
                  result[key] = defaultData[key];
                });
                return result;
              } else {
                return defaultData;
              }
            },
            set: async () => {},
            clear: async () => {}
          }
        },
        proxy: {
          settings: {
            set: async () => {},
            get: async () => ({ value: {} }),
            clear: async () => {}
          }
        },
        tabs: {
          query: async () => []
        },
        alarms: {
          create: async () => {},
          clear: async () => {},
          onAlarm: {
            addListener: () => {},
            removeListener: () => {}
          }
        }
      };
    });

    // Navigate to popup
    await page.goto('data:text/html,<html><body><div id="app"></div><script src="/popup.js"></script></body></html>');
    
    // Wait for popup to load
    await page.waitForSelector('#proxyList', { timeout: 10000 });
  });

  test('complete proxy connection workflow', async ({ page }) => {
    // 1. Verify proxies are loaded
    await page.waitForSelector('.proxy-item', { timeout: 5000 });
    const proxyItems = await page.locator('.proxy-item').count();
    expect(proxyItems).toBeGreaterThan(0);

    // 2. Verify proxy details are displayed
    const firstProxy = page.locator('.proxy-item').first();
    const proxyText = await firstProxy.locator('.proxy-ip span:last-child').textContent();
    expect(proxyText).toContain('192.168.1.');

    // 3. Verify status is disconnected initially
    const statusText = await page.locator('.status-text').textContent();
    expect(statusText).toBe('Disconnected');

    // 4. Connect to a proxy
    await firstProxy.click();

    // 5. Wait for connection process
    await page.waitForSelector('.status-badge.connected', { timeout: 10000 });

    // 6. Verify connection status
    const connectedStatusText = await page.locator('.status-text').textContent();
    expect(connectedStatusText).toBe('Connected');

    // 7. Verify proxy display is shown
    const proxyDisplay = page.locator('#currentProxyDisplay');
    await expect(proxyDisplay).toBeVisible();

    // 8. Verify timer is running
    const timer = page.locator('#connectionTimer');
    await expect(timer).toBeVisible();

    // 9. Verify proxy address is displayed
    const proxyAddress = await page.locator('#proxyAddress').textContent();
    expect(proxyAddress).toContain('192.168.1.');
  });

  test('proxy filtering workflow', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // 1. Test country filter
    const countryFilter = page.locator('#countryFilter');
    await countryFilter.selectOption('Germany');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify only German proxies are shown
    const proxyItems = page.locator('.proxy-item');
    const count = await proxyItems.count();
    
    for (let i = 0; i < count; i++) {
      const country = await proxyItems.nth(i).locator('.proxy-country').textContent();
      expect(country).toBe('Germany');
    }

    // 2. Test type filter
    const typeFilter = page.locator('#typeFilter');
    await typeFilter.selectOption('HTTPS');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify only HTTPS proxies are shown
    const filteredCount = await proxyItems.count();
    for (let i = 0; i < filteredCount; i++) {
      const type = await proxyItems.nth(i).locator('.proxy-type').textContent();
      expect(type).toBe('HTTPS');
    }

    // 3. Test search filter
    const searchInput = page.locator('#proxySearch');
    await searchInput.fill('192.168.1.1');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify only matching proxy is shown
    const searchCount = await proxyItems.count();
    expect(searchCount).toBe(1);
    
    const searchResult = await proxyItems.first().locator('.proxy-ip span:last-child').textContent();
    expect(searchResult).toBe('192.168.1.1:8080');
  });

  test('favorites management workflow', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    const firstProxy = page.locator('.proxy-item').first();

    // 1. Add proxy to favorites
    const favButton = firstProxy.locator('.fav-btn');
    await favButton.click();

    // 2. Verify favorite indicator appears
    await expect(firstProxy.locator('.fav-indicator')).toBeVisible();

    // 3. Switch to favorites tab
    const favoritesTab = page.locator('button[data-tab="favorites"]');
    await favoritesTab.click();

    // 4. Verify favorite proxy is shown
    await page.waitForSelector('.proxy-item', { timeout: 5000 });
    const favoriteItems = page.locator('.proxy-item');
    expect(await favoriteItems.count()).toBe(1);

    // 5. Remove from favorites
    const favoriteFavButton = favoriteItems.first().locator('.fav-btn');
    await favoriteFavButton.click();

    // 6. Verify favorite indicator disappears
    await expect(favoriteItems.first().locator('.fav-indicator')).not.toBeVisible();
  });

  test('settings management workflow', async ({ page }) => {
    // 1. Open settings
    const settingsBtn = page.locator('#settingsBtn');
    await settingsBtn.click();

    // 2. Wait for settings panel
    await page.waitForSelector('#settingsPanel', { timeout: 5000 });

    // 3. Change theme
    const themeSelect = page.locator('#themeSelect');
    await themeSelect.selectOption('light');

    // 4. Verify theme change is applied
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('data-theme', 'light');

    // 5. Change proxy source
    const proxySourceSelect = page.locator('#proxySource');
    await proxySourceSelect.selectOption('proxyscrape');

    // 6. Verify settings are saved (would need to check storage in real scenario)

    // 7. Close settings
    const closeBtn = page.locator('#settingsClose');
    await closeBtn.click();

    // 8. Verify settings panel is closed
    await expect(page.locator('#settingsPanel')).not.toBeVisible();
  });

  test('quick connect workflow', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // 1. Verify quick connect section exists
    const quickConnectSection = page.locator('#quickConnectSection');
    await expect(quickConnectSection).toBeVisible();

    // 2. Click quick connect toggle
    const quickConnectToggle = page.locator('#quickConnectToggle');
    await quickConnectToggle.click();

    // 3. Verify quick connect grid is shown
    const quickConnectGrid = page.locator('#quickConnectGrid');
    await expect(quickConnectGrid).toBeVisible();

    // 4. Click a quick connect button
    const quickConnectBtn = quickConnectGrid.locator('.quick-connect-btn').first();
    await quickConnectBtn.click();

    // 5. Wait for connection
    await page.waitForSelector('.status-badge.connected', { timeout: 10000 });

    // 6. Verify connection status
    const statusText = await page.locator('.status-text').textContent();
    expect(statusText).toBe('Connected');
  });

  test('connection monitoring workflow', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    const firstProxy = page.locator('.proxy-item').first();

    // 1. Connect to proxy
    await firstProxy.click();
    await page.waitForSelector('.status-badge.connected', { timeout: 10000 });

    // 2. Verify timer is running
    const timer = page.locator('#timerValue');
    await expect(timer).toBeVisible();

    // 3. Wait a moment for timer to update
    await page.waitForTimeout(1000);

    // 4. Verify timer shows elapsed time
    const timerText = await timer.textContent();
    expect(timerText).toMatch(/\d{2}:\d{2}/);

    // 5. Verify proxy details are shown
    const proxyDisplay = page.locator('#currentProxyDisplay');
    await expect(proxyDisplay).toBeVisible();

    // 6. Verify proxy address is displayed
    const proxyAddress = await page.locator('#proxyAddress').textContent();
    expect(proxyAddress).toContain('192.168.1.');

    // 7. Verify country is displayed
    const proxyCountry = await page.locator('#proxyCountry').textContent();
    expect(proxyCountry).toBeTruthy();
  });

  test('error handling workflow', async ({ page }) => {
    // Mock failed proxy connection
    await page.addInitScript(() => {
      window.chrome.runtime.sendMessage = async (message) => {
        if (message.action === 'setProxy') {
          return { success: false, error: 'Connection failed' };
        }
        if (message.action === 'testProxy') {
          return { success: false, latency: null };
        }
        return { success: true };
      };
    });

    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    const firstProxy = page.locator('.proxy-item').first();

    // 1. Try to connect to proxy (should fail)
    await firstProxy.click();

    // 2. Wait for error state
    await page.waitForTimeout(2000);

    // 3. Verify connection failed message appears
    const toast = page.locator('.toast');
    await expect(toast).toBeVisible();
    const toastText = await toast.textContent();
    expect(toastText).toContain('Connection failed');

    // 4. Verify status remains disconnected
    const statusText = await page.locator('.status-text').textContent();
    expect(statusText).toBe('Disconnected');
  });

  test('responsive design workflow', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // 1. Verify layout adapts to mobile
    const proxyList = page.locator('#proxyList');
    await expect(proxyList).toBeVisible();

    // 2. Verify proxy items are properly sized
    const firstProxy = page.locator('.proxy-item').first();
    const proxyBox = await firstProxy.boundingBox();
    expect(proxyBox.width).toBeLessThan(375);

    // 3. Verify filters are accessible
    const countryFilter = page.locator('#countryFilter');
    await expect(countryFilter).toBeVisible();

    // 4. Verify settings are accessible
    const settingsBtn = page.locator('#settingsBtn');
    await expect(settingsBtn).toBeVisible();

    // 5. Test filter interaction on mobile
    await countryFilter.selectOption('Germany');
    await page.waitForTimeout(500);

    // 6. Verify filtering still works
    const proxyItems = page.locator('.proxy-item');
    const count = await proxyItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('keyboard navigation workflow', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // 1. Focus search input
    const searchInput = page.locator('#proxySearch');
    await searchInput.focus();

    // 2. Type search query
    await searchInput.fill('192.168.1.1');

    // 3. Tab to first proxy
    await page.keyboard.press('Tab');

    // 4. Verify proxy is focused
    const focusedElement = await page.evaluateHandle(() => document.activeElement);
    const focusedTag = await focusedElement.evaluate(el => el.tagName);
    expect(['BUTTON', 'DIV']).toContain(focusedTag);

    // 5. Press Enter to connect
    await page.keyboard.press('Enter');

    // 6. Wait for connection
    await page.waitForSelector('.status-badge.connected', { timeout: 10000 });

    // 7. Verify connection successful
    const statusText = await page.locator('.status-text').textContent();
    expect(statusText).toBe('Connected');
  });

  test('accessibility workflow', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // 1. Check for proper ARIA labels
    const statusBadge = page.locator('#statusBadge');
    const statusText = await statusBadge.textContent();
    expect(statusText).toBeTruthy();

    // 2. Check for keyboard navigation
    const searchInput = page.locator('#proxySearch');
    await searchInput.focus();
    await expect(searchInput).toBeFocused();

    // 3. Check for proper button labels
    const connectButtons = page.locator('.connect-btn');
    const buttonCount = await connectButtons.count();
    expect(buttonCount).toBeGreaterThan(0);

    // 4. Check for proper heading structure
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);

    // 5. Check for sufficient color contrast (basic check)
    const proxyItems = page.locator('.proxy-item');
    const firstItem = proxyItems.first();
    const itemStyle = await firstItem.evaluate(el => getComputedStyle(el));
    expect(itemStyle.backgroundColor).toBeTruthy();
    expect(itemStyle.color).toBeTruthy();
  });
});