# PeasyProxy Android - Documentation

## Table of Contents
1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Features](#features)
5. [Architecture](#architecture)
6. [API Reference](#api-reference)
7. [Settings](#settings)
8. [Troubleshooting](#troubleshooting)
9. [Build](#build)

---

## Overview

**PeasyProxy** is a system-wide VPN/proxy manager for Android that routes all device traffic through rotating proxy servers. Unlike browser extensions, PeasyProxy provides complete device-wide privacy and anonymity.

### Key Features
- System-wide proxy routing
- Multiple proxy source integration
- Smart proxy selection with reputation scoring
- Auto-failover on connection loss
- Split tunneling support
- Real-time connection statistics

---

## Installation

### Requirements
- Android 8.0 (Oreo) or higher
- ~30MB storage space

### Installation Steps
1. Enable "Install from unknown sources" in device settings
2. Download `peasyproxy-android-debug.apk` from `dist/` folder
3. Open APK file and tap "Install"
4. Grant VPN permission when prompted

---

## Quick Start

1. **First Launch**: App will request VPN permission → Tap "Allow"
2. **Quick Connect**: Tap "Quick Connect" on home screen
3. **Select Proxy**: App automatically picks best proxy
4. **Connection**: Wait for "Connected" status

---

## Features

### Connection Management
| Feature | Description |
|---------|-------------|
| Quick Connect | Auto-select fastest proxy |
| Manual Selection | Browse and pick specific proxy |
| Auto-Rotate | Periodically change proxy |
| Failover | Auto-switch on connection loss |

### Proxy Sources
- **PeasyProxy** - Free proxy list
- **ProxyScrape** - Premium proxy API

### Reputation System
Scoring algorithm based on:
- **Speed (40%)** - Connection latency
- **Reliability (35%)** - Historical uptime
- **Trust (25%)** - Source verification
- **Freshness (10%)** - Last checked time

### Split Tunneling
Route specific apps through VPN or bypass it:
- **Include Mode**: Only selected apps use VPN
- **Exclude Mode**: Selected apps bypass VPN
- **Category Bundles**: Streaming, Social, Banking apps

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                            │
│  HomeScreen │ ProxyListScreen │ SettingsScreen │ etc.       │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    ViewModel Layer                           │
│  HomeViewModel │ ProxyListViewModel │ SettingsViewModel      │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                   Repository Layer                           │
│  ProxyRepository │ SettingsRepository │ StatisticsRepository │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    Service Layer                             │
│  VpnService │ VpnController │ PacketProcessor │ etc.        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     Data Layer                               │
│  Room Database │ DataStore Preferences │ OkHttp            │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Purpose |
|-----------|---------|
| `VpnService` | Android VPN API implementation |
| `VpnController` | Protocol handlers (HTTP/SOCKS4/SOCKS5) |
| `PacketProcessor` | Packet routing and processing |
| `ProxyRepository` | Proxy data management |
| `HealthWorker` | Periodic connection health checks |

### Supported Protocols
- HTTP
- HTTPS (HTTP CONNECT)
- SOCKS4
- SOCKS5 (with auth)

### Data Storage
- **Room Database**: Proxies, connection logs, statistics
- **DataStore Preferences**: Settings, VPN state
- **In-memory Cache**: Active proxy list (5-min TTL)

---

## API Reference

### Domain Models

```kotlin
data class Proxy(
    val id: String,
    val host: String,
    val port: Int,
    val protocol: ProxyProtocol,
    val username: String? = null,
    val password: String? = null,
    val country: String? = null,
    val countryCode: String? = null,
    val latency: Long = 0,
    val reliability: Float = 0f,
    val trustScore: Int = 0,
    val lastChecked: Long = 0,
    val isFavorite: Boolean = false
)

enum class ProxyProtocol {
    HTTP, HTTPS, SOCKS4, SOCKS5
}
```

### AppSettings

```kotlin
data class AppSettings(
    val autoConnectOnStart: Boolean = false,
    val autoReconnect: Boolean = true,
    val failoverEnabled: Boolean = true,
    val killSwitchEnabled: Boolean = false,
    val autoRotateEnabled: Boolean = false,
    val autoRotateIntervalMinutes: Int = 15,
    val rotationStrategy: RotationStrategy = RotationStrategy.FASTEST,
    val connectionTimeout: Int = 5000,
    val darkMode: DarkMode = DarkMode.SYSTEM
)

enum class DarkMode { LIGHT, DARK, AMOLED, SYSTEM }
```

### Key Services

#### VpnService
```kotlin
@AndroidEntryPoint
class VpnService : VpnService() {
    @Inject lateinit var vpnController: VpnController
    
    val connectionInfo: StateFlow<ConnectionInfo>
}
```

#### ProxyRepository
```kotlin
@Singleton
class ProxyRepository @Inject constructor(
    private val proxyDao: ProxyDao,
    private val proxyFetcher: ProxyFetcher,
    private val proxyTester: ProxyTester
) {
    fun getAllProxies(): Flow<List<Proxy>>
    fun getFavoriteProxies(): Flow<List<Proxy>>
    suspend fun fetchAndSaveProxies(forceRefresh: Boolean): Result<List<Proxy>>
    suspend fun testProxy(proxy: Proxy): ProxyTestResult
}
```

---

## Settings Reference

### Connection Settings
| Setting | Default | Description |
|---------|---------|-------------|
| Auto-connect on start | Off | Connect when app opens |
| Auto-reconnect | On | Reconnect on disconnect |
| Failover | On | Switch proxies on failure |
| Kill switch | Off | Block traffic on disconnect |
| Auto-rotate | Off | Periodically change proxy |
| Rotate interval | 15 min | Time between rotations |
| Timeout | 5s | Connection timeout |

### Appearance Settings
| Setting | Default | Description |
|---------|---------|-------------|
| Theme | System | Light/Dark/AMOLED/System |

### DNS Settings
| Setting | Default | Description |
|---------|---------|-------------|
| Custom DNS | Off | Use custom DNS servers |
| Primary DNS | 8.8.8.8 | Google DNS |
| Secondary DNS | 8.8.4.4 | Google DNS |

---

## Troubleshooting

### Common Issues

#### "VPN permission denied"
- Go to Settings → Apps → PeasyProxy → Permissions
- Enable VPN permission

#### "No proxies available"
- Pull down to refresh proxy list
- Check internet connection
- Try manual proxy entry in Import/Export

#### "Connection timeout"
- Increase timeout in Settings → Advanced
- Try different proxy
- Check firewall settings

#### "Kill switch not working"
- Ensure VPN is connected
- Check system notification permissions
- Verify kill switch is enabled in settings

### Logs
- App logs: Run `adb logcat -s PeasyProxy:*`
- Crash reports: Firebase Crashlytics (when configured)

---

## Build

### Debug Build
```bash
./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

### Release Build
```bash
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release-unsigned.apk
```

### Build and Copy to Dist
```bash
./gradlew copyToDist          # Debug APK -> dist/peasyproxy-android-debug.apk
./gradlew copyReleaseToDist  # Release APK -> dist/peasyproxy-android-release-unsigned.apk
```

### Tests
```bash
./gradlew test                              # Unit tests
./gradlew connectedAndroidTest              # Instrumented tests
```

---

## Privacy & Security

### Data Collection
- Proxy metadata (no passwords stored)
- Connection statistics
- Error logs (anonymized)

### Security Features
- No logging of browsing activity
- DNS leak protection via VPN tunnel
- Proxy authentication encrypted
- Certificate pinning ready

---

## Support

- GitHub Issues: Report bugs/features
- Email: support@peasyproxy.app
