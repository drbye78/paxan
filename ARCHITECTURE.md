# PeasyProxy — Architecture

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐     Messages     ┌─────────────────────────┐│
│  │  Popup UI      │◄───────────────►│  Background SW          ││
│  │  popup.html    │                  │  src/background/        ││
│  │  popup.js †    │                  │  index.js (ES module)   ││
│  │  styles.css    │                  │                         ││
│  └────────────────┘                  │  ┌───────────────────┐  ││
│        │                             │  │ ProxyConfigManager│  ││
│        │ esbuild bundle              │  │ (sole authority   │  ││
│        ▼                             │  │  for proxy API)   │  ││
│  ┌────────────────┐                  │  └───────────────────┘  ││
│  │ 13 popup       │                  │  ┌───────────────────┐  ││
│  │  modules       │                  │  │ ProxyManager      │  ││
│  │  (popup-modules)│                 │  │ ProxyFetcher      │  ││
│  └────────────────┘                  │  │ HealthMonitor     │  ││
│        │                             │  │ QualityMonitor    │  ││
│        ▼                             │  │ DnsLeakTest       │  ││
│  ┌────────────────┐                  │  │ ProxyChain        │  ││
│  │ Shared Utils   │                  │  │ PacEngine         │  ││
│  └────────────────┘                  │  │ ReputationEngine  │  ││
│                                      │  │ TamperDetector    │  ││
│  ┌────────────────┐                  │  └───────────────────┘  ││
│  │ Content Script │                  └─────────┬───────────────┘│
│  │ WebRTC Blocker │                            │                │
│  │ (modules/)     │                            │ HTTP Fetch     │
│  └────────────────┘                            ▼                │
│                          ┌────────────────────────────────────┐ │
│                          │  External Sources:                 │ │
│                          │  proxymania.su, ProxyScrape,          │ │
│                          │  httpbin.org, ipify.org,           │ │
│                          │  dnsleaktest.com, whoer.net        │ │
│                          └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

† popup.js is a build artifact — never edit directly.
  Source: src/popup-modules/ → esbuild bundle → popup.js
```

## Module Structure

```
src/
├── background/                # Service worker (native ES modules)
│   ├── index.js               # Central message router (45 action handlers)
│   ├── proxy-config-manager.js # SINGLE authority for chrome.proxy.settings
│   ├── proxy-manager.js       # setProxy/clearProxy → delegates to proxyConfig
│   ├── proxy-fetcher.js       # Fetch & parse from proxymania.su/ProxyScrape
│   ├── health-monitor.js      # Alarm-based health checks (30s interval)
│   ├── quality-monitor.js     # Latency, jitter, bandwidth, packet loss
│   ├── dns-leak-test.js       # DNS leak detection via resolver IP comparison
│   ├── proxy-chain.js         # Chain CRUD + sequential proxy testing
│   └── pac-engine.js          # PAC script parser (safe evaluator, no eval)
├── popup-modules/             # Popup UI (bundled by esbuild → popup.js)
│   ├── main.js                # Entry point — init() orchestrator
│   ├── popup.state.js         # App state + chrome.storage persistence
│   ├── popup.events.js        # DOM event listeners
│   ├── popup.connection.js    # Connect/disconnect, monitoring, failover
│   ├── popup.proxy-list.js    # Proxy filtering, scoring, rendering
│   ├── popup.ui.js            # UI rendering, toast, stats, settings
│   └── popup.{backup,onboarding,search}.js
├── popup/                     # Utilities (imported by popup-modules/)
│   ├── i18n.js                # RU/EN translations
│   └── constants.js           # Scoring weights, thresholds
├── shared/
│   └── utils.js               # Zero-dependency utilities (escapeHtml, buildProxyConfig, etc.)
├── core/
│   └── reputation-engine.js   # Trust scoring 0-100 (debounced saves)
├── security/
│   ├── tamper-detection.js     # MITM detection (uses proxyConfig.withTestConfig)
│   └── dns-protection.js      # Thin re-export from dns-leak-test.js
├── modules/
│   └── webrtc-blocker.js      # Content script — synchronous init at document_start
└── test-support/              # Test-only files (not loaded at runtime)
    ├── security.js
    └── rate-limiter.js
```

## Critical Architectural Rule

**Only `src/background/proxy-config-manager.js` may call `chrome.proxy.settings`.** It provides a serial queue with `setUserProxy`, `clearUserProxy`, `withTestConfig` (temporary test proxy → restore), and `fetchDirect` (temporarily clear proxy → restore). Every other module that needs proxy settings must go through this singleton. No direct `chrome.proxy.settings` calls exist anywhere else.

## Data Flow

1. **Proxy Fetch**: Background fetches from proxymania.su (HTML, up to 5 pages) or ProxyScrape (CSV API)
2. **Storage**: Proxies cached in `chrome.storage.local` with 5-min TTL
3. **Display**: Popup renders proxy list via direct rendering, scored and filtered
4. **Connection**: User connects → `proxyConfig.setUserProxy(proxy)` via serial queue
5. **Monitoring**: Health checks every 30s, quality checks measure latency/jitter/packet-loss
6. **Failover**: `ProxyFailoverManager` rotates through ranked proxy queue on failure
7. **DNS Leak Detection**: `captureRealIp()` via `proxyConfig.fetchDirect()` before proxy set, then resolver-IP comparison
8. **Tamper Detection**: Content inspection + header analysis against httpbin/ipify baselines

## Reputation Scoring

The reputation engine calculates a trust score (0-100) based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| Speed | 40% | Average latency (lower → higher score) |
| Reliability | 40% | Success/failure ratio |
| Trust | 10% | Tamper detection, HTTPS capability |
| Freshness | 10% | Recency of last successful test |

Scores ≥70 are Trusted, 40-69 are Unverified, <40 are Risky.

## Security Features

- **MITM Detection**: Tests proxies against httpbin/ipify endpoints; checks for script injection, header tampering
- **WebRTC Blocking**: Content script overrides `RTCPeerConnection` at `document_start` — filters host/srflx candidates
- **DNS Leak Protection**: Captures real IP pre-connection, tests DNS resolver identity
- **PAC Engine**: Safe evaluator that only interprets proxy directives — no arbitrary code execution
- **URL Rules**: Whitelist/blacklist with exact, wildcard, contains, and regex matching (ReDoS-protected)
