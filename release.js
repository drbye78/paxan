#!/usr/bin/env node

/**
 * GitHub Release Publisher
 * 
 * Publishes distribution packages (ZIP and CRX) to GitHub Releases.
 * 
 * Usage:
 *   # Set token first
 *   export GITHUB_TOKEN=ghp_...
 *   
 *   # Run release
 *   npm run release
 *   node release.js
 *   
 *   # Options
 *   node release.js --tag v1.0.0       # Specific version
 *   node release.js --draft            # Create as draft
 *   node release.js --prerelease       # Mark as prerelease
 *   node release.js --no-latest        # Don't set as latest
 * 
 * Environment Variables:
 *   GITHUB_TOKEN - Personal access token with repo:public_repo scope
 *   GITHUB_REPOSITORY - Owner/repo (e.g., "user/proxy-vpn-extension")
 *   GITHUB_OWNER - Repository owner (optional, auto-detected)
 *   GITHUB_REPO - Repository name (optional, auto-detected)
 * 
 * GitHub Actions:
 *   When pushing a version tag (e.g., v1.0.0), the release is automated
 *   via .github/workflows/release.yml
 */

import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const DIST_DIR = join(process.cwd(), 'dist');
const PACKAGE_JSON = join(process.cwd(), 'package.json');

// Parse command line arguments
const args = process.argv.slice(2);
const argTag = args.find(a => a.startsWith('--tag='))?.split('=')[1];
const isDraft = args.includes('--draft');
const isPrerelease = args.includes('--prerelease');
const isLatest = !args.includes('--no-latest');

// Get version from package.json or argument
let version = argTag;
if (!version) {
  try {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
    version = `v${pkg.version}`;
  } catch (error) {
    console.error('❌ Could not read version from package.json');
    process.exit(1);
  }
}

// Ensure version starts with 'v'
if (!version.startsWith('v')) {
  version = `v${version}`;
}

// Get GitHub info from environment or git remote
let owner = process.env.GITHUB_OWNER;
let repo = process.env.GITHUB_REPO;

if (!owner || !repo) {
  const repoEnv = process.env.GITHUB_REPOSITORY;
  if (repoEnv) {
    [owner, repo] = repoEnv.split('/');
  } else {
    try {
      const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
      const match = remote.match(/github\.com[:/]([^/]+)\/([^.]+)\.git/);
      if (match) {
        owner = match[1];
        repo = match[2];
      }
    } catch (error) {
      console.error('❌ Could not determine GitHub repository');
      process.exit(1);
    }
  }
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable is required');
  console.error('   Create a token at: https://github.com/settings/tokens');
  console.error('   Required scope: repo:public_repo (or repo for private repos)');
  console.error('');
  console.error('   Usage:');
  console.error('   export GITHUB_TOKEN=ghp_...');
  console.error('   node release.js');
  process.exit(1);
}

const API_BASE = 'https://api.github.com';
const HEADERS = {
  'Authorization': `token ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'proxy-vpn-extension-release-script'
};

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...HEADERS,
      ...options.headers
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(data)}`);
  }
  
  return data;
}

async function getOrCreateRelease() {
  console.log(`📦 Creating release ${version} for ${owner}/${repo}...`);
  
  // Check if release already exists
  try {
    const existingRelease = await githubRequest(
      `${API_BASE}/repos/${owner}/${repo}/releases/tags/${version}`
    );
    
    console.log(`⚠️  Release ${version} already exists (ID: ${existingRelease.id})`);
    console.log(`   Deleting existing release...`);
    
    // Delete existing release
    await githubRequest(
      `${API_BASE}/repos/${owner}/${repo}/releases/${existingRelease.id}`,
      { method: 'DELETE' }
    );
    
    console.log(`   Deleted existing release`);
  } catch (error) {
    if (!error.message.includes('404')) {
      throw error;
    }
    // Release doesn't exist, which is fine
  }
  
  // Get tag commit SHA
  let targetCommitish = 'main';
  try {
    const tag = await githubRequest(
      `${API_BASE}/repos/${owner}/${repo}/git/refs/tags/${version}`
    );
    targetCommitish = tag.object.sha;
  } catch (error) {
    console.log(`⚠️  Tag ${version} not found, will use default branch`);
  }
  
  // Create new release
  const releaseData = {
    tag_name: version,
    name: version,
    body: generateReleaseNotes(version),
    draft: isDraft,
    prerelease: isPrerelease,
    make_latest: isLatest ? 'true' : 'false',
    target_commitish: targetCommitish
  };
  
  const release = await githubRequest(
    `${API_BASE}/repos/${owner}/${repo}/releases`,
    {
      method: 'POST',
      body: JSON.stringify(releaseData)
    }
  );
  
  console.log(`✓ Release created: ${release.html_url}`);
  return release;
}

function generateReleaseNotes(version) {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
  
  return `## ProxyMania VPN Extension ${version}

### 📦 Installation

#### Chrome Web Store
Download and install from the [Chrome Web Store](#) (link coming soon).

#### Manual Installation
1. Download \`proxy-vpn-extension.zip\`
2. Extract to a folder
3. Open \`chrome://extensions/\`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the extracted folder

#### Direct CRX Installation
1. Download \`proxy-vpn-extension.crx\`
2. Open \`chrome://extensions/\`
3. Enable "Developer mode"
4. Drag and drop the CRX file

### 🔧 Changes

See the [CHANGELOG](CHANGELOG.md) for detailed changes.

### 📋 Files

- \`proxy-vpn-extension.zip\` - Distribution package for Chrome Web Store
- \`proxy-vpn-extension.crx\` - Direct installation package

---

**Full Changelog**: https://github.com/${owner}/${repo}/compare/${version}...${version.replace(/v(\d+)\./, 'v' + (parseInt($1) - 1) + '.')}`;
}

async function uploadAsset(releaseId, filePath, contentType) {
  const fileName = filePath.split('/').pop();
  const fileContent = readFileSync(filePath);
  const fileSize = statSync(filePath).size;
  
  console.log(`⬆️  Uploading ${fileName}...`);
  
  const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`;
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': contentType,
      'Content-Length': fileSize.toString()
    },
    body: fileContent
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${error}`);
  }
  
  const asset = await response.json();
  console.log(`✓ Uploaded: ${fileName} (${(fileSize / 1024).toFixed(2)} KB)`);
  return asset;
}

async function main() {
  console.log('🚀 GitHub Release Publisher\n');
  console.log(`Repository: ${owner}/${repo}`);
  console.log(`Version: ${version}`);
  console.log(`Draft: ${isDraft ? 'Yes' : 'No'}`);
  console.log(`Prerelease: ${isPrerelease ? 'Yes' : 'No'}`);
  console.log('');
  
  try {
    // Check distribution files exist
    const zipPath = join(DIST_DIR, 'proxy-vpn-extension.zip');
    const crxPath = join(DIST_DIR, 'proxy-vpn-extension.crx');
    
    const missingFiles = [];
    if (!readFileSync(zipPath)) missingFiles.push('proxy-vpn-extension.zip');
    if (!readFileSync(crxPath)) missingFiles.push('proxy-vpn-extension.crx');
    
    if (missingFiles.length > 0) {
      console.log('⚠️  Distribution files not found. Building...');
      execSync('npm run distribute', { stdio: 'inherit' });
    }
    
    // Create or get release
    const release = await getOrCreateRelease();
    
    // Upload assets
    await uploadAsset(release.id, zipPath, 'application/zip');
    await uploadAsset(release.id, crxPath, 'application/octet-stream');
    
    console.log('\n✅ Release published successfully!');
    console.log(`📎 Release URL: ${release.html_url}`);
    
    if (isDraft) {
      console.log('\n⚠️  This is a DRAFT release. Publish it manually on GitHub.');
    }
  } catch (error) {
    console.error('\n❌ Release failed:', error.message);
    process.exit(1);
  }
}

main();
