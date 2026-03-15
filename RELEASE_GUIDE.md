# Release Guide

Complete guide for building and publishing ProxyMania VPN releases (Chrome Extension + Android App).

---

## Version Management

This project has two versions to manage:

| Project | Version | File |
|---------|---------|------|
| Chrome Extension | `3.0.5` | `package.json` |
| Android App | `1.0.0` | `app/build.gradle.kts` |

### Version Commands

#### Chrome Extension (npm)
```bash
npm version patch  # 3.0.5 → 3.0.6
npm version minor  # 3.0.5 → 3.1.0
npm version major  # 3.0.5 → 4.0.0
npm version 1.2.3  # Specific version
```

#### Android App (Gradle)
```bash
./gradlew bumpPatch     # 1.0.0 → 1.0.1
./gradlew bumpMinor     # 1.0.0 → 1.1.0
./gradlew bumpMajor     # 1.0.0 → 2.0.0
./gradlew setVersion -Pversion=1.2.3
```

**Note:** Gradle tasks automatically increment `versionCode` by 1 for each release.

---

## Quick Start

### Automated Release (Recommended)

```bash
# 1. Update version for BOTH projects
npm version patch              # Updates Chrome + creates tag
./gradlew bumpPatch            # Updates Android versionName + increments versionCode

# 2. Commit and push to trigger automated release
git add -A
git commit -m "release: v3.0.6"
git push --follow-tags
```

GitHub Actions will automatically:
- Build Chrome extension (ZIP + CRX)
- Build Android APK
- Create a GitHub release with all artifacts

### Manual Release

```bash
# 1. Set GitHub token
export GITHUB_TOKEN=ghp_...

# 2. Build and publish
npm run release

# Or create as draft for review
npm run release:draft
```

---

## GitHub Actions Setup

### Configure GitHub Secrets

For automated CRX signing, store your PEM file as a secret:

1. Go to: `Repository Settings → Secrets and variables → Actions`
2. Click "New repository secret"
3. Name: `CRX_PEM_FILE`
4. Value: Copy entire content of `proxy-vpn-extension.pem`
5. Click "Add secret"

**Get PEM content:**
```bash
cat proxy-vpn-extension.pem
```

⚠️ **Never commit the PEM file to git!** It's already in `.gitignore`.

---

## Distribution Packages

### Chrome Extension

```bash
# Build both ZIP and CRX
npm run distribute

# Build ZIP only (Chrome Web Store)
npm run distribute:zip

# Build CRX only (sideloading)
npm run distribute:crx
```

### Android App

```bash
# Debug build
./gradlew assembleDebug

# Release build (unsigned)
./gradlew assembleRelease

# Copy to dist/
./gradlew copyReleaseToDist
```

### Output: `dist/` directory

| File | Description |
|------|-------------|
| `proxy-vpn-extension.zip` | Chrome Extension (Web Store) |
| `proxy-vpn-extension.crx` | Chrome Extension (Sideload) |
| `proxymania-android-release-unsigned.apk` | Android App |

### Distribution Channels

| Package | Use Case | Location |
|---------|----------|----------|
| **ZIP** | Chrome Web Store | https://chrome.google.com/webstore/devconsole |
| **CRX** | Sideloading | `chrome://extensions/` (Developer mode) |
| **APK** | Android Direct | Install via file manager |
| **GitHub** | All Downloads | Releases page |

---

### Release Checklist

- [ ] Update version: `npm version patch` + `./gradlew bumpPatch`
- [ ] Update `CHANGELOG.md` with changes
- [ ] Run tests: `npm test` + `./gradlew test`
- [ ] Build distribution: `npm run distribute` + `./gradlew assembleRelease`
- [ ] Test built packages locally
- [ ] Commit changes: `git add -A && git commit -m "release: vX.X.X"`
- [ ] Push with tags: `git push --follow-tags`
- [ ] Verify release on GitHub
- [ ] Share release notes

---

## GitHub Token Setup

### Create Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo:public_repo` (for public repos)
   - `repo` (for private repos)
4. Generate and copy token
5. Export in terminal:

```bash
export GITHUB_TOKEN=ghp_...
```

### Store Token (Optional)

Add to `~/.bashrc` or `~/.zshrc`:

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

---

## Release Script Options

```bash
# Specific version
node release.js --tag v1.0.0

# Create draft (for review before publishing)
node release.js --draft

# Mark as prerelease
node release.js --prerelease

# Don't set as latest release
node release.js --no-latest

# Combine options
node release.js --tag v1.0.0 --draft --prerelease
```

---

## GitHub Actions Workflow

The `.github/workflows/release.yml` workflow triggers on version tags:

```yaml
on:
  push:
    tags:
      - 'v*'  # v1.0.0, v2.3.4, etc.
```

**Workflow Steps:**
1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Build distribution packages
5. Create GitHub release
6. Upload ZIP and CRX assets

---

## Testing the Workflow

Before pushing a real tag, you can test the workflow:

```bash
# Create a test tag
git tag v0.0.1-test

# Push to trigger workflow
git push origin v0.0.1-test

# After testing, delete the tag
git tag -d v0.0.1-test
git push origin :refs/tags/v0.0.1-test
```

---

## Troubleshooting

### "GITHUB_TOKEN is required"

```bash
export GITHUB_TOKEN=ghp_...
```

### "crx3 not found"

```bash
npm install -g crx3
```

### "Release already exists"

The script will automatically delete and recreate the release.

### "Tag not found"

Ensure you're pushing tags:

```bash
git push --follow-tags
```

### Build fails

Check Node.js version (requires v16+):

```bash
node --version
```

### CRX file not uploaded

**Check:**
1. Verify `CRX_PEM_FILE` secret is set
2. Check workflow logs for "Setup PEM file" step
3. Ensure PEM content includes BEGIN/END markers

---

## Release Notes Template

```markdown
## ProxyMania VPN Extension vX.X.X

### 📦 Installation

#### Manual Installation
1. Download `proxy-vpn-extension.zip`
2. Extract to a folder
3. Open `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked"

#### Direct CRX Installation
1. Download `proxy-vpn-extension.crx`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Drag and drop the CRX file

### 🔧 Changes

- Feature 1
- Feature 2
- Bug fix 1

### 📋 Files

- `proxy-vpn-extension.zip` - Distribution package
- `proxy-vpn-extension.crx` - Direct installation

---

**Full Changelog**: https://github.com/owner/repo/compare/vPrevious...vCurrent
```

---

## Security Notes

⚠️ **Never commit your PEM file to git!**

- Add to `.gitignore`:
  ```
  *.pem
  ```

- Store only in GitHub Secrets
- Rotate the key if compromised

---

## Support

- **Issues**: https://github.com/your-org/proxy-vpn-extension/issues
- **Documentation**: See `DEVELOPER_GUIDE.md`
- **Chrome Docs**: https://developer.chrome.com/docs/extensions/
