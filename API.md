# API Documentation - ProxyMania VPN

Complete API reference for the ProxyMania VPN Chrome extension.

## Table of Contents

1. [Overview](#overview)
2. [Message API](#message-api)
3. [Storage API](#storage-api)
4. [Proxy API](#proxy-api)
5. [Data Types](#data-types)
6. [Error Handling](#error-handling)

---

## Overview

This extension uses Chrome's extension APIs for communication between components:

- **popup.js** - UI layer (runs in popup context)
- **background.js** - Service worker (runs in background context)

Communication happens via `chrome.runtime.sendMessage()`.

---

## Message API

### Message Protocol

All messages follow this pattern:

```javascript
// Send message
chrome.runtime.sendMessage({
  action: 'actionName',
  // ... additional parameters
})

// Receive response
.then(response => {
  if (response.success) {
    // Handle success
  } else {
    // Handle error
  }
})
```

---

### fetchProxies

Fetches the latest proxy list from configured source (ProxyMania or ProxyScrape).

**Direction:** popup.js → background.js

**Request:**
```javascript
{
  action: 'fetchProxies'
}
```

**Response (Success):**
```javascript
{
  proxies: [
    {
      ip: "192.168.1.1",
      port: 8080,
      ipPort: "192.168.1.1:8080",
      country: "Germany",
      type: "HTTPS",
      speed: "45 ms",
      lastCheck: "Recently",
      speedMs: 45
    },
    // ... more proxies (100-500)
  ]
}
```

**Note:** The source is determined by `settings.proxySource` ('proxymania' or 'proxyscrape'). ProxyMania fetches multiple pages (up to 5), ProxyScrape uses CSV API.

**Response (Error):**
```javascript
{
  success: false,
  error: "Failed to fetch proxies: Network error"
}
```

**Example Usage:**
```javascript
const response = await chrome.runtime.sendMessage({ 
  action: 'fetchProxies' 
});
console.log(`Loaded ${response.proxies.length} proxies`);
```

---

### setProxy

Configures Chrome to use the specified proxy.

**Direction:** popup.js → background.js

**Request:**
```javascript
{
  action: 'setProxy',
  proxy: {
    ip: "192.168.1.1",
    port: 8080,
    ipPort: "192.168.1.1:8080",
    country: "Germany",
    type: "HTTPS"
  }
}
```

**Response (Success):**
```javascript
{
  success: true
}
```

**Response (Error):**
```javascript
{
  success: false,
  error: "Failed to set proxy: Permission denied"
}
```

**Example Usage:**
```javascript
const result = await chrome.runtime.sendMessage({
  action: 'setProxy',
  proxy: selectedProxy
});
if (result.success) {
  console.log('Connected to proxy');
}
```

---

### clearProxy

Removes proxy configuration, restoring direct connection.

**Direction:** popup.js → background.js

**Request:**
```javascript
{
  action: 'clearProxy'
}
```

**Response (Success):**
```javascript
{
  success: true
}
```

**Response (Error):**
```javascript
{
  success: false,
  error: "Failed to clear proxy"
}
```

**Example Usage:**
```javascript
await chrome.runtime.sendMessage({ action: 'clearProxy' });
console.log('Proxy disconnected');
```

---

### getProxy

Retrieves current proxy configuration from Chrome.

**Direction:** popup.js → background.js

**Request:**
```javascript
{
  action: 'getProxy'
}
```

**Response (Success):**
```javascript
{
  mode: "fixed_servers",
  rules: {
    singleProxy: {
      scheme: "http",
      host: "192.168.1.1",
      port: 8080
    }
  }
}
```

**Response (No Proxy):**
```javascript
{
  mode: "system"
}
```

**Example Usage:**
```javascript
const config = await chrome.runtime.sendMessage({ 
  action: 'getProxy' 
});
console.log(`Current mode: ${config.mode}`);
```

---

### testProxy

Tests proxy health based on last verification time.

**Direction:** popup.js → background.js

**Request:**
```javascript
{
  action: 'testProxy',
  proxy: {
    ip: "192.168.1.1",
    port: 8080,
    lastCheck: "Recently",
    speedMs: 45
  }
}
```

**Response:**
```javascript
{
  success: true,
  working: true,
  latency: 45
}
```

**Example Usage:**
```javascript
const test = await chrome.runtime.sendMessage({
  action: 'testProxy',
  proxy: selectedProxy
});
console.log(`Proxy working: ${test.working}`);
```

---

## Storage API

### Storage Schema

The extension uses `chrome.storage.local` for persistence.

```typescript
interface StorageData {
  // Settings
  settings: {
    theme: 'dark' | 'light' | 'auto';
    autoFailover: boolean;
    testBeforeConnect: boolean;
    autoConnect: boolean;
    notifications: boolean;
    refreshInterval: number;      // milliseconds
    proxySource: 'proxymania' | 'proxyscrape';
    countryBlacklist: string[];   // excluded countries
  };
  
  // Currently active proxy
  activeProxy: Proxy | null;
  connectionStartTime: number;
  
  // Cached proxy list
  proxies: Proxy[];
  proxiesTimestamp: number;
  
  // Proxy statistics (historical)
  proxyStats: {
    [ipPort: string]: {
      attempts: number;
      successes: number;
      failures: number;
      latencies: number[];
      successRate: number;
      avgLatency: number;
      lastSuccess: number;
      lastFailure: number;
    }
  };
  
  // Favorites
  favorites: Proxy[];
  
  // Recently used
  recentlyUsed: Array<{ proxy: Proxy; lastUsed: number }>;
}
```

---

### settings

User preferences and configuration.

**Type:** `Object`

**Keys:**
- `theme`: 'dark' | 'light' | 'auto'
- `autoFailover`: boolean
- `testBeforeConnect`: boolean
- `autoConnect`: boolean
- `notifications`: boolean
- `refreshInterval`: number (milliseconds)
- `proxySource`: 'proxymania' | 'proxyscrape'
- `countryBlacklist`: string[]

**Example:**
```javascript
await chrome.storage.local.set({
  settings: {
    theme: 'dark',
    proxySource: 'proxyscrape',
    countryBlacklist: ['Russia', 'China']
  }
});
```

---

### activeProxy

Currently connected proxy configuration.

**Type:** `Proxy | null`

**Set:**
```javascript
await chrome.storage.local.set({ 
  activeProxy: proxyObject 
});
```

**Get:**
```javascript
const { activeProxy } = await chrome.storage.local.get(['activeProxy']);
```

**Clear:**
```javascript
await chrome.storage.local.remove(['activeProxy']);
```

---

### proxies

Cached list of available proxies.

**Type:** `Proxy[]`

**Set:**
```javascript
await chrome.storage.local.set({ 
  proxies: proxyArray 
});
```

**Get:**
```javascript
const { proxies } = await chrome.storage.local.get(['proxies']);
```

**Clear:**
```javascript
await chrome.storage.local.remove(['proxies']);
```

---

### proxiesTimestamp

Unix timestamp (milliseconds) of when proxies were cached.

**Type:** `number`

**Set:**
```javascript
await chrome.storage.local.set({ 
  proxiesTimestamp: Date.now() 
});
```

**Get:**
```javascript
const { proxiesTimestamp } = await chrome.storage.local.get(['proxiesTimestamp']);
```

**Check Cache Age:**
```javascript
const { proxiesTimestamp } = await chrome.storage.local.get(['proxiesTimestamp']);
const age = Date.now() - proxiesTimestamp;
const isFresh = age < 300000; // 5 minutes
```

---

## Proxy API

### Chrome Proxy Configuration

The extension uses `chrome.proxy.settings` API.

**Set Proxy:**
```javascript
const config = {
  mode: 'fixed_servers',
  rules: {
    singleProxy: {
      scheme: 'http',  // or 'socks5'
      host: '192.168.1.1',
      port: 8080
    },
    bypassList: [
      'localhost',
      '127.0.0.1',
      '::1',
      '*.local',
      '192.168.*',
      '10.*',
      '172.16.*',
      '172.17.*',
      '172.18.*',
      '172.19.*',
      '172.20.*',
      '172.21.*',
      '172.22.*',
      '172.23.*',
      '172.24.*',
      '172.25.*',
      '172.26.*',
      '172.27.*',
      '172.28.*',
      '172.29.*',
      '172.30.*',
      '172.31.*'
    ]
  }
};

chrome.proxy.settings.set({ 
  value: config, 
  scope: 'regular' 
}, callback);
```

**Clear Proxy:**
```javascript
chrome.proxy.settings.clear({ 
  scope: 'regular' 
}, callback);
```

**Get Proxy:**
```javascript
chrome.proxy.settings.get({ 
  scope: 'regular' 
}, callback);
```

---

## Data Types

### Proxy

Complete proxy object structure.

```typescript
interface Proxy {
  // Network information
  ip: string;           // IP address (e.g., "192.168.1.1")
  port: number;        // Port number (e.g., 8080)
  ipPort: string;      // Combined format (e.g., "192.168.1.1:8080")
  
  // Location
  country: string;     // Country name (e.g., "Germany")
  
  // Protocol
  type: 'HTTPS' | 'SOCKS5' | 'SOCKS4';
  
  // Performance
  speed: string;       // Display format (e.g., "45 ms")
  speedMs: number;     // Numeric value for sorting (e.g., 45)
  
  // Verification
  lastCheck: string;  // Time since last check (e.g., "Recently")
  
  // Optional: Historical data (added from cache merge)
  historicalSuccessRate?: number;
  historicalAvgLatency?: number;
  historicalAttempts?: number;
  historicalBonus?: number;
}
```

### ProxyStats

Historical statistics for a proxy.

```typescript
interface ProxyStats {
  attempts: number;       // Total connection attempts
  successes: number;     // Successful connections
  failures: number;      // Failed connections
  latencies: number[];  // Last 20 latency measurements
  successRate: number;  // Percentage (0-100)
  avgLatency: number;   // Average of latencies
  lastSuccess: number;  // Timestamp of last success
  lastFailure: number;  // Timestamp of last failure
}
```

### ProxyConfig

Chrome proxy configuration object.

```typescript
interface ProxyConfig {
  mode: 'fixed_servers' | 'system' | 'pac_script';
  rules: {
    singleProxy?: {
      scheme: 'http' | 'https' | 'socks4' | 'socks5';
      host: string;
      port: number;
    };
    bypassList?: string[];
    proxyForHttp?: {
      scheme: string;
      host: string;
      port: number;
    };
  };
  pacScript?: {
    url?: string;
    data?: string;
    mandatory?: boolean;
  };
}
```

### MessageResponse

Standard response format for messages.

```typescript
interface MessageResponse {
  success?: boolean;
  proxies?: Proxy[];
  proxy?: ProxyConfig;
  error?: string;
  working?: boolean;
  latency?: number;
}
```

---

## Error Handling

### Error Types

| Error | Cause | Solution |
|-------|-------|----------|
| `Failed to fetch proxies` | Network error or ProxyMania down | Retry later |
| `Failed to set proxy` | Permission issue | Check extension permissions |
| `Failed to clear proxy` | Chrome API error | Reload extension |
| `Network error` | No internet connection | Check connectivity |

### Error Handling Pattern

```javascript
try {
  const response = await chrome.runtime.sendMessage({
    action: 'setProxy',
    proxy: proxy
  });
  
  if (!response.success) {
    throw new Error(response.error);
  }
  
  // Success handling
} catch (error) {
  console.error('Proxy operation failed:', error);
  alert('Failed to connect: ' + error.message);
}
```

### Background Script Error Handling

```javascript
async function setProxy(proxy) {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.set(
      { value: proxyConfig, scope: 'regular' },
      (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      }
    );
  });
}
```

---

## Proxy Sources

### Supported Sources

| Source | URL | Format | Proxy Count |
|--------|-----|--------|-------------|
| ProxyMania | `proxymania.su/free-proxy` | HTML (multiple pages) | 100-300 |
| ProxyScrape | `api.proxyscrape.com` | CSV | 100-500 |

### fetchProxies (with source selection)

The main fetch function checks settings and routes to the appropriate source:

```javascript
async function fetchProxies() {
  const result = await chrome.storage.local.get(['settings']);
  const proxySource = result.settings?.proxySource || 'proxymania';
  
  switch (proxySource) {
    case 'proxyscrape':
      return await fetchProxyScrape();
    case 'proxymania':
    default:
      return await fetchProxyMania();
  }
}
```

### ProxyMania Fetcher

Fetches multiple pages (up to 5):

```javascript
async function fetchProxyMania() {
  const allProxies = [];
  for (let page = 1; page <= 5; page++) {
    const url = page === 1 
      ? 'https://proxymania.su/free-proxy' 
      : `https://proxymania.su/free-proxy?page=${page}`;
    // ... fetch and parse
  }
  return allProxies;
}
```

### ProxyScrape Fetcher

Uses the free API endpoint:

```javascript
async function fetchProxyScrape() {
  const url = 'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&format=csv';
  const response = await fetch(url);
  const csvText = await response.text();
  return parseProxyScrapeCSV(csvText);
}
```

---

## Utility Functions

### parseSpeed

Extracts numeric speed from string.

**Location:** background.js, popup.js

```javascript
function parseSpeed(speedStr) {
  const match = speedStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 9999;
}

// Usage
const speedMs = parseSpeed("45 ms");  // Returns: 45
```

### getWorkingStatus

Determines proxy health status.

**Location:** popup.js

```javascript
function getWorkingStatus(proxy) {
  if (!proxy.lastCheck) return 'unknown';
  
  const lastCheck = proxy.lastCheck.toLowerCase();
  const recentlyChecked = 
    lastCheck.includes('recent') || 
    lastCheck.includes('just now') ||
    lastCheck.includes('minute');
  
  return recentlyChecked ? 'good' : 'warning';
}
```

### parseProxies

Parses HTML to extract proxy list.

**Location:** background.js

```javascript
function parseProxies(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const proxyItems = [];
  
  const table = doc.querySelector('table');
  if (!table) return proxyItems;
  
  const rows = table.querySelectorAll('tbody tr');
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 6) {
      const ipPort = cells[0].textContent.trim();
      const [ip, port] = ipPort.split(':');
      
      if (ip && port && !isNaN(parseInt(port))) {
        proxyItems.push({
          ip,
          port: parseInt(port),
          ipPort,
          country: cells[1].textContent.trim(),
          type: cells[2].textContent.trim(),
          anonymity: cells[3].textContent.trim(),
          speed: cells[4].textContent.trim(),
          lastCheck: cells[5].textContent.trim(),
          speedMs: parseSpeed(cells[4].textContent.trim())
        });
      }
    }
  });
  
  return proxyItems;
}
```

---

## Events

### DOM Events

| Event | Element | Handler |
|-------|---------|---------|
| `DOMContentLoaded` | document | Initialize extension |
| `click` | #refreshBtn | loadProxies() |
| `click` | #disconnectBtn | disconnectProxy() |
| `change` | #countryFilter | filterProxies() |
| `change` | #typeFilter | filterProxies() |
| `click` | .connect-btn | connectToProxy() |

### Chrome Events

| Event | Listener | Purpose |
|-------|----------|---------|
| `chrome.runtime.onMessage` | background.js | Handle popup messages |
| `chrome.runtime.onStartup` | background.js | Restore proxy on startup |
| `chrome.runtime.onInstalled` | background.js | Handle install/update |

---

## Examples

### Complete Connection Flow

```javascript
// 1. Load proxies
const { proxies } = await chrome.runtime.sendMessage({ 
  action: 'fetchProxies' 
});

// 2. Cache proxies
await chrome.storage.local.set({ 
  proxies, 
  proxiesTimestamp: Date.now() 
});

// 3. Select fastest proxy
const fastest = proxies.sort((a, b) => a.speedMs - b.speedMs)[0];

// 4. Test proxy
const test = await chrome.runtime.sendMessage({
  action: 'testProxy',
  proxy: fastest
});

// 5. Connect
await chrome.runtime.sendMessage({
  action: 'setProxy',
  proxy: fastest
});

// 6. Save as active
await chrome.storage.local.set({ activeProxy: fastest });

console.log(`Connected to ${fastest.ipPort}`);
```

### Complete Disconnection Flow

```javascript
// 1. Clear Chrome proxy
await chrome.runtime.sendMessage({ action: 'clearProxy' });

// 2. Clear active proxy storage
await chrome.storage.local.remove(['activeProxy']);

console.log('Disconnected');
```

---

## Reference Links

- [Chrome Runtime API](https://developer.chrome.com/docs/extensions/reference/runtime/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Chrome Proxy API](https://developer.chrome.com/docs/extensions/reference/proxy/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
