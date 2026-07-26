# AGENTS.md — PeasyProxy

Dual project: Chrome Extension (Manifest V3) + Android App (Jetpack Compose). Shared name, separate build systems.

## Quick commands

```bash
# Chrome Extension
pnpm install                          # first time only
pnpm build                            # bundle popup (node build.js) → popup.js
pnpm build --watch                    # dev mode with sourcemaps
pnpm test                             # Jest (must run from tests/ dir)
pnpm distribute                       # ZIP + CRX packages → dist/

# Android App
./gradlew assembleDebug               # debug APK
./gradlew assembleRelease             # release APK (unsigned)
./gradlew copyToDist                  # debug APK → dist/
./gradlew copyReleaseToDist           # release APK → dist/
./gradlew test                        # unit tests
./gradlew connectedAndroidTest        # instrumented tests (needs device/emulator)
```

> Fresh clones: `pnpm install && pnpm build` before loading the extension. `popup.js` is a build artifact, not tracked in git.

## Project boundaries

| Project | Directory | Build system | Language | Package manager |
|---------|-----------|-------------|----------|----------------|
| Chrome Extension | `src/`, root | esbuild (`build.js`) | JavaScript (ES modules) | pnpm |
| Android App | `app/` | Gradle 8.2.2 | Kotlin 1.9.22 | Gradle |

The two projects share nothing at build time. Extension version comes from `package.json`, Android version from `app/build.gradle.kts` (synced via Gradle version tasks). Both produce output to `dist/`.

---

## Chrome Extension

### Build facts

- **Background** uses native ES modules — `manifest.json` points to `src/background/index.js` directly. No build step.
- **Popup** is bundled by esbuild (`build.js`). Entry: `src/popup-modules/main.js`. Output: `popup.js` (iife, Chrome 120 target).
- **`popup.js` is a build artifact** — never edit it directly.
- Background modules import from each other with relative paths (e.g. `./proxy-fetcher.js`).
- Popup modules can import from `../shared/utils.js` and those get inlined by esbuild.

### Critical rules

#### `chrome.proxy.settings` authority
**Only `src/background/proxy-config-manager.js` may call `chrome.proxy.settings`.** It provides:

| Method | Use |
|--------|-----|
| `proxyConfig.setUserProxy(proxy)` | Set the user's active proxy |
| `proxyConfig.clearUserProxy()` | Restore system defaults |
| `proxyConfig.withTestConfig(config, fn, opts)` | Temporarily set a test proxy, run fn, restore original. **Always use this for connectivity tests, latency checks, validation, etc.** |
| `proxyConfig.fetchDirect(fn)` | Temporarily clear proxy, run fn (for real-IP detection, baseline fetches), restore |

All operations are serialized through a promise queue — no races.

#### Storage key conventions
- `security.webRtcProtection` — WebRTC toggle (NOT `settings.webRtcProtection`)
- `security.dnsLeakProtection` — DNS protection toggle
- `sessionRealIp` — real IP cached in `chrome.storage.session`
- `monitoringState` — monitoring proxy persisted in `chrome.storage.session` for SW restart recovery

#### XSS in popup
All dynamic content interpolated into `innerHTML` must use `escapeHtml()` from `../shared/utils.js`. Proxy data (country, IP, type) comes from external sources — never trust it.

### Shared utilities

`src/shared/utils.js` — zero DOM APIs, zero Chrome APIs. Safe for both service worker and popup:

- `escapeHtml(text)` — HTML-encode for innerHTML
- `buildProxyConfig(proxy, opts)` — build `chrome.proxy.settings` value object
- `isRegexSafe(pattern)` / `safeRegexTest(pattern, text)` — ReDoS guard
- `escapeRegex(str)` / `wildcardToRegex(pattern)` — pattern→regex conversion
- `compareVersions(a, b)` — semver comparison
- `uniqueId(prefix)` — collision-safe ID generation

### Directory map

```
src/
├── background/          # Service worker modules (native ES modules)
│   ├── index.js         # Central message router (40+ action handlers)
│   ├── proxy-config-manager.js  # SINGLE authority for chrome.proxy.settings
│   ├── proxy-manager.js # setProxy/clearProxy wrappers → delegates to proxyConfig
│   ├── proxy-fetcher.js # Fetch & parse from ProxyMania/ProxyScrape
│   ├── health-monitor.js    # Alarm-based health checks
│   ├── quality-monitor.js   # Latency/jitter/bandwidth/packet-loss
│   ├── dns-leak-test.js     # DNS leak detection (captureRealIp, testDnsLeak)
│   ├── proxy-chain.js       # Chain CRUD + testing
│   ├── pac-engine.js        # PAC script parsing (safe evaluator, no new Function)
│   └── url-rules.js         # Whitelist/blacklist URL matching
├── popup-modules/       # Popup UI modules (bundled by esbuild)
│   ├── main.js          # Entry point — init() orchestrator
│   ├── popup.state.js   # All app state + chrome.storage persistence
│   ├── popup.events.js  # DOM event listeners
│   └── popup.{connection,proxy-list,ui,analytics,backup,onboarding,performance,search,rules,tabs}.js
├── popup/               # Utility modules (imported by popup-modules/)
│   ├── i18n.js          # RU/EN translations (ES exports for prod, CommonJS require for tests)
│   ├── constants.js     # Scoring weights, thresholds
│   └── virtual-scroller.js  # VirtualScroller class
├── shared/
│   └── utils.js         # Shared zero-dependency utilities
├── core/
│   └── reputation-engine.js  # Trust scoring 0-100 (debounced saves)
├── security/
│   ├── tamper-detection.js   # MITM detection (uses proxyConfig.withTestConfig)
│   └── dns-protection.js     # Thin re-export from dns-leak-test.js
├── modules/
│   └── webrtc-blocker.js     # Content script — runs at document_start, synchronous init
└── test-support/        # Test-only files (not loaded at runtime)
    ├── security.js      # Input validation functions
    └── rate-limiter.js  # RateLimiter class
```

### Content script: WebRTC blocker

`src/modules/webrtc-blocker.js` — injected at `document_start` in all frames. **Must apply protection synchronously** before any page script can capture `RTCPeerConnection`. Reads `security.webRtcProtection` from `chrome.storage.local` asynchronously after the sync block. Overrides `createOffer` AND `createAnswer` for SDP filtering.

### Testing (Chrome Extension)

```
pnpm test              # from tests/ dir (Jest)
pnpm test:unit         # unit tests only
pnpm test:coverage     # with coverage
```

- Test runner: Jest with jsdom environment and babel transform
- E2E (`tests/e2e/`) and accessibility (`tests/accessibility/`) tests are **excluded from unit runs**
- Test shim: `tests/test-shim.js` — bridges actual extension modules into Jest
- **No chrome API mocks** in unit tests. Tests that call `chrome.storage.*` or proxy APIs will fail — those need manual mocking in `jest.setup.js`.
- Many unit tests are **pre-existing failures** due to missing chrome mocks (not regressions)

### Chrome Extension conventions

- `const` by default, `let` only when needed. No `var`.
- Service worker can be killed at any time by Chrome — module-level state must be persisted to `chrome.storage.session` or `chrome.storage.local`.
- Alarms survive SW restarts but module-level state does not. Restore from storage in alarm handlers.
- No backward compatibility constraints — optimize for correctness over compatibility.
- `archive/` and `obsolete-backup/` are dead code graveyards. Do not import from them.

---

## Android App

### Tech stack

| Layer | Technology |
|-------|-----------|
| UI | Jetpack Compose (BOM 2024.02.00), Material 3, Navigation Compose |
| DI | Hilt 2.48.1 (annotation processing via KSP 1.9.22-1.0.17) |
| Network | OkHttp 4.12.0, Retrofit 2.9.0 |
| Database | Room 2.6.1 |
| Async | Kotlin Coroutines 1.7.3, StateFlow |
| Settings | MMKV (multi-process safe) |
| Background | WorkManager 2.9.0 |
| Logging | Timber 5.0.1 |
| HTML parsing | Jsoup 1.17.2 |

### Architecture

- **MVVM + Clean Architecture**: UI → ViewModel → Repository → Service/Data layers
- Package: `com.peasyproxy.app`
- Min SDK: 26 (Android 8.0 Oreo), Target/Compile SDK: 34
- Kotlin 1.9.22, JVM target 17
- Release builds: ProGuard enabled with custom rules in `app/proguard-rules.pro`

### Key architecture facts

- `VpnService.kt` extends Android's `VpnService` — requires VPN permission from user on first launch. This is the core system-level proxy/VPN tunnel that runs in the `:vpn` process.
- `VpnController` manages protocol handlers: HTTP, HTTPS (CONNECT), SOCKS4, SOCKS5
- `PacketProcessor` routes packets through the VPN tunnel
- `ProxyRepository` fetches proxies (ProxyMania/ProxyScrape), tests them, and caches in Room
- `HealthWorker` (WorkManager) + foreground service timer — dual health check mechanism; inline polling in VpnService for sub-15-minute checks
- `SplitTunnelManager` and `PerAppRoutingManager` handle per-app VPN routing via `builder.addAllowedApplication()` / `addDisallowedApplication()` (API 29+)
- `VpnStateRepository` — single source of truth for VPN connection state (`Idle → Connecting → Connected → Unstable → Error`)
- `KillSwitchService` manages VPN kill-switch with proper scope lifecycle
- Hilt DI wiring is in `app/src/main/java/com/peasyproxy/app/di/`
- Architecture follows standard Android layering: `ui/` → `domain/` → `data/`

### Testing (Android)

```bash
./gradlew test                              # unit tests (JUnit 4 + MockK + Turbine)
./gradlew connectedAndroidTest              # instrumented tests (needs device/emulator)
```

Unit tests use MockK (not Mockito). Coroutine testing uses `kotlinx-coroutines-test` and Turbine for Flow testing.

### Version management

Root `build.gradle.kts` provides Gradle tasks that sync versions between `package.json` and `app/build.gradle.kts`:

```bash
./gradlew syncVersion     # pull version from package.json, increment versionCode
./gradlew setVersion -Pversion=1.2.3  # set explicit version in both files
./gradlew bumpVersion     # patch bump
./gradlew bumpMinor       # minor bump
./gradlew bumpMajor       # major bump
```

### Android gotchas

- `app/google-services.json` exists — Firebase services are configured (Crashlytics mentioned in docs). Service may not work without a real Firebase project.
- Release APK is unsigned by default. Signing config is not in the build file.
- Hilt's `@AndroidEntryPoint` requires both the Hilt Gradle plugin AND KSP plugin applied. The `app/build.gradle.kts` plugins block should include these — verify before adding Hilt-annotated classes.
