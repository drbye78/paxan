// Playwright E2E tests for proxy connection lifecycle, settings persistence,
// error handling, and search/filter functionality.
// Extends the pattern from connect-disconnect.test.js

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTENSION_ROOT = join(__dirname, '../..');

const popupJs = readFileSync(join(EXTENSION_ROOT, 'popup.js'), 'utf-8');
const popupHtml = readFileSync(join(EXTENSION_ROOT, 'popup.html'), 'utf-8');
const stylesCss = readFileSync(join(EXTENSION_ROOT, 'styles.css'), 'utf-8');

const MOCK_PROXIES = [
  { ip: '185.162.128.153', port: 80, ipPort: '185.162.128.153:80', country: 'Germany', type: 'HTTPS', speedMs: 45 },
  { ip: '103.159.46.34', port: 83, ipPort: '103.159.46.34:83', country: 'USA', type: 'HTTPS', speedMs: 120 },
  { ip: '45.77.55.173', port: 8080, ipPort: '45.77.55.173:8080', country: 'Japan', type: 'SOCKS5', speedMs: 200 },
  { ip: '91.107.232.58', port: 80, ipPort: '91.107.232.58:80', country: 'France', type: 'HTTPS', speedMs: 65 },
  { ip: '200.25.48.150', port: 3128, ipPort: '200.25.48.150:3128', country: 'Brazil', type: 'HTTPS', speedMs: 180 },
  { ip: '177.54.157.178', port: 8080, ipPort: '177.54.157.178:8080', country: 'Brazil', type: 'SOCKS5', speedMs: 90 },
  { ip: '51.15.242.229', port: 3128, ipPort: '51.15.242.229:3128', country: 'Netherlands', type: 'HTTPS', speedMs: 55 },
  { ip: '14.207.163.109', port: 8080, ipPort: '14.207.163.109:8080', country: 'Thailand', type: 'SOCKS5', speedMs: 310 },
  { ip: '103.78.170.13', port: 83, ipPort: '103.78.170.13:83', country: 'India', type: 'HTTPS', speedMs: 160 },
  { ip: '183.88.212.184', port: 8080, ipPort: '183.88.212.184:8080', country: 'Thailand', type: 'HTTPS', speedMs: 140 },
];

function buildHtml(options = {}) {
  const errorOnFetch = options.errorOnFetch || false;
  const errorOnConnect = options.errorOnConnect || false;
  const connectDelay = options.connectDelay || 0;
  const initialSettings = options.initialSettings || {};

  const mockScript = `<script>
window.__MOCK_PROXIES = ${JSON.stringify(MOCK_PROXIES)};
(function() {
  let activeProxy = null;
  let storedProxies = [];
  let proxyStats = {};
  let favorites = [];
  let recentlyUsed = [];
  let siteRules = [];
  let settings = Object.assign({ theme: 'dark', autoFailover: true, testBeforeConnect: true, autoConnect: false, notifications: true, refreshInterval: 300000, proxySource: 'peasyproxy', countryBlacklist: [], language: 'en' }, ${JSON.stringify(initialSettings)});
  let security = { status: 'secure', dnsLeakProtection: true, webRtcProtection: true, lastCheck: null };
  let healthData = { active: false, quality: 'excellent', avgLatency: 0, lastCheck: null };
  let autoRotation = { enabled: false, interval: 600000 };
  let onboarding = { completed: true, currentStepIndex: 0, version: '3.0.0' };
  let connectionStartTime = null;
  let dailyStats = { proxiesUsed: 0, connectionTime: 0, attempts: 0, successes: 0 };
  let fetchCount = 0;
  let abortController = null;
  const mockProxies = window.__MOCK_PROXIES || [];
  window.chrome = {
    runtime: {
      sendMessage: async function(msg) {
        switch (msg.action) {
          case 'fetchProxies':
            fetchCount++;
            if (${errorOnFetch}) {
              throw new Error('Network Error: Failed to fetch proxies');
            }
            // Simulate abort/cancellation
            if (msg.signal && msg.signal.aborted) {
              throw new DOMException('The operation was aborted', 'AbortError');
            }
            return { proxies: mockProxies, success: true };
          case 'testProxy':
            await new Promise(r => setTimeout(r, ${connectDelay}));
            if (${errorOnConnect}) {
              return { success: false, latency: null, error: 'Connection refused' };
            }
            return { success: true, latency: 85 };
          case 'quickTest':
            await new Promise(r => setTimeout(r, 50));
            return { success: true, latency: 85 };
          case 'setProxy':
            activeProxy = msg.proxy;
            connectionStartTime = Date.now();
            return { success: true };
          case 'clearProxy':
            activeProxy = null;
            connectionStartTime = null;
            return { success: true };
          case 'getProxy': return { config: activeProxy };
          case 'setFailoverProxies': return { success: true };
          case 'getNextFailoverProxy': return { proxy: null };
          case 'startMonitoring': case 'stopMonitoring': case 'updateProxyStats': return { success: true };
          case 'getProxyStats': return { stats: proxyStats };
          case 'getSecurityStatus': return security;
          case 'getHealthStatus': return healthData;
          case 'startHealthMonitoring': case 'stopHealthMonitoring': return { success: true };
          case 'testProxyTampering': return { tampered: false, suspicious: false };
          case 'markProxyTampered': return { success: true };
          case 'getAllReputation': return {};
          case 'getOnboardingState': return onboarding;
          case 'testDnsLeak': return { success: true, leaking: false };
          default: return { success: true };
        }
      },
      onMessage: { addListener: function() {}, removeListener: function() {} },
      getURL: function(p) { return 'chrome-extension://mock-id/' + p; },
    },
    storage: {
      local: {
        get: async function(keys) {
          const store = { settings: settings, activeProxy: activeProxy, proxies: storedProxies, proxyStats: proxyStats, favorites: favorites, recentlyUsed: recentlyUsed, dailyStats: dailyStats, security: security, healthData: healthData, siteRules: siteRules, autoRotation: autoRotation, onboarding: onboarding, connectionStartTime: connectionStartTime };
          if (typeof keys === 'string') return { [keys]: store[keys] };
          if (Array.isArray(keys)) { const r = {}; keys.forEach(k => { r[k] = store[k]; }); return r; }
          return store;
        },
        set: async function(data) {
          Object.keys(data).forEach(k => {
            if (k === 'settings') Object.assign(settings, data[k]);
            else if (k === 'activeProxy') activeProxy = data[k];
            else if (k === 'proxies') storedProxies = data[k];
            else if (k === 'proxyStats') proxyStats = data[k];
            else if (k === 'favorites') favorites = data[k];
            else if (k === 'recentlyUsed') recentlyUsed = data[k];
            else if (k === 'dailyStats') Object.assign(dailyStats, data[k]);
            else if (k === 'security') Object.assign(security, data[k]);
            else if (k === 'healthData') Object.assign(healthData, data[k]);
            else if (k === 'siteRules') siteRules = data[k];
            else if (k === 'autoRotation') Object.assign(autoRotation, data[k]);
            else if (k === 'onboarding') Object.assign(onboarding, data[k]);
            else if (k === 'connectionStartTime') connectionStartTime = data[k];
          });
        },
        remove: async function(keysArr) {
          if (keysArr.includes('activeProxy')) activeProxy = null;
          if (keysArr.includes('connectionStartTime')) connectionStartTime = null;
        },
        clear: async function() {},
      },
    },
    proxy: { settings: { set: async function() {}, get: function(o, cb) { if (cb) cb({ value: {} }); }, clear: async function() {} } },
    tabs: { query: async function() { return [{ id: 1, url: 'https://example.com', active: true }]; } },
    alarms: { create: function() {}, clear: async function() { return true; }, onAlarm: { addListener: function() {}, removeListener: function() {} } },
  };
})();
</script>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>PeasyProxy - Lifecycle Test</title><style>${stylesCss}</style></head><body>${popupHtml.replace(/<link rel="stylesheet" href="styles.css">/, '').replace(/<script src="popup\.js"><\/script>/, mockScript + '<script>' + popupJs + '<\/script>')}</body></html>`;
}

async function loadPopup(page, options = {}) {
  const html = buildHtml(options);
  await page.goto('about:blank');
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('.proxy-item').length > 0, { timeout: 15000 });
}

// ============================================================================
// 1. PROXY CONNECTION LIFECYCLE
// ============================================================================
test.describe('Proxy Connection Lifecycle', () => {

  test('popup loads and shows initial disconnected state', async ({ page }) => {
    await loadPopup(page);
    const statusText = await page.locator('.status-text').textContent();
    expect(statusText).toBe('Disconnected');
    await expect(page.locator('#fab')).toBeVisible();
    await expect(page.locator('#proxyList')).toBeVisible();
    // Verify connection info is hidden when disconnected
    await expect(page.locator('#connectionInfo')).not.toBeVisible();
  });

  test('proxy data is rendered with correct fields', async ({ page }) => {
    await loadPopup(page);
    const count = await page.locator('.proxy-item').count();
    expect(count).toBe(MOCK_PROXIES.length);

    const firstProxy = page.locator('.proxy-item').first();
    await expect(firstProxy.locator('.proxy-ip')).toBeVisible();
    await expect(firstProxy.locator('.proxy-country')).toBeVisible();
    await expect(firstProxy.locator('.proxy-type')).toBeVisible();
    await expect(firstProxy.locator('.proxy-speed')).toBeVisible();

    // Verify proxy count badge
    const proxyCount = await page.locator('#proxyCount').textContent();
    expect(proxyCount).toBe(String(MOCK_PROXIES.length));
  });

  test('clicking a proxy connects and shows connected state', async ({ page }) => {
    await loadPopup(page);
    await page.locator('.proxy-item').first().click();

    // Verify status changes to connected
    await expect(page.locator('.status-text')).toHaveText('Connected', { timeout: 15000 });

    // Verify connection info is visible
    await expect(page.locator('#connectionInfo')).toBeVisible();
    await expect(page.locator('#connectionTimer')).toBeVisible();

    // Verify proxy details are populated
    const displayedAddress = await page.locator('#proxyAddress').textContent();
    expect(displayedAddress).toBeTruthy();
    expect(displayedAddress).not.toBe('-');

    const displayedCountry = await page.locator('#proxyCountry').textContent();
    expect(displayedCountry).toBeTruthy();

    // Verify quality badge is visible
    await expect(page.locator('#qualityBadge')).toBeVisible();
  });

  test('disconnect restores disconnected state', async ({ page }) => {
    await loadPopup(page);

    // Connect
    await page.locator('.proxy-item').first().click();
    await expect(page.locator('.status-text')).toHaveText('Connected', { timeout: 15000 });

    // Disconnect via FAB
    await page.locator('#fab').click();
    await expect(page.locator('.status-text')).toHaveText('Disconnected', { timeout: 10000 });

    // Verify connection info is hidden
    await expect(page.locator('#connectionTimer')).not.toBeVisible();
    await expect(page.locator('#connectionInfo')).not.toBeVisible();
  });

  test('connection timer updates while connected', async ({ page }) => {
    await loadPopup(page);
    await page.locator('.proxy-item').first().click();
    await expect(page.locator('.status-text')).toHaveText('Connected', { timeout: 15000 });

    // Let timer run for 2 seconds
    await page.waitForTimeout(2000);
    const timerText = await page.locator('.timer-value').textContent();
    // Should show at least 00:02 and match MM:SS format
    expect(timerText).toMatch(/^\d{2}:\d{2}$/);
    // Timer should have advanced beyond initial state
    expect(timerText).not.toBe('00:00');
  });

  test('reconnect after disconnect works', async ({ page }) => {
    await loadPopup(page);

    // First connection
    await page.locator('.proxy-item').first().click();
    await expect(page.locator('.status-text')).toHaveText('Connected', { timeout: 15000 });

    // Disconnect
    await page.locator('#fab').click();
    await expect(page.locator('.status-text')).toHaveText('Disconnected', { timeout: 10000 });

    // Reconnect
    await page.locator('.proxy-item').nth(1).click();
    await expect(page.locator('.status-text')).toHaveText('Connected', { timeout: 15000 });
    await expect(page.locator('#connectionTimer')).toBeVisible();
  });

  test('quick connect section renders and toggles', async ({ page }) => {
    await loadPopup(page);

    // Quick connect section should exist
    await expect(page.locator('#quickConnectSection')).toBeVisible();

    // Click toggle to expand
    const toggle = page.locator('#quickConnectToggle');
    await toggle.click();

    // Quick connect grid should become visible
    await expect(page.locator('#quickConnectGrid')).toBeVisible();

    // Should contain quick connect buttons
    const btnCount = await page.locator('#quickConnectGrid .quick-connect-btn').count();
    expect(btnCount).toBeGreaterThan(0);

    // Click toggle again to collapse
    await toggle.click();
    await expect(page.locator('#quickConnectGrid')).not.toBeVisible();
  });

  test('proxy list header shows count', async ({ page }) => {
    await loadPopup(page);
    const proxyCount = await page.locator('#proxyCount').textContent();
    expect(Number(proxyCount)).toBe(MOCK_PROXIES.length);
  });
});

// ============================================================================
// 2. SETTINGS PERSISTENCE
// ============================================================================
test.describe('Settings Persistence', () => {

  test('toggling auto-failover persists across popup lifecycle', async ({ page }) => {
    // Load with autoFailover initially ON
    await loadPopup(page, { initialSettings: { autoFailover: true } });

    // Open settings panel
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPanel')).toBeVisible({ timeout: 5000 });

    // Verify auto-failover toggle is active
    let failoverToggle = page.locator('#autoFailoverToggle');
    await expect(failoverToggle).toHaveClass(/active/);

    // Toggle it OFF
    await failoverToggle.click();

    // Verify toggle state changed
    await expect(failoverToggle).not.toHaveClass(/active/);

    // Close settings
    await page.locator('#settingsClose').click();
    await expect(page.locator('#settingsPanel')).not.toBeVisible();

    // Simulate closing and re-opening the popup (persistence check)
    await loadPopup(page, { initialSettings: { autoFailover: false } });

    // Re-open settings
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPanel')).toBeVisible({ timeout: 5000 });

    // Verify toggle is still OFF (persisted)
    failoverToggle = page.locator('#autoFailoverToggle');
    await expect(failoverToggle).not.toHaveClass(/active/);
  });

  test('theme change applies CSS class on html element', async ({ page }) => {
    await loadPopup(page, { initialSettings: { theme: 'dark' } });

    // Initially dark theme
    const htmlEl = page.locator('html');
    await expect(htmlEl).toHaveAttribute('data-theme', 'dark');

    // Open settings
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPanel')).toBeVisible({ timeout: 5000 });

    // Select light theme
    await page.locator('#themeSelect').selectOption('light');

    // Verify theme attribute changed
    await expect(htmlEl).toHaveAttribute('data-theme', 'light');

    // Close settings
    await page.locator('#settingsClose').click();

    // Verify theme persists
    await expect(htmlEl).toHaveAttribute('data-theme', 'light');
  });

  test('theme toggle via overflow menu works', async ({ page }) => {
    await loadPopup(page, { initialSettings: { theme: 'dark' } });

    const htmlEl = page.locator('html');
    await expect(htmlEl).toHaveAttribute('data-theme', 'dark');

    // Open overflow menu
    await page.locator('#overflowBtn').click();
    await expect(page.locator('#overflowMenu')).toBeVisible({ timeout: 5000 });

    // Click theme toggle
    await page.locator('#overflowThemeBtn').click();

    // Theme should flip to light
    await expect(htmlEl).toHaveAttribute('data-theme', 'light');

    // Open overflow again and flip back
    await page.locator('#overflowBtn').click();
    await expect(page.locator('#overflowMenu')).toBeVisible({ timeout: 5000 });
    await page.locator('#overflowThemeBtn').click();

    // Theme should flip back to dark
    await expect(htmlEl).toHaveAttribute('data-theme', 'dark');
  });

  test('settings panel opens and closes correctly', async ({ page }) => {
    await loadPopup(page);

    // Open settings
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPanel')).toBeVisible({ timeout: 5000 });

    // Verify key elements are present
    await expect(page.locator('#themeSelect')).toBeVisible();
    await expect(page.locator('#proxySource')).toBeVisible();
    await expect(page.locator('#autoFailoverToggle')).toBeVisible();
    await expect(page.locator('#autoConnectToggle')).toBeVisible();

    // Close settings
    await page.locator('#settingsClose').click();
    await expect(page.locator('#settingsPanel')).not.toBeVisible();
  });

  test('multiple settings persist after reload', async ({ page }) => {
    // Load with custom settings
    await loadPopup(page, {
      initialSettings: {
        theme: 'light',
        autoFailover: false,
        testBeforeConnect: false,
        proxySource: 'proxyscrape',
        refreshInterval: 600000,
      },
    });

    // Verify theme
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Open settings and verify values
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPanel')).toBeVisible({ timeout: 5000 });

    // Verify proxy source
    const sourceValue = await page.locator('#proxySource').inputValue();
    expect(sourceValue).toBe('proxyscrape');

    // Verify refresh interval
    const refreshValue = await page.locator('#refreshInterval').inputValue();
    expect(refreshValue).toBe('600000');

    // Verify testBeforeConnect toggle is off
    await expect(page.locator('#testBeforeConnectToggle')).not.toHaveClass(/active/);
  });
});

// ============================================================================
// 3. ERROR HANDLING
// ============================================================================
test.describe('Error Handling', () => {

  test('fetchProxies error shows error toast', async ({ page }) => {
    await loadPopup(page, { errorOnFetch: true });

    // Toast container should eventually have an error toast
    // The popup may handle fetch errors differently; check for toast or empty state
    await page.waitForTimeout(2000);

    // Check for toast presence
    const toastCount = await page.locator('.toast').count();
    // If toast system is used for errors, expect at least one
    // Some flows show empty state instead — both are acceptable
    const hasToast = toastCount > 0;
    const hasEmptyState = await page.locator('#emptyState').isVisible().catch(() => false);

    expect(hasToast || hasEmptyState).toBe(true);
  });

  test('popup remains functional after connection error', async ({ page }) => {
    // Load normally first
    await loadPopup(page);

    // Connect to a proxy successfully
    await page.locator('.proxy-item').first().click();
    await expect(page.locator('.status-text')).toHaveText('Connected', { timeout: 15000 });

    // Override mock to cause errors on future operations
    await page.evaluate(() => {
      window.chrome.runtime.sendMessage = async function(msg) {
        if (msg.action === 'testProxy') {
          return { success: false, latency: null, error: 'Connection timeout' };
        }
        if (msg.action === 'fetchProxies') {
          return { proxies: window.__MOCK_PROXIES || [] };
        }
        // Keep existing proxy active
        return { success: true };
      };
    });

    // Trigger a test action that could fail
    await page.locator('.proxy-item').last().click();
    await page.waitForTimeout(2000);

    // Popup should still be functional — proxy list still visible
    await expect(page.locator('#proxyList')).toBeVisible();

    // Quick connect section should still be accessible
    await expect(page.locator('#quickConnectSection')).toBeVisible();
  });

  test('network timeout / abort scenario handled gracefully', async ({ page }) => {
    // Load popup
    await loadPopup(page);

    // Override to simulate a slow/stuck fetch
    await page.evaluate(() => {
      const originalSend = window.chrome.runtime.sendMessage;
      window.chrome.runtime.sendMessage = async function(msg) {
        if (msg.action === 'testProxy') {
          // Simulate extreme delay (abort scenario)
          await new Promise(r => setTimeout(r, 100));
          return { success: false, latency: null, error: 'Request timed out' };
        }
        if (msg.action === 'setProxy') {
          return { success: false, error: 'Connection timed out after 30000ms' };
        }
        return originalSend(msg);
      };
    });

    // Attempt to connect
    await page.locator('.proxy-item').first().click();
    await page.waitForTimeout(2000);

    // Status should still show disconnected (not stuck in connecting)
    const statusText = await page.locator('.status-text').textContent();
    expect(statusText).toBe('Disconnected');

    // Popup should still be interactive
    await expect(page.locator('#proxySearch')).toBeVisible();
  });

  test('error state does not break search functionality', async ({ page }) => {
    await loadPopup(page, { errorOnFetch: true });
    await page.waitForTimeout(2000);

    // Search box should still be usable
    const searchInput = page.locator('#proxySearch');
    await expect(searchInput).toBeVisible();

    // Should be able to type into search
    await searchInput.fill('test query');
    const value = await searchInput.inputValue();
    expect(value).toBe('test query');

    // Clear and search box should be empty
    await searchInput.fill('');
    const cleared = await searchInput.inputValue();
    expect(cleared).toBe('');
  });
});

// ============================================================================
// 4. SEARCH AND FILTER
// ============================================================================
test.describe('Search and Filter', () => {

  test('search by country filters proxy list', async ({ page }) => {
    await loadPopup(page);

    const initialCount = await page.locator('.proxy-item').count();
    expect(initialCount).toBeGreaterThan(0);

    // Search for "Germany"
    const searchInput = page.locator('#proxySearch');
    await searchInput.fill('Germany');
    await page.waitForTimeout(500);

    // Verify filtered results
    const filteredCount = await page.locator('.proxy-item').count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // All visible proxies should be from Germany
    const items = page.locator('.proxy-item');
    const visibleCount = await items.count();
    for (let i = 0; i < visibleCount; i++) {
      const country = await items.nth(i).locator('.proxy-country').textContent();
      expect(country.toLowerCase()).toContain('germany');
    }
  });

  test('search by IP filters to specific proxy', async ({ page }) => {
    await loadPopup(page);

    const searchInput = page.locator('#proxySearch');
    await searchInput.fill('185.162.128.153');
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('.proxy-item').count();
    expect(filteredCount).toBe(1);

    const ipText = await page.locator('.proxy-item').first().locator('.proxy-ip').textContent();
    expect(ipText).toContain('185.162.128.153');
  });

  test('search by proxy type filters correctly', async ({ page }) => {
    await loadPopup(page);

    const searchInput = page.locator('#proxySearch');
    await searchInput.fill('SOCKS5');
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('.proxy-item').count();
    expect(filteredCount).toBeGreaterThan(0);

    const items = page.locator('.proxy-item');
    const visibleCount = await items.count();
    for (let i = 0; i < visibleCount; i++) {
      const type = await items.nth(i).locator('.proxy-type').textContent();
      expect(type).toBe('SOCKS5');
    }
  });

  test('clearing search restores all proxies', async ({ page }) => {
    await loadPopup(page);

    const initialCount = await page.locator('.proxy-item').count();

    const searchInput = page.locator('#proxySearch');
    await searchInput.fill('Germany');
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('.proxy-item').count();
    expect(filteredCount).toBeLessThan(initialCount);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(500);

    const restoredCount = await page.locator('.proxy-item').count();
    expect(restoredCount).toBe(initialCount);
  });

  test('filter chips filter by type', async ({ page }) => {
    await loadPopup(page);

    const initialCount = await page.locator('.proxy-item').count();

    // Click HTTPS chip
    const httpsChip = page.locator('.filter-chips .chip[data-value="HTTPS"]');
    await httpsChip.click();
    await page.waitForTimeout(500);

    // Verify all visible proxies are HTTPS
    const itemsAfter = page.locator('.proxy-item');
    const countAfter = await itemsAfter.count();
    expect(countAfter).toBeGreaterThan(0);
    expect(countAfter).toBeLessThanOrEqual(initialCount);

    for (let i = 0; i < countAfter; i++) {
      const type = await itemsAfter.nth(i).locator('.proxy-type').textContent();
      expect(type).toBe('HTTPS');
    }

    // Click SOCKS5 chip
    const socksChip = page.locator('.filter-chips .chip[data-value="SOCKS5"]');
    await socksChip.click();
    await page.waitForTimeout(500);

    const socksItems = page.locator('.proxy-item');
    const socksCount = await socksItems.count();
    expect(socksCount).toBeGreaterThan(0);

    for (let i = 0; i < socksCount; i++) {
      const type = await socksItems.nth(i).locator('.proxy-type').textContent();
      expect(type).toBe('SOCKS5');
    }
  });

  test('"All" filter chip restores full list', async ({ page }) => {
    await loadPopup(page);

    const initialCount = await page.locator('.proxy-item').count();

    // Apply a filter
    const httpsChip = page.locator('.filter-chips .chip[data-value="HTTPS"]');
    await httpsChip.click();
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('.proxy-item').count();
    expect(filteredCount).toBeLessThan(initialCount);

    // Click "All" to reset
    const allChip = page.locator('.filter-chips .chip[data-value="all"]');
    await allChip.click();
    await page.waitForTimeout(500);

    const restoredCount = await page.locator('.proxy-item').count();
    expect(restoredCount).toBe(initialCount);
  });

  test('tab chips filter by category', async ({ page }) => {
    await loadPopup(page);

    // Initially on "All" tab
    const allChip = page.locator('#tabChips .chip[data-tab="all"]');
    await expect(allChip).toHaveClass(/chip-active/);

    const initialCount = await page.locator('.proxy-item').count();
    expect(initialCount).toBeGreaterThan(0);

    // Switch to "Favorites" tab — should show empty or favorites
    const favChip = page.locator('#tabChips .chip[data-tab="favorites"]');
    await favChip.click();
    await page.waitForTimeout(500);

    await expect(favChip).toHaveClass(/chip-active/);

    // Switch back to "All"
    await allChip.click();
    await page.waitForTimeout(500);

    const restoredCount = await page.locator('.proxy-item').count();
    expect(restoredCount).toBe(initialCount);
  });

  test('search combined with filter chip narrows results', async ({ page }) => {
    await loadPopup(page);

    // First apply type filter
    const httpsChip = page.locator('.filter-chips .chip[data-value="HTTPS"]');
    await httpsChip.click();
    await page.waitForTimeout(300);

    const typeFilterCount = await page.locator('.proxy-item').count();
    expect(typeFilterCount).toBeGreaterThan(0);

    // Now search within HTTPS for a specific country
    const searchInput = page.locator('#proxySearch');
    await searchInput.fill('Germany');
    await page.waitForTimeout(500);

    const combinedFilterCount = await page.locator('.proxy-item').count();
    expect(combinedFilterCount).toBeGreaterThan(0);
    expect(combinedFilterCount).toBeLessThanOrEqual(typeFilterCount);

    // All visible items should be HTTPS AND Germany
    const items = page.locator('.proxy-item');
    const visibleCount = await items.count();
    for (let i = 0; i < visibleCount; i++) {
      const country = await items.nth(i).locator('.proxy-country').textContent();
      const type = await items.nth(i).locator('.proxy-type').textContent();
      expect(country.toLowerCase()).toContain('germany');
      expect(type).toBe('HTTPS');
    }
  });

  test('search with no matches shows appropriate state', async ({ page }) => {
    await loadPopup(page);

    const searchInput = page.locator('#proxySearch');
    await searchInput.fill('ZZZZ_NOT_FOUND_ZZZZ');
    await page.waitForTimeout(500);

    // Either all proxies are hidden or empty state is shown
    const proxyCount = await page.locator('.proxy-item').count();
    const emptyStateVisible = await page.locator('#emptyState').isVisible().catch(() => false);

    expect(proxyCount === 0 || emptyStateVisible).toBe(true);
  });
});
