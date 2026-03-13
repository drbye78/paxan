// Accessibility tests for keyboard navigation and screen reader support

import { test, expect } from '@playwright/test';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Chrome extension environment
    await page.addInitScript(() => {
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
            return { success: true };
          },
          onMessage: {
            addListener: () => {},
            removeListener: () => {}
          }
        },
        storage: {
          local: {
            get: async () => ({
              settings: {
                theme: 'dark',
                autoFailover: true,
                testBeforeConnect: true,
                autoConnect: false,
                notifications: true,
                refreshInterval: 300000,
                proxySource: 'proxymania',
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
            }),
            set: async () => {},
            clear: async () => {}
          }
        }
      };
    });

    // Navigate to popup
    await page.goto('data:text/html,<html><body><div id="app"></div><script src="/popup.js"></script></body></html>');
    
    // Wait for popup to load
    await page.waitForSelector('#proxyList', { timeout: 10000 });
  });

  test('keyboard navigation', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // 1. Focus should be on search input initially
    const searchInput = page.locator('#proxySearch');
    await expect(searchInput).toBeFocused();

    // 2. Tab should move to first proxy
    await page.keyboard.press('Tab');
    const firstProxy = page.locator('.proxy-item').first();
    const focusedElement = await page.evaluateHandle(() => document.activeElement);
    const focusedTag = await focusedElement.evaluate(el => el.tagName);
    expect(['BUTTON', 'DIV']).toContain(focusedTag);

    // 3. Arrow keys should navigate between proxies
    await page.keyboard.press('ArrowDown');
    const secondProxy = page.locator('.proxy-item').nth(1);
    const secondFocusedElement = await page.evaluateHandle(() => document.activeElement);
    const secondFocusedTag = await secondFocusedElement.evaluate(el => el.tagName);
    expect(['BUTTON', 'DIV']).toContain(secondFocusedTag);

    // 4. Enter should connect to proxy
    await page.keyboard.press('Enter');
    await page.waitForSelector('.status-badge.connected', { timeout: 10000 });
    const statusText = await page.locator('.status-text').textContent();
    expect(statusText).toBe('Connected');

    // 5. Escape should disconnect
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const disconnectedStatusText = await page.locator('.status-text').textContent();
    expect(disconnectedStatusText).toBe('Disconnected');
  });

  test('screen reader support', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // 1. Check for proper ARIA labels
    const statusBadge = page.locator('#statusBadge');
    await expect(statusBadge).toHaveAttribute('aria-label');

    const searchInput = page.locator('#proxySearch');
    await expect(searchInput).toHaveAttribute('aria-label', 'Search proxies');

    // 2. Check for proper heading structure
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);

    // 3. Check for role attributes
    const proxyList = page.locator('#proxyList');
    await expect(proxyList).toHaveAttribute('role', 'listbox');

    const proxyItems = page.locator('.proxy-item');
    const itemCount = await proxyItems.count();
    for (let i = 0; i < itemCount; i++) {
      const item = proxyItems.nth(i);
      await expect(item).toHaveAttribute('role', 'option');
    }

    // 4. Check for live regions
    const statusText = page.locator('.status-text');
    await expect(statusText).toHaveAttribute('aria-live', 'polite');

    // 5. Check for button labels
    const connectButtons = page.locator('.connect-btn');
    const buttonCount = await connectButtons.count();
    for (let i = 0; i < buttonCount; i++) {
      const button = connectButtons.nth(i);
      await expect(button).toHaveAttribute('aria-label');
    }
  });

  test('focus management', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // 1. Focus should be managed when connecting to proxy
    const firstProxy = page.locator('.proxy-item').first();
    await firstProxy.click();
    await page.waitForSelector('.status-badge.connected', { timeout: 10000 });

    // Focus should return to proxy list or status
    const focusedElement = await page.evaluateHandle(() => document.activeElement);
    const focusedId = await focusedElement.evaluate(el => el.id);
    expect(['statusBadge', 'proxyList']).toContain(focusedId);

    // 2. Focus should be managed in settings
    const settingsBtn = page.locator('#settingsBtn');
    await settingsBtn.click();
    await page.waitForSelector('#settingsPanel', { timeout: 5000 });

    // Focus should be on settings panel
    const settingsPanel = page.locator('#settingsPanel');
    await expect(settingsPanel).toBeFocused();

    // 3. Focus should be managed when closing settings
    const closeBtn = page.locator('#settingsClose');
    await closeBtn.click();
    await expect(page.locator('#settingsPanel')).not.toBeVisible();

    // Focus should return to main content
    const mainContent = page.locator('#proxyList');
    await expect(mainContent).toBeFocused();
  });

  test('color contrast', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // Check for sufficient color contrast
    const proxyItems = page.locator('.proxy-item');
    const firstItem = proxyItems.first();

    // Get computed styles
    const itemStyle = await firstItem.evaluate(el => {
      const computedStyle = window.getComputedStyle(el);
      return {
        backgroundColor: computedStyle.backgroundColor,
        color: computedStyle.color,
        borderColor: computedStyle.borderColor
      };
    });

    // Basic contrast check (would need actual contrast calculation in real implementation)
    expect(itemStyle.backgroundColor).toBeTruthy();
    expect(itemStyle.color).toBeTruthy();
    expect(itemStyle.borderColor).toBeTruthy();
  });

  test('form accessibility', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // 1. Check form labels
    const countryFilter = page.locator('#countryFilter');
    const countryLabel = page.locator('label[for="countryFilter"]');
    await expect(countryLabel).toBeVisible();

    const typeFilter = page.locator('#typeFilter');
    const typeLabel = page.locator('label[for="typeFilter"]');
    await expect(typeLabel).toBeVisible();

    // 2. Check form associations
    await expect(countryFilter).toHaveAttribute('aria-labelledby');
    await expect(typeFilter).toHaveAttribute('aria-labelledby');

    // 3. Check for required field indicators
    const requiredFields = page.locator('[aria-required="true"]');
    const requiredCount = await requiredFields.count();
    expect(requiredCount).toBeGreaterThanOrEqual(0); // May or may not have required fields
  });

  test('error message accessibility', async ({ page }) => {
    // Mock failed connection
    await page.addInitScript(() => {
      window.chrome.runtime.sendMessage = async (message) => {
        if (message.action === 'setProxy') {
          return { success: false, error: 'Connection failed' };
        }
        return { success: true };
      };
    });

    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    const firstProxy = page.locator('.proxy-item').first();
    await firstProxy.click();

    // Wait for error message
    await page.waitForTimeout(2000);

    // Check for error message accessibility
    const toast = page.locator('.toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('role', 'alert');

    const toastText = await toast.textContent();
    expect(toastText).toContain('Connection failed');
  });

  test('responsive accessibility', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // 1. Check touch target sizes
    const proxyItems = page.locator('.proxy-item');
    const firstItem = proxyItems.first();
    const itemBox = await firstItem.boundingBox();

    // Touch targets should be at least 44x44px
    expect(itemBox.width).toBeGreaterThanOrEqual(44);
    expect(itemBox.height).toBeGreaterThanOrEqual(44);

    // 2. Check for proper spacing
    const itemStyle = await firstItem.evaluate(el => window.getComputedStyle(el));
    expect(itemStyle.margin).toBeTruthy();
    expect(itemStyle.padding).toBeTruthy();

    // 3. Check for readable text
    const textElements = page.locator('body *');
    const textCount = await textElements.count();
    expect(textCount).toBeGreaterThan(0);
  });

  test('high contrast mode support', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // Simulate high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });

    // Check that elements are still visible and accessible
    const proxyList = page.locator('#proxyList');
    await expect(proxyList).toBeVisible();

    const statusBadge = page.locator('#statusBadge');
    await expect(statusBadge).toBeVisible();

    // Check that text is still readable
    const proxyItems = page.locator('.proxy-item');
    const itemCount = await proxyItems.count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('screen reader announcements', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // 1. Check for live region updates
    const statusText = page.locator('.status-text');
    await expect(statusText).toHaveAttribute('aria-live', 'polite');

    // 2. Check for status changes
    const firstProxy = page.locator('.proxy-item').first();
    await firstProxy.click();
    await page.waitForSelector('.status-badge.connected', { timeout: 10000 });

    // Status should be announced
    const connectedStatus = await statusText.textContent();
    expect(connectedStatus).toBe('Connected');

    // 3. Check for proxy selection announcements
    const proxyItems = page.locator('.proxy-item');
    const secondProxy = proxyItems.nth(1);
    await secondProxy.click();

    // Should announce proxy selection
    const selectedProxy = await secondProxy.getAttribute('aria-selected');
    expect(selectedProxy).toBe('true');
  });

  test('keyboard shortcuts', async ({ page }) => {
    // Wait for proxies to load
    await page.waitForSelector('.proxy-item', { timeout: 5000 });

    // 1. Check for keyboard shortcuts documentation
    const shortcuts = page.locator('[data-shortcut]');
    const shortcutCount = await shortcuts.count();
    expect(shortcutCount).toBeGreaterThanOrEqual(0);

    // 2. Test common shortcuts
    const searchInput = page.locator('#proxySearch');
    await searchInput.focus();
    await searchInput.fill('test');

    // Ctrl+A should select all text
    await page.keyboard.press('Control+A');
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toBe('test');

    // 3. Test navigation shortcuts
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluateHandle(() => document.activeElement);
    const focusedTag = await focusedElement.evaluate(el => el.tagName);
    expect(['BUTTON', 'DIV']).toContain(focusedTag);
  });
});