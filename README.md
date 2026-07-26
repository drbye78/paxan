# PeasyProxy - Smart Proxy Router

[![Version](https://img.shields.io/badge/version-3.0.18-blue?style=flat-square)](https://github.com)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?style=flat-square)](https://chrome.google.com/webstore)
[![Android App](https://img.shields.io/badge/Android-App-green?style=flat-square)](https://play.google.com/store)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-green?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

A professional-grade proxy manager that works as both a **Chrome extension** and **Android app**. Routes traffic through rotating proxy servers from [ProxyMania](https://proxymania.su/free-proxy) and [ProxyScrape](https://proxyscrape.com/). Features intelligent proxy selection, real-time monitoring, reputation scoring, and automatic failover.

**⚠️ Important:** This is NOT a VPN. Free proxies can intercept traffic. Do not use for banking or sensitive logins.

---

## Projects

| Project | Directory | Language | Build | Status |
|---------|-----------|----------|-------|--------|
| **Chrome Extension** | `src/`, root | JavaScript (ES modules) | esbuild | Stable |
| **Android App** | `app/` | Kotlin (Jetpack Compose) | Gradle | Stable |

The two projects share nothing at build time. Both produce output to `dist/`.

---

## Quick Start

### Chrome Extension

```bash
pnpm install && pnpm build   # first time
pnpm build --watch            # dev mode with sourcemaps
pnpm test                     # Jest (from tests/ dir)
pnpm distribute               # ZIP + CRX → dist/
```

Then load unpacked at `chrome://extensions/`. `popup.js` is a build artifact — never edit directly.

### Android App

```bash
./gradlew assembleDebug        # debug APK
./gradlew assembleRelease      # release APK (unsigned)
./gradlew copyToDist           # APK → dist/
./gradlew test                 # unit tests (JUnit 4 + MockK)
```

Requirements: Android 8.0+, JDK 17+, Gradle 8.x.

---

## Architecture

### Chrome Extension (Manifest V3)

```
popup.html (esbuild bundle) ←─chrome.runtime.sendMessage─→ background/index.js (ES module SW)
       │                                                            │
   popup.js                                                     chrome.proxy
   styles.css                                                   chrome.storage
                                                                chrome.alarms
```

**Key modules:**
- `src/background/proxy-config-manager.js` — single authority for `chrome.proxy.settings`
- `src/background/proxy-fetcher.js` — ProxyMania/ProxyScrape integration
- `src/popup-modules/` — 13 UI modules bundled by esbuild into `popup.js`
- `src/core/reputation-engine.js` — trust scoring 0-100
- `src/modules/webrtc-blocker.js` — content script at `document_start`

### Android App (MVVM + Clean Architecture)

```
UI (Compose) → ViewModel → Repository → Service/Data
                                            │
                              VpnService ← VpnController
                              Room DB      OkHttp/Retrofit
                              MMKV         WorkManager
```

**Tech stack:** Jetpack Compose, Hilt DI, Room, MMKV, OkHttp, Retrofit, Coroutines, WorkManager.

**Key components:**
- `VpnService` — system-level VPN tunnel (HTTP, SOCKS4, SOCKS5)
- `SplitTunnelManager` — per-app VPN routing (API 29+)
- `VpnStateRepository` — single source of truth for connection state
- `ProxyRepository` — proxy fetching, testing, Room caching
- `HealthWorker` + foreground service timer — dual health check mechanism

---

## Features

### Core
- Proxy testing before connect, automatic failover
- Smart scoring (35% speed + 30% reliability + 25% trust + 10% freshness)
- Live health monitoring, reputation engine (Trusted/Unverified/Risky)
- Connection timer, statistics dashboard, per-proxy success rate tracking

### UI
- Dark/Light/AMOLED themes
- Quick Connect, Favorites, Recently Used
- Filter chips, country search, protocol filtering
- Import/Export (JSON/TXT)
- Keyboard shortcuts (`Ctrl+K` search, `Ctrl+D` disconnect, etc.)

### Android-specific
- System-wide VPN routing with split tunneling
- Always-on VPN (OS-level), kill-switch
- Quick Settings tile, home screen widget
- Per-app routing configuration
- Custom DNS settings, battery optimization helper

---

## Project Structure

```
proxy-vpn-extension/
├── src/                         # Chrome Extension source
│   ├── background/              # Service worker (native ES modules)
│   ├── popup-modules/           # Popup UI → bundled into popup.js
│   ├── popup/                   # Utilities (i18n, constants, virtual-scroller)
│   ├── shared/                  # Zero-dependency shared utilities
│   ├── core/                    # Reputation engine
│   ├── security/                # Tamper detection, DNS protection
│   └── modules/                 # Content scripts (WebRTC blocker)
├── app/                         # Android App (Gradle project)
│   └── src/main/java/com/peasyproxy/app/
│       ├── ui/                  # Compose screens, navigation, theme
│       ├── service/             # VpnService, VpnController, protocol handlers
│       ├── data/                # Room entities, DAOs, repositories, network
│       ├── domain/              # Models, use cases
│       ├── di/                  # Hilt modules
│       └── security/            # Encrypted credentials, key management
├── tests/                       # Chrome Extension test suite (Jest)
├── dist/                        # Build output (generated)
├── manifest.json                # Extension manifest (MV3)
├── build.js                     # esbuild bundler
├── package.json                 # pnpm config + scripts
└── build.gradle.kts             # Gradle root + version management
```

---

## Development

For agent/AI-assisted development, see [AGENTS.md](AGENTS.md) — build commands, critical rules, storage conventions, test quirks, and Android gotchas.

### Version management

```bash
# Chrome Extension: version in package.json
pnpm version patch

# Android: synced from package.json via Gradle
./gradlew syncVersion      # pull version, increment versionCode
./gradlew bumpVersion      # patch bump
./gradlew bumpMinor        # minor bump
./gradlew bumpMajor        # major bump
```

---

## Security

This project uses **free public proxies** with inherent risks:

| Threat | Mitigation |
|--------|-----------|
| MITM attacks | HTTPS-only browsing; tampering detection |
| Traffic logging | Assume all traffic is logged; no sensitive accounts |
| Credential theft | Never enter passwords on HTTP sites; use 2FA |

**Trust scores:** Trusted (≥80), Unverified (40-79), Risky (<40).

---

## Resources

- [Chrome Extensions Docs](https://developer.chrome.com/docs/extensions/)
- [Android Jetpack Compose](https://developer.android.com/jetpack/compose)
- [Android VPN Service](https://developer.android.com/guide/topics/connectivity/vpn)
- Proxy sources: [ProxyMania](https://proxymania.su/), [ProxyScrape](https://proxyscrape.com/)

## License

MIT — See [LICENSE](LICENSE).

---

**⚠️ Disclaimer:** Provided "as-is" for educational purposes. Use free proxies at your own risk.
