# Developer Guide - ProxyMania VPN

This guide is for developers who want to understand, modify, or contribute to the ProxyMania VPN Chrome extension.

## Table of Contents

1. [Development Environment](#development-environment)
2. [Architecture Overview](#architecture-overview)
3. [Code Structure](#code-structure)
4. [API Reference](#api-reference)
5. [Building & Testing](#building--testing)
6. [Publishing to GitHub Releases](#publishing-to-github-releases)
7. [Debugging](#debugging)
8. [Contributing](#contributing)

---

## Development Environment

### Prerequisites

- **Google Chrome** (v88 or later for Manifest V3 support)
- **Node.js** (v16+, optional for tooling)
- **Text Editor** (VS Code recommended)
- **Git** (for version control)
- **crx3** (optional, for CRX building: `npm install -g crx3`)

### Setup

```bash
# Clone or navigate to the project
cd proxy-vpn-extension

# Open in your editor
code .

# Load in Chrome
# 1. Navigate to chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the project folder
```

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "msjsdiag.vscode-chrome-debug"
  ]
}
```

---

## Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    Messages    ┌──────────────────────────┐  │
│  │  popup.html  │ ◀────────────▶ │   src/background/        │  │
│  │  popup.js    │                │   (Service Worker)       │  │
│  │  styles.css  │                │   index.js (ES Module)   │  │
│  └──────────────┘                │                          │  │
│         │                          │  ┌────────────────────┐  │  │
│         │ UI Updates             │  │  Chrome APIs       │  │  │
│         ▼                          │  │  - proxy.settings  │  │  │
│  ┌──────────────┐                │  │  - storage.local   │  │  │
│  │   DOM Render │                │  │  - runtime         │  │  │
│  │   Virtual    │                │  │  - alarms          │  │  │
│  │   Scrolling  │                │  └────────────────────┘  │  │
│  └──────────────┘                │           │               │  │
│         │                        │           ▼               │  │
│         │                        │  ┌────────────────────┐  │  │
│         │                        │  │ Reputation Engine │  │  │
│         │                        │  │ (Trust Scoring)   │  │  │
│         │                        │  └────────────────────┘  │  │
│         │                        │           │               │  │
│         │                        │           ▼               │  │
│         │                        │  ┌────────────────────┐  │  │
│         │                        │  │ Tamper Detection   │  │  │
│         │                        │  │ (MITM Protection)  │  │  │
│         │                        │  └────────────────────┘  │  │
│         │                        └──────────────────────────┘  │
│         │                                      │                │
│         │                                      │ HTTP Fetch     │
│         │                                      ▼                │
│         │                        ┌─────────────────────────────┐  │
│         │                        │   External Sources:       │  │
│         │                        │   - ProxyMania (proxymania.su)│
│         │                        │   - ProxyScrape (api.proxyscrape.com)│
│         │                        └─────────────────────────────┘  │
│         │                                                      │
└─────────────────────────────────────────────────────────────────┘
```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    Messages    ┌──────────────────────────┐  │
│  │  popup.html  │ ◀────────────▶ │     background.js        │  │
│  │  popup.js    │                │   (Service Worker)       │  │
│  │  styles.css  │                │                          │  │
│  └──────────────┘                │  ┌────────────────────┐  │  │
│         │                          │  │  Chrome APIs       │  │  │
│         │ UI Updates             │  │  - proxy.settings  │  │  │
│         ▼                          │  │  - storage.local   │  │  │
│  ┌──────────────┐                │  │  - runtime         │  │  │
│  │   DOM Render │                │  └────────────────────┘  │  │
│  └──────────────┘                └──────────────────────────┘  │
│         │                                      │                │
│         │                                      │ HTTP Fetch     │
│         │                                      ▼                │
│         │                        ┌─────────────────────────────┐  │
│         │                        │   External Sources:        │  │
│         │                        │   - ProxyMania (proxymania.su)│
│         │                        │   - ProxyScrape (api.proxyscrape.com)│
│         │                        └─────────────────────────────┘  │
│         │                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action → popup.js → chrome.runtime.sendMessage → background.js
                                                          │
                                                          ▼
                                                  Fetch ProxyMania HTML
                                                          │
                                                          ▼
                                                  Parse Proxy Data
                                                          │
                                                          ▼
                                                  Store in chrome.storage
                                                          │
                                                          ▼
                                                  Return to popup.js
                                                          │
                                                          ▼
                                                  Render UI
```

---

## Code Structure

### File Responsibilities

#### `manifest.json`
Extension configuration and permissions (Manifest V3).

```json
{
  "manifest_version": 3,
  "name": "__MSG_extension_name__",
  "version": "3.0.0",
  "permissions": ["proxy", "storage", "tabs", "scripting", "alarms", "notifications"],
  "background": { "service_worker": "src/background/index.js", "type": "module" },
  "action": { "default_popup": "popup.html" }
}
```

#### `src/background/index.js`
Main service worker entry point (ES Module).

**Key Functions:**
- `fetchProxies()` - Fetches from selected source (ProxyMania or ProxyScrape)
- `fetchProxyMania()` - Fetches from proxymania.su (multiple pages)
- `fetchProxyScrape()` - Fetches from api.proxyscrape.com (CSV format)
- `setProxy(proxy)` - Configures Chrome proxy
- `clearProxy()` - Removes proxy configuration
- `testProxy(proxy)` - Checks proxy health
- `parseProxyMania(html)` - Parses HTML table
- `parseProxyScrapeCSV(csv)` - Parses CSV format
- `initReputationEngine()` - Initialize trust scoring
- `initTamperDetector()` - Initialize MITM detection

#### `src/core/reputation-engine.js`
Trust scoring system for proxies.

**Key Functions:**
- `calculateScore(proxy)` - Calculate trust score (0-100)
- `recordTest(proxy, success, latency)` - Record test result
- `getReputation(proxy)` - Get reputation data

#### `src/security/tamper-detection.js`
MITM attack detection.

**Key Functions:**
- `testProxy(proxy)` - Test for tampering
- `markTampered(ipPort, tampered)` - Mark proxy as tampered

#### `src/utils/rate-limiter.js`
Rate limiting and debouncing utilities.

**Key Functions:**
- `debounce(fn, delay)` - Debounce function calls
- `throttle(fn, limit)` - Throttle function calls

#### `popup.js`
Popup UI logic:
- Displaying proxy list with caching
- Filtering (country, type, speed, blacklist)
- User interaction handling
- Settings management
- Virtual scrolling for large lists

**Key Functions:**
- `loadProxies(forceRefresh)` - Loads from cache with 5-min TTL, optional force refresh
- `connectToProxy(proxy, event)` - Connects to selected proxy
- `filterProxies()` - Applies all filters including country blacklist
- `renderProxyList(proxies)` - Renders proxy items
- `switchToTab(tabName)` - Switches between All/Favorites/Recent
- `calculateProxyScore(proxy)` - Enhanced scoring with historical data
- `initVirtualScroller()` - Initialize virtual scrolling

#### `src/popup/i18n.js`
Internationalization system for RU/EN.

#### `src/popup/virtual-scroller.js`
Virtual scrolling for large proxy lists.

#### `popup.html`
UI structure with:
- Status indicator
- Control buttons
- Filter dropdowns
- Proxy list container
- Settings panel
- Stats panel

#### `distribute.js`
Distribution build script - creates ZIP and CRX packages for release.

**Features:**
- Pure Node.js implementation (no external dependencies)
- Excludes development files automatically
- Creates Chrome Web Store-ready ZIP
- Creates signed CRX using existing PEM key

#### `release.js`
GitHub release publisher - uploads distribution packages to GitHub Releases.

**Features:**
- Auto-detects version from package.json
- Creates release with generated notes
- Uploads ZIP and CRX as assets
- Supports draft and prerelease modes

#### `.github/workflows/release.yml`
GitHub Actions workflow for automated releases on version tag push.

#### `styles.css`
Visual styling including:
- Dark theme
- Animations (pulse, spin)
- Responsive layout
- Custom scrollbars

---

## API Reference

### Message Protocol

#### From Popup to Background

```javascript
// Fetch proxies
chrome.runtime.sendMessage({ action: 'fetchProxies' })
  .then(response => response.proxies);

// Set proxy
chrome.runtime.sendMessage({ 
  action: 'setProxy', 
  proxy: { ip, port, ipPort, country, type } 
});

// Clear proxy
chrome.runtime.sendMessage({ action: 'clearProxy' });

// Test proxy
chrome.runtime.sendMessage({ 
  action: 'testProxy', 
  proxy: proxyObject 
});
```

#### Response Format

```javascript
// Success
{ success: true, proxies: [...] }
{ success: true }

// Error
{ success: false, error: 'Error message' }
```

### Storage Schema

```javascript
// chrome.storage.local structure
{
  // Settings
  settings: {
    theme: 'dark' | 'light' | 'auto',
    autoFailover: boolean,
    testBeforeConnect: boolean,
    autoConnect: boolean,
    notifications: boolean,
    refreshInterval: number,      // milliseconds
    proxySource: 'proxymania' | 'proxyscrape',
    countryBlacklist: string[]     // country names to exclude
  },

  // Currently active proxy
  activeProxy: {
    ip: "192.168.1.1",
    port: 8080,
    ipPort: "192.168.1.1:8080",
    country: "Germany",
    type: "HTTPS",
    speed: "45 ms",
    lastCheck: "Recently",
    speedMs: 45
  },
  
  // Cached proxy list
  proxies: [/* array of proxy objects */],
  
  // Cache timestamp (milliseconds)
  proxiesTimestamp: 1234567890000,
  
  // Proxy statistics
  proxyStats: {
    "ip:port": {
      attempts: number,
      successes: number,
      failures: number,
      latencies: number[],
      successRate: number,
      avgLatency: number,
      lastSuccess: number,
      lastFailure: number
    }
  },
  
  // Favorites
  favorites: [/* array of favorite proxies */],
  
  // Recently used
  recentlyUsed: [{ proxy: Proxy, lastUsed: number }]
}
```

### Proxy Object Schema

```typescript
interface Proxy {
  ip: string;           // IP address only
  port: number;         // Port number
  ipPort: string;       // Combined "ip:port"
  country: string;      // Country name
  type: 'HTTPS' | 'SOCKS5' | 'SOCKS4';
  speed: string;        // Speed string (e.g., "45 ms")
  lastCheck: string;    // Last check time
  speedMs: number;      // Speed in milliseconds (parsed)
}
```

---

## Building & Testing

### Development Workflow

1. **Make Changes**
   - Edit files in your text editor
   - Changes are hot-reloaded in Chrome

2. **Reload Extension**
   - Go to `chrome://extensions/`
   - Find ProxyMania VPN
   - Click the refresh icon

3. **Test Functionality**
   - Click extension icon
   - Verify UI updates
   - Test proxy connection

### Building for Distribution

To create production-ready packages for distribution:

```bash
# Build both ZIP and CRX packages
npm run distribute

# Build ZIP only (for Chrome Web Store submission)
npm run distribute:zip

# Build CRX only (for sideloading/enterprise distribution)
npm run distribute:crx
```

**Output:** Packages are created in the `dist/` directory:
- `dist/proxy-vpn-extension.zip` (~100 KB) - For Chrome Web Store upload
- `dist/proxy-vpn-extension.crx` (~75 KB) - For direct installation

**What's excluded from distribution builds:**
- `node_modules/`
- `.git/`, `.github/`
- `tests/`
- `*.md` documentation files
- Build scripts (`build.js`, `distribute.js`, `distribute.sh`)
- `.gitignore`, `.gitattributes`
- `package-lock.json`

**CRX Signing:**
- The build script uses your existing `.pem` key for signing
- To rebuild CRX with updated source, install `crx3`: `npm install -g crx3`
- Without `crx3`, the existing CRX file is copied (may be outdated)

### Distribution Channels

| Package | Use Case | Upload/Install Location |
|---------|----------|------------------------|
| **ZIP** | Chrome Web Store | https://chrome.google.com/webstore/devconsole |
| **CRX** | Sideloading | `chrome://extensions/` (Developer mode) |
| **CRX** | Enterprise | Group Policy / MDM distribution |

### Testing Distribution Build

Before submitting to Chrome Web Store:

1. **Test the ZIP package:**
   ```bash
   npm run distribute:zip
   ```
   
2. **Load unpacked from ZIP:**
   - Extract the ZIP to a temporary folder
   - Load in Chrome via `chrome://extensions/` → "Load unpacked"
   - Verify all features work correctly

3. **Test the CRX package:**
   ```bash
   npm run distribute:crx
   ```
   
4. **Install CRX:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Drag and drop the CRX file
   - Verify installation and functionality

---

## Publishing to GitHub Releases

### Manual Release

To manually publish a release to GitHub:

```bash
# 1. Set your GitHub token
export GITHUB_TOKEN=ghp_...

# 2. Build and publish
npm run release

# Or create as draft for review
npm run release:draft
```

**Script options:**
```bash
node release.js --tag v1.0.0    # Specific version
node release.js --draft         # Create as draft
node release.js --prerelease    # Mark as prerelease
node release.js --no-latest     # Don't set as latest
```

**Required permissions:**
- GitHub token with `repo:public_repo` scope (or `repo` for private repos)
- Create at: https://github.com/settings/tokens

### Automated Releases (GitHub Actions)

Releases are automatically published when you push a version tag:

```bash
# 1. Update version in package.json
npm version patch  # or: minor, major, or specific version like 1.2.3

# 2. Commit and push with tags
git push --follow-tags
```

This triggers the `.github/workflows/release.yml` workflow which:
1. Checks out the code
2. Installs dependencies
3. Builds ZIP and CRX packages
4. Creates a GitHub release with the version tag
5. Uploads distribution packages as release assets

### Release Workflow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Update version │────▶│  Push tag to Git │────▶│ GitHub Actions  │
│  (npm version)  │     │  (git push)      │     │ (release.yml)   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Release Live   │◀────│  Upload Assets   │◀────│  Build & Create │
│  on GitHub      │     │  (ZIP + CRX)     │     │  Release        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Release Checklist

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` with changes
- [ ] Run tests: `npm test`
- [ ] Build distribution: `npm run distribute`
- [ ] Test built packages locally
- [ ] Commit changes: `git commit -am "chore: release v1.0.0"`
- [ ] Push with tags: `git push --follow-tags`
- [ ] Verify release on GitHub
- [ ] Share release notes with team/users

### Testing Checklist

- [ ] Extension loads without errors
- [ ] Proxies fetch successfully
- [ ] Country filter works
- [ ] Type filter works
- [ ] Connect to proxy works
- [ ] Disconnect works
- [ ] Status indicator updates
- [ ] Cache loads on reopen
- [ ] Proxy persists after browser restart

### Manual Testing Steps

```
1. Fresh Load Test
   - Clear extension storage
   - Open popup
   - Verify proxies load
   - Check cache is created

2. Connection Test
   - Select fastest proxy (✓)
   - Click Connect
   - Verify status changes
   - Visit whatismyip.com

3. Filter Test
   - Select country filter
   - Verify list updates
   - Select type filter
   - Verify combined filtering

4. Persistence Test
   - Connect to proxy
   - Close browser
   - Reopen browser
   - Verify proxy still active
```

---

## Debugging

### Console Access

**Popup Console:**
1. Right-click extension icon
2. Select "Inspect popup"
3. Use DevTools Console

**Background Console:**
1. Go to `chrome://extensions/`
2. Find ProxyMania VPN
3. Click "Inspect views: background page"
4. Use DevTools Console

### Common Debug Commands

```javascript
// Check storage contents
chrome.storage.local.get(null, console.log);

// Clear storage
chrome.storage.local.clear(() => console.log('Cleared'));

// Check proxy settings
chrome.proxy.settings.get({}, console.log);

// Send test message
chrome.runtime.sendMessage({ action: 'fetchProxies' }, console.log);
```

### Debug Mode in Code

Add logging to `popup.js`:

```javascript
const DEBUG = true;
function log(...args) {
  if (DEBUG) console.log('[Popup]', ...args);
}
```

### Common Issues & Solutions

| Issue | Debug Approach | Solution |
|-------|---------------|----------|
| Proxies don't load | Check background console | Verify ProxyMania URL |
| Connect fails | Check proxy.settings API | Verify proxy format |
| UI doesn't update | Check popup console | Verify DOM element IDs |
| Cache not working | Check storage | Verify storage permissions |

---

## Contributing

### Code Style

**JavaScript:**
- Use ES6+ features (async/await, arrow functions)
- Prefer `const` over `let`, avoid `var`
- Use template literals for strings
- Add JSDoc comments for functions

**CSS:**
- Use CSS variables for colors
- Follow BEM naming convention
- Keep specificity low

### Pull Request Process

1. **Fork the repository**
2. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature
   ```
3. **Make changes**
4. **Test thoroughly**
5. **Commit with clear messages**
   ```bash
   git commit -m "feat: add new filter option

Co-authored-by: Qwen-Coder <qwen-coder@alibabacloud.com>"
   ```
6. **Push and create PR**

### Commit Message Format

```
type: subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

### Adding New Features

**Example: Adding a speed filter**

1. **Update `popup.html`:**
```html
<select id="speedFilter">
  <option value="">All Speeds</option>
  <option value="100">< 100ms</option>
  <option value="300">< 300ms</option>
  <option value="500">< 500ms</option>
</select>
```

2. **Update `popup.js`:**
```javascript
const speedFilter = document.getElementById('speedFilter');
speedFilter.addEventListener('change', filterProxies);

function filterProxies() {
  // ... existing code ...
  const maxSpeed = parseInt(speedFilter.value);
  if (maxSpeed) {
    filtered = filtered.filter(p => p.speedMs < maxSpeed);
  }
}
```

3. **Update `styles.css`** if needed

4. **Test** the new feature

---

## Performance Considerations

### Optimization Tips

1. **Minimize DOM Manipulation**
   - Batch DOM updates
   - Use DocumentFragment for lists

2. **Efficient Caching**
   - Cache expires after 5 minutes
   - Show cache immediately, update in background

3. **Memory Management**
   - Clear event listeners on unload
   - Avoid global variables

### Current Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Initial load | < 3s | ~2s |
| Filter response | < 100ms | ~50ms |
| Connect time | < 2s | ~1s |
| Memory usage | < 50MB | ~20MB |
| Distribution ZIP | < 300KB | ~200KB |
| Distribution CRX | < 300KB | ~200KB |

---

## Security Considerations

### Best Practices Followed

- ✅ No external scripts loaded
- ✅ Minimal permissions requested
- ✅ No user data collection
- ✅ Local storage only
- ✅ HTTPS for external requests

### Security Review Checklist

- [ ] No eval() or innerHTML with user input
- [ ] CSP headers appropriate
- [ ] No sensitive data in storage
- [ ] Permissions are minimal
- [ ] External requests use HTTPS

---

## Resources

- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Proxy API](https://developer.chrome.com/docs/extensions/reference/proxy/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [crx3 Package](https://www.npmjs.com/package/crx3) - CRX builder

---

## Development Tools Reference

### npm Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build bundled modules |
| `npm run watch` | Watch mode for development |
| `npm run distribute` | Build ZIP + CRX packages |
| `npm run distribute:zip` | Build ZIP only (Chrome Web Store) |
| `npm run distribute:crx` | Build CRX only (sideloading) |
| `npm run release` | Publish to GitHub Releases |
| `npm run release:draft` | Create draft release |
| `npm run release:prerelease` | Create prerelease |
| `npm test` | Run tests |
| `npm run lint` | Run linter |

### Distribution Files

After running `npm run distribute`:

```
dist/
├── proxy-vpn-extension.zip    # ~200KB - Chrome Web Store
└── proxy-vpn-extension.crx    # ~200KB - Direct installation
```

### Environment Variables

| Variable | Description | Required For |
|----------|-------------|--------------|
| `GITHUB_TOKEN` | GitHub personal access token | Manual releases |
| `GITHUB_OWNER` | GitHub username/org | Optional (auto-detected) |
| `GITHUB_REPO` | Repository name | Optional (auto-detected) |
| `GITHUB_REPOSITORY` | Full repo path (owner/repo) | GitHub Actions |

---

## Support

For development questions:
1. Check this guide
2. Review Chrome's documentation
3. Check existing issues/PRs

Happy coding! 🚀
