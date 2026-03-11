# Changelog

All notable changes to ProxyMania VPN Chrome Extension are documented in this file.

---

## [2.1.0] - 2024-03-11 - UI Refactoring & Bug Fixes

### ⚠️ Important Update

This release includes significant UI refactoring and bug fixes for Chrome MV3 compatibility.

### Added

- **Modern SVG Icons** - Replaced emoji icons with professional Heroicons-style SVG icons
- **Complete UI Overhaul** - New card-based layout with slide-in panels
- **Test Status Display** - Visual feedback during proxy testing phase
- **Monitoring Status Indicator** - Shows when proxy health is being monitored
- **Recommended Section** - Displays top 3 recommended proxies

### Fixed

- **Chrome MV3 Compatibility** - Replaced setInterval with chrome.alarms in service worker
- **DOMParser Error** - Fixed DOMParser not available in service worker (switched to regex parsing)
- **Null Reference Errors** - Added null guards for DOM elements that may not exist
- **Speed Graph Bug** - Fixed speed graph clearing proxy connection every 2 seconds (added quickTest action)
- **Onboarding Bug** - Fixed onboarding showing every time (now saves state to storage)
- **Double Disconnect Button** - Fixed duplicate disconnect buttons showing after connection

### Technical Changes

#### New Storage Keys
```javascript
{
  onboardingState: { completed: boolean, currentStepIndex: number, version: string },
  healthStatus: { active: boolean, quality: string, avgLatency: number, lastCheck: Date }
}
```

#### Null Safety Improvements
All DOM element references now use optional chaining (?.) or explicit null checks to prevent TypeErrors during initialization.

---

## [2.0.0] - 2024-03-11 - Complete Implementation

### 🎉 All Phases Complete!

This major release includes all planned features from Phases 1-5.

### Added

#### Phase 3: UI/UX Polish
- **Dark/Light Theme Toggle** - Full theming system with CSS variables
- **Settings Panel** - Full-screen settings with organized sections
- **Filter Chips** - Visual chip-based speed/type filtering
- **Connection Animations** - Pulse effects, slide-in, button pop
- **Professional Styling** - Gradients, shadows, smooth transitions
- **Auto-Refresh Timer** - Configurable proxy list refresh

#### Phase 4: Advanced Features
- **Statistics Dashboard** - Daily usage statistics panel
  - Proxies used today
  - Total connection time
  - Success rate percentage
  - Top countries display
  - Connection history
- **Import Proxies** - Import from JSON or TXT files
- **Export Proxies** - Export working proxies (>50% success rate)
- **Clear All Data** - Reset extension settings
- **Enhanced Notifications** - Configurable toast system

#### Phase 5: Premium Features
- **Premium UI Styling** - Complete visual polish
- **Stats Panel Ready** - Infrastructure for leak tests
- **Per-Tab Infrastructure** - Foundation for per-tab settings

### Changed

#### UI Improvements
- Increased popup width to 420px
- Added header action buttons (🌙 Theme, 📊 Stats, ⭐ Favorites, ⚙️ Settings)
- Replaced dropdown filters with visual chips
- Enhanced status section with better visual hierarchy
- Improved loading skeleton animations
- Better empty state messaging

#### Settings System
- Theme: Dark / Light / Auto
- Auto-Refresh: 1min / 5min / 10min / Disabled
- Auto-Failover: Toggle on/off
- Test Before Connect: Toggle on/off
- Notifications: Toggle on/off

#### Statistics Tracking
- Daily stats reset at midnight
- Tracks proxies used, connection time, success rate
- Shows top countries by usage
- Displays connection history with details

### Technical Changes

#### New Storage Keys
```javascript
{
  settings: { ... },      // User preferences
  dailyStats: { ... },    // Daily usage stats
  statsDate: string       // Date of current stats
}
```

#### New Functions
- `loadSettings()` / `saveSettings()` - Settings management
- `applyTheme()` - Apply theme to document
- `toggleTheme()` - Switch between themes
- `showPanel()` / `hidePanel()` - Panel management
- `updateStatsDisplay()` - Update statistics UI
- `loadDailyStats()` / `updateDailyStats()` - Daily stats
- `importProxies()` / `exportProxies()` - Data management
- `clearAllData()` - Reset extension
- `startAutoRefresh()` - Auto-refresh timer

#### CSS Variables
- Complete theming system with 20+ CSS variables
- Light and dark theme definitions
- Consistent color palette
- Shadow definitions (sm, md, lg)

### File Changes

| File | Lines | Change |
|------|-------|--------|
| `popup.html` | 267 | +147 (panels, chips, buttons) |
| `popup.js` | 865 | +350 (settings, stats, import/export) |
| `styles.css` | 902 | +450 (themes, panels, animations) |
| `background.js` | 450 | No change |

---

## [1.2.0] - 2024-03-11 - Phase 2 Complete

### Added

#### Auto-Failover System
- Automatic proxy switching on failure
- Failover queue with backup proxies
- Up to 3 automatic retry attempts
- User notification during failover

#### Success Rate Tracking
- Tracks connection attempts per proxy
- Calculates success rate percentage
- Stores last 20 latency readings
- Displays success rate in UI

#### Proxy Favorites
- Star/unstar any proxy
- Dedicated Favorites tab
- Favorite bonus in scoring

#### Response Time Monitoring
- Continuous monitoring every 30 seconds
- Detects latency spikes
- Real-time degradation alerts

#### Smart Recommendations
- AI-powered scoring algorithm
- Recommended section with top 3
- Gold-themed recommendation cards

#### Latency Sparklines
- Visual latency trends
- SVG charts in proxy list
- Color-coded by latency

#### Tab Navigation
- All Proxies / Favorites / Recent tabs
- Smooth transitions
- Context-aware empty states

---

## [1.1.0] - 2024-03-11 - Phase 1 Complete

### Added

- Real proxy connectivity testing
- Connection timer (MM:SS format)
- Country flags (100+ countries)
- Quick Connect (4 fastest proxies)
- Recently Used proxies (last 10)
- Skeleton loading animations
- Contextual empty states
- Toast notifications

---

## [1.0.1] - 2024-03-10 - Bug Fixes

### Fixed
- CORS issue (moved fetch to background)
- Implicit event variable
- Port validation

### Removed
- Unused `webRequest` permission
- Unused `.btn-primary` CSS class

---

## [1.0.0] - 2024-03-10 - Initial Release

### Added
- Basic proxy fetching and display
- Connect/disconnect functionality
- Country and type filters
- Auto-restore on restart

---

## Version Summary

| Version | Date | Features | Lines of Code |
|---------|------|----------|---------------|
| 2.0.0 | 2024-03-11 | All Phases | 2,484 |
| 1.2.0 | 2024-03-11 | Phase 2 | 1,850 |
| 1.1.0 | 2024-03-11 | Phase 1 | 1,400 |
| 1.0.1 | 2024-03-10 | Fixes | 1,200 |
| 1.0.0 | 2024-03-10 | Initial | 1,000 |

---

## Upgrade Guide

### From 1.x to 2.0.0

**Storage Migration:**
- New `settings` object created automatically
- New `dailyStats` object created automatically
- All existing data preserved

**New Features Available:**
1. Click 🌙 to toggle theme
2. Click 📊 to view statistics
3. Click ⚙️ to access settings
4. Use filter chips for quick filtering
5. Import/Export via settings panel

**No manual migration needed.** Backward compatible.

---

## Known Issues

### Current Version (2.0.0)

| Issue | Status | Workaround |
|-------|--------|------------|
| Free proxies unstable | Inherent | Use recommended proxies |
| Some sites block proxies | Inherent | Try different proxy |
| Monitoring may timeout | Rare | Reconnect if occurs |

---

## Migration Notes

### Storage Schema Evolution

**v1.0.0:**
```javascript
{ activeProxy, proxies, proxiesTimestamp }
```

**v1.2.0 (Added):**
```javascript
{ favorites, proxyStats, recentlyUsed }
```

**v2.0.0 (Added):**
```javascript
{ settings, dailyStats, statsDate }
```

All schemas are backward compatible.

---

For more information:
- [README.md](README.md)
- [USER_GUIDE.md](USER_GUIDE.md)
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
