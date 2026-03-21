# Rebranding Plan: PeasyProxy → PeasyProxy

## Overview

This document outlines the plan to rename the project from "PeasyProxy VPN" / "PeasyProxy" to "PeasyProxy" across both the Chrome extension and Android app.

---

## Important Considerations

### ⚠️ DO NOT Change

The following should remain unchanged as they are external URLs or technical identifiers:

- `peasyproxy.su` - External proxy source URL
- `https://proxymania.su/*` - Host permissions in manifest.json
- `peasyproxy.su/free-proxy` - API endpoint URLs
- Package names in `package.json` (npm package names)
- GitHub repository URLs
- External API endpoints

### ✅ DO Change

The following should be updated to "PeasyProxy":

- Extension display name
- Extension description
- User-facing strings
- Documentation references
- Branding elements (logo text, headers)
- Comments and code documentation

---

## Chrome Extension Changes

### 1. Manifest & Configuration Files

#### `manifest.json`
- Change `name` from `"__MSG_extension_name__"` (resolves to "PeasyProxy - Smart Proxy Router")
- Update `description` to reflect new branding

#### `package.json`
- Update `name` field (if not using npm package name)
- Update `description` field

#### `_locales/en/messages.json`
- Update `extension_name` message
- Update `extension_description` message
- Update any other user-facing strings containing "PeasyProxy"

#### `_locales/ru/messages.json`
- Update Russian translations similarly

### 2. Source Code Files

#### `popup.html`
- Update `<title>` tag
- Update logo text "PeasyProxy"
- Update any user-facing text

#### `popup.js` (bundled from popup-modules)
- Update toast messages containing "PeasyProxy"
- Update console.log messages
- Update any user-facing strings

#### `src/popup-modules/*.js`
- Update console.log messages
- Update user-facing strings in UI rendering
- Update onboarding text

#### `src/background/*.js`
- Update console.log messages
- Update any user-facing error messages

#### `styles.css`
- Update any CSS comments referencing "PeasyProxy"
- Update logo styling if text-based

### 3. Documentation Files

#### `README.md`
- Update title and all references
- Update badges
- Update description

#### `ARCHITECTURE.md`
- Update title and references

#### `API.md`
- Update title and references

#### `USER_GUIDE.md`
- Update title and all user-facing references

#### `DEVELOPER_GUIDE.md`
- Update title and references

#### Other `.md` files
- Update all documentation files

### 4. Build & Distribution

#### `distribute.js`
- Update ZIP filename: `peasyproxy.zip`
- Update CRX filename: `peasyproxy.crx`
- Update console messages

#### `build.js`
- Update any branding in build messages

---

## Android App Changes

### 1. Configuration Files

#### `app/build.gradle.kts`
- Update `applicationId` (if appropriate)
- Update `appName` resource reference

#### `settings.gradle.kts`
- Update project name reference

#### `gradle.properties`
- Update any branding-related properties

### 2. Source Code

#### `app/src/main/java/com/peasyproxy/app/PeasyProxyApp.kt`
- Rename file to `PeasyProxyApp.kt`
- Rename class to `PeasyProxyApp`
- Update package if needed

#### Android Manifest
- Update `android:label` app name
- Update `android:description`

#### Resource Files
- `res/values/strings.xml` - Update app name
- `res/values-ru/strings.xml` - Update Russian translations

#### Layout Files
- Update any hardcoded "PeasyProxy" text

#### Kotlin/Java Files
- Update class names containing "PeasyProxy"
- Update string references
- Update comments

### 3. Documentation

#### `ANDROID.md`
- Update all references to new branding

---

## Implementation Order

### Phase 1: Core Branding (High Priority)

1. **Chrome Extension User-Facing**
   - [ ] Update `manifest.json` name and description
   - [ ] Update `_locales/en/messages.json`
   - [ ] Update `_locales/ru/messages.json`
   - [ ] Update `popup.html` title and logo
   - [ ] Update `distribute.js` filenames

2. **Android App User-Facing**
   - [ ] Update `strings.xml` (EN)
   - [ ] Update `strings.xml` (RU)
   - [ ] Update Android Manifest label
   - [ ] Update app name in build config

### Phase 2: Documentation (Medium Priority)

3. **Chrome Extension Docs**
   - [ ] Update `README.md`
   - [ ] Update `ARCHITECTURE.md`
   - [ ] Update `API.md`
   - [ ] Update `USER_GUIDE.md`
   - [ ] Update `DEVELOPER_GUIDE.md`

4. **Android Docs**
   - [ ] Update `ANDROID.md`

### Phase 3: Code Cleanup (Low Priority)

5. **Chrome Extension Code**
   - [ ] Update console.log messages
   - [ ] Update code comments
   - [ ] Update variable names (if any contain "peasyproxy")

6. **Android Code**
   - [ ] Rename Kotlin files if needed
   - [ ] Update class names
   - [ ] Update package names (if desired)

---

## Search Patterns

### Patterns to REPLACE

```regex
# Branding (case-insensitive)
PeasyProxy
peasyproxy (when used as branding, not URL)
PEASYPROXY

# In user-facing strings only
PeasyProxy VPN
Smart Proxy Router (if rebranding tagline)
```

### Patterns to KEEP (Do NOT Replace)

```regex
# External URLs
peasyproxy\.su
https://peasyproxy\.su

# npm package names
peasyproxy-extension

# GitHub URLs
github\.com.*peasyproxy
```

---

## Testing Checklist

After renaming, verify:

- [ ] Extension loads without errors
- [ ] New name appears in Chrome extensions list
- [ ] Popup displays new branding
- [ ] All user-facing text shows new name
- [ ] No broken links to external peasyproxy.su
- [ ] Android app builds successfully
- [ ] Android app displays new name
- [ ] Documentation is consistent
- [ ] Build scripts produce correctly named files

---

## Rollback Plan

If issues arise:

1. Revert to previous commit
2. Rebuild both projects
3. Test functionality
4. Re-attempt with fixes

---

## Notes

- The rebranding is primarily cosmetic
- Core functionality should remain unchanged
- External URLs (peasyproxy.su) must continue working
- Consider user communication about rebranding
- Update any marketing materials or website references

---

**Document Version:** 1.0  
**Created:** March 21, 2026  
**Status:** Ready for Implementation