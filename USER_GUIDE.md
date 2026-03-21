# User Guide - PeasyProxy - Smart Proxy Router

Welcome to the PeasyProxy Smart Proxy Router user guide. This document provides detailed instructions for using the extension effectively.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Advanced Features](#advanced-features)
4. [Tips & Best Practices](#tips--best-practices)
5. [FAQ](#faq)
6. [Safety Guidelines](#safety-guidelines)

---

## Getting Started

### First-Time Setup

1. **Install the Extension**
   - Follow the installation instructions in README.md
   - The extension icon (🛡️) will appear in your Chrome toolbar

2. **Initial Launch**
   - Click the extension icon
   - Wait for the proxy list to load (usually 2-5 seconds)
   - You'll see a list of available proxies with their details

### Understanding the Interface

```
┌─────────────────────────────────────┐
│  ⚠️ Security Notice           [X]  │  <- Security Banner
├─────────────────────────────────────┤
│  🛡️ PeasyProxy          ⚙️    ⋮    │  <- Header
├─────────────────────────────────────┤
│  ● Disconnected           [Connect] │  <- Connection Card
│  ── Details ▼                     │  <- Collapsible
│    🌐 Offline  🔒 Secure           │
├─────────────────────────────────────┤
│  🔍 Search...                    /  │  <- Search
│  [All] [⭐] [🕐]                  │  <- Tabs
│  [All] [Best] [Fast] [🟢] [HTTPS] │  <- Filters
├─────────────────────────────────────┤
│  Quick Connect ▼                    │
├─────────────────────────────────────┤
│  Available Proxies            [150] │  <- Header
│  ┌─────────────────────────────┐   │
│  │ 🇺🇸 192.168.1.1 🟢⭐      │   │
│  │ USA • HTTPS • 45ms • ✓    │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## Basic Usage

### Connecting to a Proxy

1. **Open the Extension**
   - Click the 🛡️ icon in your toolbar

2. **Browse Available Proxies**
   - Scroll through the list
   - Proxies are sorted by speed (fastest first)

3. **Select a Proxy**
   - Look for proxies with ✓ (green checkmark)
   - These were verified within the last 3 minutes

4. **Click Connect**
   - Click the "Connect" button
   - Button changes to "Connected" (green)
   - Status indicator at top turns green

5. **Verify Connection**
   - Status shows "Connected"
   - Current proxy IP is displayed
   - Browse normally - traffic routes through proxy

### Disconnecting

1. **Open the Extension**
2. **Click "Disconnect"** (red button)
3. **Status changes to "Disconnected"**
4. **Normal browsing resumes**

### Refreshing Proxy List

- Click "🔄 Refresh Proxies" button
- List updates with latest available proxies
- Recommended if current proxy stops working

---

## Advanced Features

### Filtering by Country

1. Click the **Country dropdown**
2. Select a specific country (e.g., "Germany", "USA")
3. List shows only proxies from that country
4. Select "" to show all countries

**Available Countries** (varies based on PeasyProxy's list):
- USA, Germany, France, UK
- China, Japan, South Korea
- Brazil, Argentina
- And many more...

### Filtering by Type

1. Click the **Type dropdown**
2. Choose:
   - **HTTPS** - Secure HTTP proxy (recommended for web browsing)
   - **SOCKS5** - General purpose proxy (supports all TCP/UDP)
  3. List filters to show only selected type

### Choosing Proxy Source

1. Go to **Settings** (⚙️ button)
2. Find **Connection** section
3. Select **Proxy Source**:
   - **PeasyProxy** - Default source, good variety
   - **ProxyScrape** - Alternative source with different proxies

### Country Blacklist

Exclude countries you don't want to use:

1. Go to **Settings** → **Advanced Features**
2. Click **Manage** next to "Country Blacklist"
3. Use dropdown to add countries
4. Click × to remove from blacklist

Blacklisted countries are filtered from all proxy lists.

### Understanding Proxy Information

| Field | Description |
|-------|-------------|
| **IP:Port** | Proxy server address |
| **🌍 Country** | Server location |
| **Type** | Protocol (HTTPS/SOCKS5) |
| **⚡ Speed** | Response time in milliseconds |
| **✓ / ⚠** | Health status indicator |

### Status Indicators

| Symbol | Color | Meaning |
|--------|-------|---------|
| ✓ | Green | Verified < 3 minutes ago - **Recommended** |
| ⚠ | Yellow | Verified > 3 minutes ago - May be unstable |
| 🟢 | Green badge | Trusted proxy (score 70+) |
| 🟡 | Yellow badge | Unverified proxy (score 40-69) |
| 🔴 | Red badge | Risky proxy (score < 40) |
| (none) | — | No verification data available |

---

## Tips & Best Practices

### Choosing the Best Proxy

1. **Look for the ✓ indicator** - Recently verified proxies work best
2. **Lower speed number = faster** - 50ms is better than 500ms
3. **Choose nearby countries** - Less latency, better speeds
4. **HTTPS for browsing** - More compatible with websites

### When Proxy Stops Working

Free proxies can go offline unexpectedly. If browsing fails:

1. **Try another proxy** - Select one with lower speed rating
2. **Refresh the list** - Click "🔄 Refresh Proxies"
3. **Switch countries** - Some regions have more stable proxies
4. **Disconnect temporarily** - Use direct connection if needed

### Performance Tips

| Goal | Recommendation |
|------|----------------|
| Maximum speed | Choose proxy < 100ms |
| Streaming | Use HTTPS proxies only |
| Downloads | Pick proxies with < 200ms latency |
| General browsing | Any ✓ marked proxy works |

### Cache Behavior

- **First load**: Fetches fresh data from PeasyProxy
- **Subsequent loads**: Shows cached data immediately
- **Auto-refresh**: Updates cache in background
- **Benefit**: Faster popup opening

---

## FAQ

### General Questions

**Q: Is this extension free?**
A: Yes, completely free. It uses publicly available proxies from PeasyProxy and ProxyScrape.

**Q: Do I need to create an account?**
A: No account required. Install and use immediately.

**Q: Will this slow down my internet?**
A: Possibly. Free proxies are often slower than direct connections. Choose low-latency proxies for best results.

**Q: Can I use this for Netflix/streaming?**
A: Free proxies rarely work with streaming services. This extension is designed for basic web browsing.

**Q: How do I change proxy source?**
A: Go to Settings → Connection → Proxy Source. Choose PeasyProxy or ProxyScrape.

### Technical Questions

**Q: How do I know if the proxy is working?**
A: Visit a site like whatismyip.com - it should show the proxy's IP, not yours.

**Q: Why do some websites not load?**
A: Some websites block known proxy IPs. Try a different proxy or disconnect.

**Q: Does this work on all websites?**
A: Most websites work, but some block proxy traffic. Banking sites may not work.

**Q: Can I use this with other extensions?**
A: Yes, but other proxy/VPN extensions may conflict. Use only one at a time.

### Troubleshooting

**Q: "Failed to load proxies"**
A: Check your internet connection. Click "Refresh Proxies" to retry.

**Q: Proxy connects but pages don't load**
A: The proxy may be offline. Disconnect and try another proxy.

**Q: Extension icon disappeared**
A: Go to `chrome://extensions/` and reload the extension.

**Q: Settings don't save after restart**
A: This shouldn't happen. Try reinstalling the extension.

---

## Safety Guidelines

### ⚠️ What NOT to Do

**Never use free proxies for:**

- 🏦 **Online Banking** - Risk of credential theft
- 💳 **Credit Card Transactions** - Card details could be intercepted
- 📧 **Email Login** - Passwords could be captured
- 🔐 **Sensitive Accounts** - Social media, cloud storage
- 🏥 **Medical/Health Portals** - Personal health data at risk
- 📄 **Legal/Government Sites** - Sensitive personal information

### ✅ Safe Uses

Free proxies are generally okay for:

- 📰 Reading news articles
- 🌐 General web browsing
- 🔍 Search engine queries
- 📖 Reading public content
- 🎮 Non-sensitive gaming

### Best Practices

1. **Use HTTPS websites** - Look for the padlock icon
2. **Log out when done** - Don't stay logged into accounts
3. **Clear cookies** - After sensitive sessions
4. **Disconnect for sensitive tasks** - Turn off proxy for banking, etc.
5. **Don't download files** - Through untrusted proxies

### Understanding the Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| Data interception | Proxy operator could see traffic | Use HTTPS only |
| Malicious proxy | Proxy could inject content | Stick to verified (✓) proxies |
| IP logging | Your real IP could be logged | Accept this is possible |
| Slow speeds | Free proxies are often slow | Choose low-latency options |

---

## Quick Reference Card

### Connection Steps
```
1. Click icon → 2. Choose proxy → 3. Click Connect → 4. Done!
```

### Disconnection Steps
```
1. Click icon → 2. Click Disconnect → 3. Done!
```

### When Things Go Wrong
```
Not working? → Try different proxy → Still broken? → Refresh list
```

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open extension | `Alt + Shift + P` (customizable) |
| Open extensions menu | `Alt + Shift + E` |

---

## Support

For issues or questions:

1. Check this guide first
2. Review the troubleshooting section in README.md
3. Check Chrome's console for errors (F12)

---

**Remember**: This is a free service using community-provided proxies. Performance and availability vary. Use responsibly and safely!
