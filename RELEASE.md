# Release Guide

Quick reference for building and publishing ProxyMania VPN Extension releases.

---

## GitHub Actions Setup (First Time Only)

### Configure GitHub Secrets

For automated CRX signing in GitHub Actions, you need to store your PEM file as a secret:

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

## Quick Start

### Automated Release (Recommended)

```bash
# 1. Update version (creates git tag)
npm version patch  # or: minor, major, 1.2.3

# 2. Push to trigger automated release
git push --follow-tags
```

GitHub Actions will automatically:
- Build distribution packages
- Create a GitHub release
- Upload ZIP and CRX assets

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

## Distribution Packages

### Build Only (No Publish)

```bash
# Build both ZIP and CRX
npm run distribute

# Build ZIP only (Chrome Web Store)
npm run distribute:zip

# Build CRX only (sideloading)
npm run distribute:crx
```

**Output:** `dist/` directory
- `proxy-vpn-extension.zip` (~200KB)
- `proxy-vpn-extension.crx` (~200KB)

---

## Version Management

### Semantic Versioning

```bash
npm version patch    # 3.0.0 → 3.0.1 (bug fixes)
npm version minor    # 3.0.0 → 3.1.0 (new features)
npm version major    # 3.0.0 → 4.0.0 (breaking changes)
npm version 1.2.3    # Specific version
```

### Release Checklist

- [ ] Update `CHANGELOG.md` with changes
- [ ] Run tests: `npm test`
- [ ] Build distribution: `npm run distribute`
- [ ] Test built packages locally
- [ ] Update version: `npm version <type>`
- [ ] Commit changes: `git commit -am "chore: release vX.X.X"`
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

---

## Distribution Channels

| Package | Use Case | Location |
|---------|----------|----------|
| **ZIP** | Chrome Web Store | https://chrome.google.com/webstore/devconsole |
| **CRX** | Sideloading | `chrome://extensions/` (Developer mode) |
| **CRX** | Enterprise | Group Policy / MDM |
| **GitHub** | Direct download | Releases page |

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

## Support

- **Issues**: https://github.com/your-org/proxy-vpn-extension/issues
- **Documentation**: See `DEVELOPER_GUIDE.md`
- **Chrome Docs**: https://developer.chrome.com/docs/extensions/
