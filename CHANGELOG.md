# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.18] - 2026-03-21

### Changed
- **Rebranding**: Renamed project from "ProxyMania" to "PeasyProxy" across all components
- Updated Android app package name from `com.proxymania.app` to `com.peasyproxy.app`
- Renamed Android classes:
  - `ProxyManiaApp` → `PeasyProxyApp`
  - `ProxyManiaDatabase` → `PeasyProxyDatabase`
  - `ProxyManiaWidgetProvider` → `PeasyProxyWidgetProvider`
- Updated Android applicationId and namespace to `com.peasyproxy.app`
- Updated APK names to `peasyproxy-android-debug.apk` and `peasyproxy-android-release-unsigned.apk`
- Updated all documentation files (README, API, ANDROID, ARCHITECTURE, DEVELOPER_GUIDE, RELEASE_GUIDE)
- Updated GitHub Actions workflow with PeasyProxy branding
- Updated popup.html and UI with PeasyProxy branding
- Updated i18n messages (English and Russian) with PeasyProxy references

### Note
- External URL `proxymania.su` has been preserved as-is since it's the actual proxy source service endpoint
- Function names like `fetchProxyMania`, `parseProxyMania` were intentionally preserved to maintain API compatibility

## [3.0.17] - 2026-03-20

### Added
- WebRTC blocker content script for IP leak prevention
- Enhanced proxy validation with certificate checking
- Improved error handling for network failures

### Fixed
- Fixed proxy connection timeout handling
- Fixed memory leak in health monitoring
- Fixed UI refresh issue when switching tabs

## [3.0.16] - 2026-03-19

### Added
- Reputation engine for proxy trust scoring
- Tamper detection for MITM attack prevention
- Country blacklist feature

### Changed
- Improved proxy filtering with multiple criteria
- Enhanced virtual scrolling performance

### Fixed
- Fixed proxy list not updating after refresh
- Fixed settings not persisting after browser restart

## [3.0.15] - 2026-03-18

### Added
- Auto-rotation feature for automatic proxy switching
- Health monitoring with 30-second intervals
- Connection quality indicators

### Changed
- Updated proxy scoring algorithm
- Improved failover mechanism

### Fixed
- Fixed connection timer not resetting on disconnect
- Fixed country filter not working correctly

## [3.0.14] - 2026-03-17

### Added
- Per-site proxy rules with pattern matching
- Import/Export functionality for proxy lists
- Statistics dashboard with connection history

### Changed
- Enhanced proxy caching with 5-minute TTL
- Improved search functionality

### Fixed
- Fixed duplicate proxies in list
- Fixed favorites not saving correctly

## [3.0.13] - 2026-03-16

### Added
- Multiple proxy source support (PeasyProxy, ProxyScrape)
- Country filter with flag emojis
- Quick Connect feature for fastest proxies

### Changed
- Redesigned UI with modern styling
- Improved accessibility with ARIA labels

### Fixed
- Fixed proxy loading timeout
- Fixed filter chips not responding

## [3.0.12] - 2026-03-15

### Added
- Favorites system for bookmarking proxies
- Recently used proxies history
- Keyboard shortcuts for quick actions

### Changed
- Optimized proxy list rendering
- Enhanced error messages

### Fixed
- Fixed theme not persisting
- Fixed proxy count display

## [3.0.11] - 2026-03-14

### Added
- Dark/Light theme toggle
- Russian language support (i18n)
- Connection timer display

### Changed
- Improved proxy sorting algorithm
- Enhanced toast notifications

### Fixed
- Fixed storage quota issues
- Fixed popup layout on small screens

## [3.0.10] - 2026-03-13

### Added
- Proxy testing before connection
- Auto-failover on connection failure
- Live proxy health monitoring

### Changed
- Updated manifest to V3
- Improved service worker performance

### Fixed
- Fixed proxy connection drops
- Fixed memory usage issues

## [3.0.9] - 2026-03-12

### Added
- Smart proxy scoring algorithm
- Success rate tracking per proxy
- Visual latency indicators

### Changed
- Enhanced proxy information display
- Improved filtering performance

### Fixed
- Fixed incorrect proxy speeds
- Fixed sorting not working

## [3.0.8] - 2026-03-11

### Added
- Country-based proxy filtering
- Type filtering (HTTPS/SOCKS5)
- Speed-based filtering

### Changed
- Redesigned filter interface
- Improved proxy list organization

### Fixed
- Fixed filter reset on refresh
- Fixed dropdown styling issues

## [3.0.7] - 2026-03-10

### Added
- Proxy caching with 5-minute TTL
- Offline mode with cached proxies
- Auto-refresh on popup open

### Changed
- Optimized storage usage
- Reduced network requests

### Fixed
- Fixed slow popup loading
- Fixed cache expiration logic

## [3.0.6] - 2026-03-09

### Added
- Connection status indicator
- Current proxy display
- Disconnect functionality

### Changed
- Improved UI responsiveness
- Enhanced button states

### Fixed
- Fixed connection state not updating
- Fixed status badge colors

## [3.0.5] - 2026-03-08

### Added
- Basic proxy connection
- Proxy list display
- Simple filtering

### Changed
- Initial Chrome extension structure
- Basic popup UI

### Fixed
- Initial release with core functionality

## [1.0.0] - 2026-03-01

### Added
- Initial release of PeasyProxy Chrome extension
- Basic proxy management functionality
- ProxyMania integration for proxy list