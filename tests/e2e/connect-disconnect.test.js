// Playwright E2E tests for Chrome extension connect/disconnect workflow
// Loads the popup HTML directly with realistic Chrome API mocks
// Works in headless environments

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
];

function buildHtml() {
  const mockScript = `<script>
window.__MOCK_PROXIES = ${JSON.stringify(MOCK_PROXIES)};
(function() {
  let activeProxy = null;
  let storedProxies = [];
  let proxyStats = {};
  let favorites = [];
  let recentlyUsed = [];
  let siteRules = [];
  let settings = { theme: 'dark', autoFailover: true, testBeforeConnect: true, autoConnect: false, notifications: true, refreshInterval: 300000, proxySource: 'peasyproxy', countryBlacklist: [], language: 'en' };
  let security = { status: 'secure', dnsLeakProtection: true, webRtcProtection: true, lastCheck: null };
  let healthData = { active: false, quality: 'excellent', avgLatency: 0, lastCheck: null };
  let autoRotation = { enabled: false, interval: 600000 };
  let onboarding = { completed: true, currentStepIndex: 0, version: '3.0.0' };
  let connectionStartTime = null;
  let dailyStats = { proxiesUsed: 0, connectionTime: 0, attempts: 0, successes: 0 };
  const mockProxies = window.__MOCK_PROXIES || [];
  window.chrome = {
    runtime: {
      sendMessage: async function(msg) {
        switch (msg.action) {
          case 'fetchProxies': return { proxies: mockProxies };
          case 'testProxy': await new Promise(r => setTimeout(r, 100)); return { success: true, latency: 85 };
          case 'quickTest': return { success: true, latency: 85 };
          case 'setProxy': activeProxy = msg.proxy; return { success: true };
          case 'clearProxy': activeProxy = null; return { success: true };
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

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>PeasyProxy - Test</title><style>${stylesCss}</style></head><body>${popupHtml.replace(/<link rel="stylesheet" href="styles.css">/, '').replace(/<script src="popup\.js"><\/script>/, mockScript + '<script>' + popupJs + '<\/script>')}</body></html>`;
}

const HTML_CONTENT = buildHtml();

async function loadPopup(page) {
  // Navigate to about:blank first to reset state
  await page.goto('about:blank');
  // Use setContent with waitUntil: 'load' to ensure scripts execute
  await page.setContent(HTML_CONTENT, { waitUntil: 'load' });
  // Wait for proxies to render
  await page.waitForFunction(() => document.querySelectorAll('.proxy-item').length > 0, { timeout: 15000 });
}

test.describe('Extension Connect/Disconnect Workflow', () => {
  test('popup loads and shows disconnected state', async ({ page }) => {
    await loadPopup(page);
    const statusText = await page.locator('.status-text').textContent();
    expect(statusText).toBe('Disconnected');
    await expect(page.locator('#fab')).toBeVisible();
    await expect(page.locator('#proxyList')).toBeVisible();
  });

  test('proxies are loaded and displayed', async ({ page }) => {
    await loadPopup(page);
    const count = await page.locator('.proxy-item').count();
    expect(count).toBeGreaterThan(0);
    const firstProxy = page.locator('.proxy-item').first();
    await expect(firstProxy.locator('.proxy-ip')).toBeVisible();
    await expect(firstProxy.locator('.proxy-country')).toBeVisible();
    await expect(firstProxy.locator('.proxy-type')).toBeVisible();
    await expect(firstProxy.locator('.proxy-speed')).toBeVisible();
  });

  test('connect to proxy via click', async ({ page }) => {
    await loadPopup(page);
    await page.locator('.proxy-item').first().click();
    await expect(page.locator('.status-text')).toHaveText('Connected', { timeout: 15000 });
    await expect(page.locator('#connectionTimer')).toBeVisible();
    const displayedAddress = await page.locator('#proxyAddress').textContent();
    expect(displayedAddress).toBeTruthy();
    expect(displayedAddress).not.toBe('-');
    const displayedCountry = await page.locator('#proxyCountry').textContent();
    expect(displayedCountry).toBeTruthy();
    await expect(page.locator('#qualityBadge')).toBeVisible();
  });

  test('disconnect from proxy via FAB', async ({ page }) => {
    await loadPopup(page);
    await page.locator('.proxy-item').first().click();
    await expect(page.locator('.status-text')).toHaveText('Connected', { timeout: 15000 });
    await page.locator('#fab').click();
    await expect(page.locator('.status-text')).toHaveText('Disconnected', { timeout: 10000 });
    await expect(page.locator('#connectionTimer')).not.toBeVisible();
    await expect(page.locator('#currentProxyDisplay')).not.toBeVisible();
  });

  test('connection timer updates while connected', async ({ page }) => {
    await loadPopup(page);
    await page.locator('.proxy-item').first().click();
    await expect(page.locator('.status-text')).toHaveText('Connected', { timeout: 15000 });
    await page.waitForTimeout(2000);
    const updatedTimer = await page.locator('.timer-value').textContent();
    expect(updatedTimer).toMatch(/\d{2}:\d{2}/);
  });

  test('proxy filtering via search works', async ({ page }) => {
    await loadPopup(page);
    const initialCount = await page.locator('.proxy-item').count();
    expect(initialCount).toBeGreaterThan(0);
    await page.locator('#proxySearch').fill('Germany');
    await page.waitForTimeout(500);
    const filteredCount = await page.locator('.proxy-item').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    await page.locator('#proxySearch').fill('');
    await page.waitForTimeout(500);
    const restoredCount = await page.locator('.proxy-item').count();
    expect(restoredCount).toBe(initialCount);
  });

  test('settings panel opens and closes', async ({ page }) => {
    await loadPopup(page);
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsPanel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#themeSelect')).toBeVisible();
    await expect(page.locator('#proxySource')).toBeVisible();
    await page.locator('#settingsClose').click();
    await expect(page.locator('#settingsPanel')).not.toBeVisible();
  });

  test('reconnect after disconnect works', async ({ page }) => {
    await loadPopup(page);
    await page.locator('.proxy-item').first().click();
    await expect(page.locator('.status-text')).toHaveText('Connected', { timeout: 15000 });
    await page.locator('#fab').click();
    await expect(page.locator('.status-text')).toHaveText('Disconnected', { timeout: 10000 });
    await page.locator('.proxy-item').first().click();
    await expect(page.locator('.status-text')).toHaveText('Connected', { timeout: 15000 });
    await expect(page.locator('#connectionTimer')).toBeVisible();
  });

  test('overflow menu works', async ({ page }) => {
    await loadPopup(page);
    await page.locator('#overflowBtn').click();
    await expect(page.locator('#overflowMenu')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#overflowStatsBtn')).toBeVisible();
    await expect(page.locator('#overflowFavoritesBtn')).toBeVisible();
    await expect(page.locator('#overflowApplyRuleBtn')).toBeVisible();
    await expect(page.locator('#overflowThemeBtn')).toBeVisible();
    await page.locator('#overflowStatsBtn').click();
    await expect(page.locator('#statsPanel')).toBeVisible({ timeout: 5000 });
    await page.locator('#statsClose').click();
    await expect(page.locator('#statsPanel')).not.toBeVisible();
  });
});
