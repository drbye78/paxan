# GitHub Actions Release Setup

This guide explains how to configure GitHub Actions for automated releases.

---

## Quick Setup

### 1. Configure GitHub Secrets

Go to your repository settings: `Settings → Secrets and variables → Actions`

#### Required Secret: `CRX_PEM_FILE`

This secret contains your PEM private key for signing the CRX file.

**To get the PEM content:**

```bash
# From the directory containing your PEM file
cat proxy-vpn-extension.pem
```

Copy the entire content (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines).

**In GitHub:**
1. Click "New repository secret"
2. Name: `CRX_PEM_FILE`
3. Value: Paste the PEM file content
4. Click "Add secret"

---

## How It Works

When you push a version tag (e.g., `v1.0.0`):

1. GitHub Actions triggers the `release.yml` workflow
2. The workflow:
   - Checks out your code
   - Installs Node.js and dependencies
   - Installs `crx3` for CRX building
   - Creates the PEM file from the secret
   - Builds ZIP and CRX packages
   - Creates a GitHub release
   - Uploads both packages as assets

---

## Manual Release Process

If you prefer manual releases:

```bash
# 1. Set GitHub token
export GITHUB_TOKEN=ghp_...

# 2. Build and publish
npm run release
```

---

## Troubleshooting

### CRX file not uploaded

**Check:**
1. Verify `CRX_PEM_FILE` secret is set
2. Check workflow logs for "Setup PEM file" step
3. Ensure PEM content includes BEGIN/END markers

### Build fails with "crx3 not found"

The workflow installs crx3 globally. Check the workflow logs for installation errors.

### "GITHUB_TOKEN is required" for manual release

```bash
export GITHUB_TOKEN=ghp_...
```

### Release created but no assets

Check the workflow logs for the "Verify build artifacts" step. If files are missing:
1. Check `npm run distribute` runs successfully
2. Verify `dist/` directory contains the files

---

## Workflow File

Location: `.github/workflows/release.yml`

The workflow:
- Triggers on tags matching `v*`
- Runs on Ubuntu latest
- Uses Node.js 20
- Creates release with installation instructions
- Uploads both ZIP and CRX files

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

## Alternative: ZIP Only Release

If you don't want to store the PEM file in GitHub secrets, modify the workflow to only build ZIP:

```yaml
- name: Build distribution packages
  run: npm run distribute:zip
```

Then update the assets to only include the ZIP file.

---

## Support

- Workflow logs: `Actions` tab in your GitHub repo
- Release issues: Check `Releases` page
- Documentation: See `RELEASE.md` and `DEVELOPER_GUIDE.md`
