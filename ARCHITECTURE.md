# ProxyMania - Smart Proxy Router

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐      ┌──────────────────────────────────────┐ │
│  │  Popup UI   │◄────►│      Background Service Worker       │ │
│  │  popup.js   │      │      src/background/index.js         │ │
│  │  styles.css │      │      (ES Module)                      │ │
│  └──────────────┘      │                                       │ │
│         │              │  ┌────────────┐ ┌────────────────┐    │ │
│         │              │  │  Proxy     │ │    Health      │    │ │
│         │              │  │  Fetcher   │ │    Monitor     │    │ │
│         ▼              │  └────────────┘ └────────────────┘    │ │
│  ┌──────────────┐      │         │              │               │ │
│  │ Virtual      │      │         ▼              ▼               │ │
│  │ Scrolling    │      │  ┌──────────────────────────────┐    │ │
│  └──────────────┘      │  │     Reputation Engine        │    │ │
│         │              │  │   (Trust Scoring: 0-100)      │    │ │
│         ▼              │  └──────────────────────────────┘    │ │
│  ┌──────────────┐      │         │              │               │ │
│  │ i18n System  │      │         ▼              ▼               │ │
│  │ (RU/EN)     │      │  ┌──────────────────────────────┐    │ │
│  └──────────────┘      │  │     Tamper Detection         │    │ │
│         │              │  │   (MITM Attack Detection)    │    │ │
│         ▼              │  └──────────────────────────────┘    │ │
│  ┌──────────────┐      │         │              │               │ │
│  │ Error       │      │         ▼              ▼               │ │
│  │ Handler     │      │  ┌──────────────────────────────┐    │ │
│  └──────────────┘      │  │     Chrome Storage           │    │ │
│                        │  └──────────────────────────────┘    │ │
│  ┌──────────────┐      └──────────────────────────────────────┘ │
│  │ Content      │                        │                     │
│  │ Scripts      │                        │ HTTP Fetch           │
│  │ webrtc-     │                        ▼                      │
│  │ blocker.js   │      ┌─────────────────────────────────────┐  │
│  └──────────────┘      │   External Sources:                 │  │
│                        │   - ProxyMania (proxymania.su)      │  │
│                        │   - ProxyScrape (api.proxyscrape.com)│  │
│                        │   - httpbin.org (Testing)            │  │
│                        └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Module Structure

```
src/
├── background/
│   ├── index.js           # Main entry, message handler (ES Module)
│   ├── proxy-fetcher.js   # Fetch & parse proxies
│   ├── proxy-manager.js   # Set/clear proxy, failover
│   └── health-monitor.js  # Health checks, alarms
├── core/
│   └── reputation-engine.js # Trust scoring (0-100)
├── security/
│   └── tamper-detection.js  # MITM detection
├── popup/
│   ├── i18n.js           # Internationalization (RU/EN)
│   ├── virtual-scroller.js # Virtual scrolling
│   ├── error-handler.js  # Error handling
│   ├── state.js          # State management
│   ├── utils.js          # Utilities
│   └── constants.js      # Constants
└── modules/
    ├── webrtc-blocker.js # WebRTC blocking
    └── security.js       # Security utilities
```

## Data Flow

1. **Proxy Fetch**: Background fetches from ProxyMania/ProxyScrape
2. **Storage**: Proxies cached in chrome.storage
3. **Display**: Popup renders proxy list with virtual scrolling
4. **Trust Scoring**: Reputation engine calculates trust scores
5. **Connection**: User clicks connect → Background sets Chrome proxy
6. **Monitoring**: Health checks run every 30 seconds
7. **Tamper Detection**: MITM checks on proxy connection

## Trust Score Algorithm

The reputation engine calculates a score (0-100) based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| Speed Score | 30% | Based on latency (lower = better) |
| Reliability | 35% | Success rate percentage |
| Trust Score | 25% | HTTPS only, no tampering |
| Freshness | 10% | Recently tested |

## Security Features

- **MITM Detection**: Tests for certificate tampering
- **WebRTC Blocking**: Prevents IP leaks
- **DNS Leak Protection**: Option to enable
- **Trust Badges**: Visual indicators (Trusted/Unverified/Risky)

## Key Features

- **Proxy Sources**: ProxyMania, ProxyScrape
- **Trust Scoring**: Speed + Reliability + Trust + Freshness
- **Tamper Detection**: MITM attack detection
- **i18n**: Russian, English
- **Virtual Scrolling**: Handles 500+ proxies efficiently
- **Accessibility**: ARIA labels, keyboard navigation
