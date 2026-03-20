# PeasyProxy - Smart Proxy Router

[![Version](https://img.shields.io/badge/version-3.0.0-blue?style=flat-square)](https://github.com)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?style=flat-square)](https://chrome.google.com/webstore)
[![Android App](https://img.shields.io/badge/Android-App-green?style=flat-square)](https://play.google.com/store)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-green?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Release](https://img.shields.io/github/v/release/your-org/proxy-vpn-extension?style=flat-square)](https://github.com/your-org/proxy-vpn-extension/releases)

A professional-grade proxy manager that works as both a **Chrome extension** and **Android app**. Routes your traffic through rotating proxy servers from [ProxyMania](https://proxymania.su/free-proxy) or [ProxyScrape](https://proxyscrape.com/). Features intelligent proxy selection, real-time monitoring, reputation scoring, and tampering detection.

**⚠️ Important:** This is NOT a VPN. Free proxies can intercept traffic. Do not use for banking or sensitive logins.

---

## 📱 Projects

| Project | Description | Status |
|---------|-------------|--------|
| **Chrome Extension** | Browser-based proxy manager (Manifest V3) | ✅ Stable |
| **Android App** | System-wide VPN/proxy manager | ✅ Beta |

---

## ⚡ Quick Start

### Chrome Extension
1. **Install**: Load unpacked extension in Chrome
2. **Connect**: Click any proxy or use Quick Connect
3. **Browse**: Traffic now routes through selected proxy

### Android App
1. **Install**: Download APK from [Releases](https://github.com/your-org/proxy-vpn-extension/releases)
2. **Grant VPN Permission**: Required for system-wide proxying
3. **Connect**: Tap Quick Connect or select a proxy

---

## 🎯 Architecture

### Current Structure (v3.0.0)
The extension now uses a **monolithic architecture** for better maintainability:

- **`popup.js`** (3,425 lines) - Main popup logic, state management, UI rendering
- **`src/background/`** - Service worker modules (proxy management, health monitoring)
- **`src/core/`** - Core business logic (reputation engine)
- **`src/security/`** - Security features (tamper detection)
- **`src/popup/`** - Popup utilities (i18n, virtual scrolling)
- **`src/modules/webrtc-blocker.js`** - WebRTC IP leak protection (content script)

### Cleanup History
- **Obsolete files removed**: 36 files moved to `obsolete-backup/`
- **Unused modules**: Modular architecture files removed (kept for test support only in `src/test-support/`)
- **Test support**: `src/test-support/` contains files used only by test suite

## 🎯 Features

### New in v3.0.0
- ✅ **Cleaner codebase** - Removed unused modular architecture files
- ✅ **Simplified build process** - No unnecessary bundling
- ✅ **Better maintainability** - Single monolithic implementation

### New in v2.3.0
- 🌐 **Multiple Proxy Sources** - Choose between ProxyMania or ProxyScrape
- 💾 **Smart Caching** - 5-minute cache for faster loading
- 🚫 **Country Blacklist** - Exclude unwanted countries from proxy list
- 🎯 **Enhanced Best Proxy** - Improved algorithm using historical connection data
- 🔧 **Connection Failure UI** - Visual feedback when connection fails

### Core Features
- 🧪 **Real Proxy Testing** - Tests connectivity before connecting (5s timeout)
- 🔄 **Auto-Failover** - Automatically switches to backup proxy on failure
- ⭐ **Smart Recommendations** - AI-powered scoring (speed + reliability + freshness + history)
- 📊 **Success Rate Tracking** - Tracks connection attempts per proxy
- 📡 **Live Monitoring** - Checks proxy health every 30 seconds
- ⏱️ **Connection Timer** - Live session duration display

### User Experience
- 🌙 **Dark/Light Theme** - Toggle between themes or use auto
- 🚀 **Quick Connect** - One-tap connection to 4 fastest proxies
- ⭐ **Favorites** - Star and save preferred proxies
- 🕐 **Recently Used** - Quick access to last 10 proxies
- 📈 **Statistics Dashboard** - Daily usage stats and history
- 📥 Import/Export - Save and share working proxies

### UI/UX Polish
- 🎨 **Professional Design** - Modern gradients, shadows, animations
- 📱 **Responsive Layout** - Clean 420px popup interface
- ⚡ **Smooth Animations** - Slide-in, pulse, shimmer effects
- 🏷️ **Filter Chips** - Visual speed/type filtering
- 📊 **Sparkline Charts** - Visual latency trends per proxy
- 🔔 **Toast Notifications** - Non-blocking feedback with undo support

---

## 📦 Installation

### Chrome Extension

#### Development Mode

1. **Open Extensions Page**
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle switch in top-right corner

3. **Load Extension**
   - Click "Load unpacked"
   - Select the `proxy-vpn-extension` folder

4. **Pin Extension** (Optional)
   - Click puzzle icon in toolbar
   - Pin "PeasyProxy" for easy access

#### Production Build

For building distribution packages (ZIP for Chrome Web Store, CRX for sideloading):

```bash
# Build both ZIP and CRX packages
npm run distribute

# Build ZIP only (for Chrome Web Store)
npm run distribute:zip

# Build CRX only (for sideloading)
npm run distribute:crx
```

Packages are created in the `dist/` folder:
- `dist/peasyproxy.zip` - Upload to Chrome Web Store
- `dist/peasyproxy.crx` - Direct installation

---

### Android App

#### Requirements
- Android 8.0 (Oreo) or higher
- JDK 17+
- Gradle 8.x

#### Build Commands

```bash
# Debug build
./gradlew assembleDebug

# Release build (unsigned)
./gradlew assembleRelease

# Build and copy to dist/ directory
./gradlew copyToDist          # Debug APK
./gradlew copyReleaseToDist  # Release APK
```

#### Output

All build artifacts are placed in the `dist/` directory:

| File | Description |
|------|-------------|
| `proxymania-android-debug.apk` | Android debug build |
| `proxymania-android-release-unsigned.apk` | Android release build (unsigned) |
| `proxy-vpn-extension.zip` | Chrome extension (Web Store) |
| `proxy-vpn-extension.crx` | Chrome extension (sideload) |

> **Note:** To rebuild the CRX with the latest changes, install `crx3` globally:
> ```bash
> npm install -g crx3
> ```

### Publishing to GitHub Releases

To publish distribution packages to GitHub Releases:

```bash
# Set your GitHub token (required)
export GITHUB_TOKEN=ghp_...

# Build and publish release
npm run release

# Create draft release (for review before publishing)
npm run release:draft

# Create prerelease
npm run release:prerelease
```

**Automatic Releases:** When you push a version tag (e.g., `v1.0.0`), GitHub Actions will automatically build and publish the release:

```bash
# Update version in package.json
npm version patch  # or minor, major

# Push tag to trigger automated release
git push --follow-tags
```

---

## 🚀 Usage Guide

### Basic Connection

1. Click extension icon in toolbar
2. Browse available proxies (sorted by smart score)
3. Click **Connect** on desired proxy
4. Wait for test to complete (~2-5 seconds)
5. Status turns green when connected

### Quick Connect

- Shows 4 fastest proxies (< 150ms)
- One-tap connection
- Auto-updates on refresh

### Recommended Proxies

- Gold-bordered cards show top 3 proxies
- Based on: 40% speed + 40% reliability + 20% freshness
- Displays success rate percentage

### Filtering

**Filter Chips:**
- ⚡ All Speeds - Show all
- 🚀 <100ms - Ultra fast
- ⚡ <300ms - Fast
- 🔒 HTTPS - Secure proxies
- 🔌 SOCKS5 - Protocol proxies

**Dropdowns:**
- Country filter with flags
- Type filter (HTTPS/SOCKS5)

**Tabs:**
- **All Proxies** - Complete list
- **⭐ Favorites** - Starred proxies
- **🕐 Recent** - Recently used

### Favorites

1. Click ☆ on any proxy to star it
2. Access via Favorites tab
3. Click ⭐ again to remove

### Settings

Click ⚙️ to access:

| Setting | Options | Default |
|---------|---------|---------|
| Theme | Dark / Light / Auto | Dark |
| Auto-Refresh | 1min / 5min / 10min / Off | 5min |
| Auto-Failover | On / Off | On |
| Test Before Connect | On / Off | On |
| Notifications | On / Off | On |

### Statistics

Click 📊 to view:

- **Proxies Used Today** - Count of connections
- **Connection Time** - Total duration
- **Success Rate** - Connection success %
- **Top Countries** - Most used locations
- **Connection History** - Recent proxies with stats

### Import/Export

**Import:**
1. Settings → 📥 Import
2. Select `.json` or `.txt` file
3. Proxies added to list

**Export:**
1. Settings → 📤 Export
2. Downloads working proxies (>50% success)
3. JSON format with full details

### Keyboard Shortcuts (v2.2.0)

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` or `/` | Focus search |
| `Ctrl+D` | Disconnect |
| `Ctrl+R` | Refresh proxies |
| `Ctrl+I` | Check IPs |
| `Ctrl+S` | Open Settings |
| `Ctrl+Q` | Quick connect (best proxy) |
| `Ctrl+F` | Focus country filter |
| `Escape` | Close panels |

### Advanced Features (v2.2.0)

**Per-Site Rules:**
1. Settings → Advanced Features → Per-Site Proxy Rules → Manage Rules
2. Enter website URL (e.g., `netflix.com`)
3. Select pattern type (Exact, Wildcard, Contains, Regex)
4. Choose priority (1 = highest)
5. Select proxy country
6. Click Save

**Auto-Rotation:**
1. Settings → Advanced Features → Auto-Rotation
2. Toggle ON
3. Select rotation interval (5/10/15/30 min)
4. Proxies rotate within same country automatically

**IP Detector:**
- Connect to a proxy
- Click "Check IPs" in the connection card
- Verify proxy IP differs from real IP

---

## 📁 Project Structure

```
proxy-vpn-extension/
├── manifest.json          # Extension config (MV3)
├── popup.html             # UI structure (438 lines)
├── popup.js               # Main logic (~2780 lines)
├── background.js         # Service worker (~1000 lines)
├── styles.css            # Styling (~1650 lines)
│
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
└── src/
    └── modules/
        ├── webrtc-blocker.js
        ├── security.js
        ├── health.js
        ├── errorHandler.js
        ├── onboarding.js
        ├── visualization.js
        └── proxyValidator.js

├── dist/                   # Distribution packages (generated)
│   ├── peasyproxy.zip
│   └── peasyproxy.crx
├── distribute.js          # Distribution build script
├── release.js             # GitHub release publisher
└── package.json           # Project config & scripts
```

---

## 🔧 Technical Details

### Architecture

```
┌─────────────┐     Messages     ┌──────────────────┐
│  popup.html │ ◀──────────────▶ │  background.js   │
│  popup.js   │                  │ (Service Worker) │
│  styles.css │                  │                  │
└─────────────┘                  │ ┌──────────────┐ │
       │                         │ │Chrome APIs   │ │
       │ UI Updates              │ │- proxy       │ │
       ▼                         │ │- storage     │ │
┌─────────────┐                  │ │- runtime     │ │
│DOM Rendering│                  │ └──────────────┘ │
└─────────────┘                  └──────────────────┘
                                          │
                                          │ HTTP
                                          ▼
                                 ┌──────────────────┐
                                 │  ProxyMania.su   │
                                 │  (External API)  │
                                 └──────────────────┘
```

### Permissions

| Permission | Purpose |
|------------|---------|
| `proxy` | Configure Chrome proxy settings |
| `storage` | Cache data, save settings |
| `tabs` | Tab information for routing |
| `https://proxymania.su/*` | Fetch proxy list |

### Smart Scoring Algorithm

```javascript
score = (speedScore × 0.4) + 
        (reliabilityScore × 0.4) + 
        (freshnessScore × 0.2) + 
        (favoriteBonus)

// Where:
// speedScore = max(0, 100 - latency/5)
// reliabilityScore = successRate %
// freshnessScore = 50-100 based on last check
// favoriteBonus = 10 if favorited
```

### Storage Schema

```javascript
{
  // User settings
  settings: {
    theme: 'dark',
    autoFailover: true,
    testBeforeConnect: true,
    notifications: true,
    refreshInterval: 300000
  },
  
  // Active connection
  activeProxy: { ...proxy },
  connectionStartTime: timestamp,
  
  // Cached data
  proxies: [...],
  proxiesTimestamp: timestamp,
  favorites: [...],
  recentlyUsed: [...],
  
  // Statistics
  proxyStats: {
    'ip:port': {
      attempts: 50,
      successes: 42,
      failures: 8,
      successRate: 84,
      latencies: [...],  // Last 20
      avgLatency: 49,
      lastSuccess: timestamp,
      lastFailure: timestamp
    }
  },
  
  // Daily stats
  dailyStats: {
    proxiesUsed: 5,
    connectionTime: 3600,  // seconds
    attempts: 10,
    successes: 8
  },
  statsDate: 'Mon Mar 11 2024'
}
```

---

## ⚠️ Security & Privacy

### Security Model

This extension uses **free public proxies**, which introduces security risks. Understanding these risks is critical:

#### Threats

| Threat | Description | Mitigation |
|--------|-------------|------------|
| **MITM Attacks** | Malicious proxy operators can intercept traffic | Use HTTPS-only websites; extension flags suspicious proxies |
| **Traffic Logging** | Proxies may log your browsing activity | Assume all traffic is logged; don't access sensitive accounts |
| **Content Injection** | Proxies can inject ads, scripts, or malware | Extension includes tampering detection; avoid HTTP sites |
| **Credential Theft** | Session cookies and passwords can be captured | Never enter passwords on HTTP sites; use 2FA |
| **Proxy Instability** | Free proxies can disappear or stop working | Auto-failover switches to working proxies automatically |

#### Trust Scores

ProxyMania now includes **reputation scoring** to help identify safer proxies:

- 🟢 **Trusted** - 90%+ uptime, 100+ tests, no tampering detected
- 🟡 **Unverified** - New proxy or limited test data
- 🔴 **Risky** - High failure rate or suspicious behavior detected

### Critical Warnings

> **⚠️ NEVER use free proxies for:**
> - Online banking or financial transactions
> - Credit card payments
> - Sensitive account logins (email, social media, work accounts)
> - Confidential data transmission
> - Torrenting or P2P file sharing

> **✅ SAFE uses:**
> - Bypassing geo-blocks for general browsing
> - Accessing public content
> - Testing website availability from different regions
> - Research and educational purposes

### What This Extension Does

✅ Routes browser traffic through selected proxy  
✅ Bypasses local addresses (localhost, private IPs)  
✅ Stores settings locally (no cloud sync)  
✅ Tests proxy connectivity and health  
✅ Monitors proxy reputation and uptime  
✅ Detects potential content tampering (v3.0+)  
✅ Auto-failover on proxy failure  

### What This Extension Does NOT Do

❌ **Encrypt traffic** - Use HTTPS websites for encryption  
❌ **Provide anonymity** - Your ISP can still see you're using a proxy  
❌ **Log browsing activity** - No data leaves your browser  
❌ **Collect personal data** - All data stored locally  
❌ **Modify website content** - Proxies might, but extension doesn't  
❌ **Guarantee security** - Free proxies are inherently risky  

### Best Practices

1. **HTTPS Only** - Only visit HTTPS websites when using proxies
2. **No Sensitive Logins** - Don't log into important accounts
3. **Use Trusted Proxies** - Prefer proxies with 🟢 Trusted status
4. **Monitor Security Badge** - Disconnect if security warning appears
5. **Regular Rotation** - Switch proxies periodically

---

## 🐛 Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| Proxies won't load | Check internet, click Refresh |
| Connection fails | Try different proxy, check success rate |
| Slow browsing | Choose proxy < 100ms |
| Proxy stops working | Free proxies expire; select another |
| Extension icon missing | Reload at `chrome://extensions/` |

### Debug Mode

1. Open `chrome://extensions/`
2. Find ProxyMania VPN
3. Click "Inspect views: background page"
4. Check Console for errors

### Debug Commands

```javascript
// In popup console (F12)
chrome.storage.local.get(null, console.log);  // View all storage
chrome.storage.local.clear();  // Reset everything
location.reload();  // Reload extension
```

---

## 📊 Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Initial load time | < 3s | ~1.5s |
| Filter response | < 100ms | ~30ms |
| Proxy test timeout | 5s | 5s |
| Connection time | < 3s | ~2s |
| Extension size | < 200KB | ~90KB |
| Memory usage | < 50MB | ~25MB |

---

## 📝 Version History

| Version | Date | Status |
|---------|------|--------|
| 2.0.0 | 2024-03-11 | **Current** - All phases complete |
| 1.2.0 | 2024-03-11 | Phase 2 - Intelligence |
| 1.1.0 | 2024-03-11 | Phase 1 - Foundation |
| 1.0.1 | 2024-03-10 | Bug fixes |
| 1.0.0 | 2024-03-10 | Initial release |

See [CHANGELOG.md](CHANGELOG.md) for details.

---

## 🗺️ Roadmap

### Completed ✅
- [x] Phase 1: Foundation (Testing, Timer, Flags, Quick Connect)
- [x] Phase 2: Intelligence (Failover, Stats, Favorites, Monitoring)
- [x] Phase 3: UI Polish (Themes, Animations, Settings)
- [x] Phase 4: Advanced (Stats Dashboard, Import/Export)
- [x] Phase 5: Premium Styling

### Future Considerations
- [ ] DNS leak testing
- [ ] WebRTC leak prevention
- [ ] Per-tab proxy settings
- [ ] PAC script support
- [ ] Proxy chain support

---

## 🔗 Resources

### Chrome Extension
- [ProxyMania](https://proxymania.su/free-proxy) - Proxy source
- [Chrome Extensions Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Proxy API](https://developer.chrome.com/docs/extensions/reference/proxy/)

### Android App
- [ANDROID.md](ANDROID.md) - Android app documentation
- [Android Jetpack Compose](https://developer.android.com/jetpack/compose)
- [Android VPN Service](https://developer.android.com/guide/topics/connectivity/vpn)

### General
- [GitHub Releases](https://github.com/your-org/proxy-vpn-extension/releases) - Download latest version

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file.

---

## 🙏 Acknowledgments

### Chrome Extension
- Proxy list: [ProxyMania](https://proxymania.su/)
- Framework: Vanilla JavaScript (no dependencies)

### Android App
- Framework: [Jetpack Compose](https://developer.android.com/jetpack/compose)
- Architecture: [MVVM + Clean Architecture](https://developer.android.com/topic/architecture)
- DI: [Hilt](https://dagger.dev/hilt/)
- Database: [Room](https://developer.android.com/jetpack/androidx/releases/room)

---

## 📞 Support

### Chrome Extension
For detailed user instructions, troubleshooting, and FAQ, see [USER_GUIDE.md](USER_GUIDE.md).

### Android App
For Android app documentation, see [ANDROID.md](ANDROID.md).

### Development
For developer documentation, see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).

For API reference, see [API.md](API.md).

For architecture overview, see [ARCHITECTURE.md](ARCHITECTURE.md).

For release process, see [RELEASE.md](RELEASE.md).

For contributing guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

**⚠️ Disclaimer**: This extension is provided "as-is" for educational purposes. The developers are not responsible for proxy server uptime, data transmitted through proxies, or any misuse of this extension. Use free proxies at your own risk.
