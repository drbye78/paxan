#!/usr/bin/env node

import { createWriteStream, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync, readdirSync, copyFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { deflateRaw } from 'zlib';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const EXTENSION_DIR = __dirname;
const DIST_DIR = join(EXTENSION_DIR, 'dist');
const BUILD_DIR = join(DIST_DIR, 'build');
const ROOT_DIR = join(EXTENSION_DIR, '..');

// Find PEM file in multiple locations
function findPemFile() {
  // Check environment variable first
  if (process.env.PEM_FILE && existsSync(process.env.PEM_FILE)) {
    return process.env.PEM_FILE;
  }
  
  // Check common locations
  const locations = [
    join(EXTENSION_DIR, 'proxy-vpn-extension.pem'),
    join(EXTENSION_DIR, '..', 'proxy-vpn-extension.pem'),
    join(EXTENSION_DIR, 'extension.pem'),
    join(process.cwd(), 'proxy-vpn-extension.pem')
  ];
  
  for (const loc of locations) {
    if (existsSync(loc)) {
      return loc;
    }
  }
  
  return null;
}

const PEM_FILE = findPemFile();

// Files/folders to exclude from distribution
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.github',
  'tests',
  'dist',
  '*.md',
  'build.js',
  'distribute.js',
  'distribute.sh',
  '.gitignore',
  '.gitattributes',
  'package-lock.json',
  '.DS_Store'
];

function shouldExclude(filePath, baseDir) {
  const relativePath = relative(baseDir, filePath);
  
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (relativePath.startsWith(prefix)) return true;
    } else if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      if (relativePath.endsWith(ext)) return true;
    } else {
      const parts = relativePath.split(/[\\/]/);
      if (parts.includes(pattern)) return true;
      if (parts[parts.length - 1] === pattern) return true;
    }
  }
  
  return false;
}

function collectFiles(dir, baseDir) {
  const files = [];
  const entries = readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    
    if (shouldExclude(fullPath, baseDir)) {
      continue;
    }
    
    if (stats.isDirectory()) {
      const subFiles = collectFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Simple ZIP implementation (no external dependencies)
function crc32(data) {
  let crc = 0xffffffff;
  const table = [];
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xffffffff) >>> 0;
}

async function createZipPackage() {
  console.log('📦 Creating ZIP package for Chrome Web Store...');
  
  mkdirSync(DIST_DIR, { recursive: true });
  
  const files = collectFiles(EXTENSION_DIR, EXTENSION_DIR);
  const zipPath = join(DIST_DIR, 'proxy-vpn-extension.zip');
  
  const centralDirectory = [];
  let offset = 0;
  const zipParts = [];
  
  for (const file of files) {
    const relativePath = relative(EXTENSION_DIR, file);
    const content = readFileSync(file);
    const fileNameBuffer = Buffer.from(relativePath, 'utf8');
    
    const compressed = await new Promise((resolve, reject) => {
      deflateRaw(content, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    const crcValue = crc32(content);
    const compressionMethod = compressed.length < content.length ? 8 : 0;
    const finalData = compressionMethod === 8 ? compressed : content;
    const compressedSize = finalData.length;
    const uncompressedSize = content.length;
    
    const localHeader = Buffer.alloc(30 + fileNameBuffer.length);
    let localOffset = 0;
    
    localHeader.writeUInt32LE(0x04034b50, localOffset);
    localOffset += 4;
    localHeader.writeUInt16LE(20, localOffset);
    localOffset += 2;
    localHeader.writeUInt16LE(0, localOffset);
    localOffset += 2;
    localHeader.writeUInt16LE(compressionMethod, localOffset);
    localOffset += 2;
    localHeader.writeUInt16LE(0, localOffset);
    localOffset += 2;
    localHeader.writeUInt16LE(0, localOffset);
    localOffset += 2;
    localHeader.writeUInt32LE(crcValue, localOffset);
    localOffset += 4;
    localHeader.writeUInt32LE(compressedSize, localOffset);
    localOffset += 4;
    localHeader.writeUInt32LE(uncompressedSize, localOffset);
    localOffset += 4;
    localHeader.writeUInt16LE(fileNameBuffer.length, localOffset);
    localOffset += 2;
    localHeader.writeUInt16LE(0, localOffset);
    localOffset += 2;
    fileNameBuffer.copy(localHeader, localOffset);
    
    zipParts.push(localHeader);
    zipParts.push(finalData);
    
    const centralHeader = Buffer.alloc(46 + fileNameBuffer.length);
    let centralOffset = 0;
    
    centralHeader.writeUInt32LE(0x02014b50, centralOffset);
    centralOffset += 4;
    centralHeader.writeUInt16LE(20, centralOffset);
    centralOffset += 2;
    centralHeader.writeUInt16LE(20, centralOffset);
    centralOffset += 2;
    centralHeader.writeUInt16LE(0, centralOffset);
    centralOffset += 2;
    centralHeader.writeUInt16LE(compressionMethod, centralOffset);
    centralOffset += 2;
    centralHeader.writeUInt16LE(0, centralOffset);
    centralOffset += 2;
    centralHeader.writeUInt16LE(0, centralOffset);
    centralOffset += 2;
    centralHeader.writeUInt32LE(crcValue, centralOffset);
    centralOffset += 4;
    centralHeader.writeUInt32LE(compressedSize, centralOffset);
    centralOffset += 4;
    centralHeader.writeUInt32LE(uncompressedSize, centralOffset);
    centralOffset += 4;
    centralHeader.writeUInt16LE(fileNameBuffer.length, centralOffset);
    centralOffset += 2;
    centralHeader.writeUInt16LE(0, centralOffset);
    centralOffset += 2;
    centralHeader.writeUInt16LE(0, centralOffset);
    centralOffset += 2;
    centralHeader.writeUInt16LE(0, centralOffset);
    centralOffset += 2;
    centralHeader.writeUInt16LE(0, centralOffset);
    centralOffset += 2;
    centralHeader.writeUInt32LE(0, centralOffset);
    centralOffset += 4;
    centralHeader.writeUInt32LE(offset, centralOffset);
    centralOffset += 4;
    fileNameBuffer.copy(centralHeader, centralOffset);
    
    centralDirectory.push({ header: centralHeader, offset: offset });
    offset += localHeader.length + finalData.length;
  }
  
  let centralDirSize = 0;
  for (const entry of centralDirectory) {
    zipParts.push(entry.header);
    centralDirSize += entry.header.length;
  }
  
  const centralDirOffset = offset;
  
  const endRecord = Buffer.alloc(22);
  let endOffset = 0;
  
  endRecord.writeUInt32LE(0x06054b50, endOffset);
  endOffset += 4;
  endRecord.writeUInt16LE(0, endOffset);
  endOffset += 2;
  endRecord.writeUInt16LE(0, endOffset);
  endOffset += 2;
  endRecord.writeUInt16LE(centralDirectory.length, endOffset);
  endOffset += 2;
  endRecord.writeUInt16LE(centralDirectory.length, endOffset);
  endOffset += 2;
  endRecord.writeUInt32LE(centralDirSize, endOffset);
  endOffset += 4;
  endRecord.writeUInt32LE(centralDirOffset, endOffset);
  endOffset += 4;
  endRecord.writeUInt16LE(0, endOffset);
  endOffset += 2;
  
  zipParts.push(endRecord);
  
  const output = createWriteStream(zipPath);
  for (const part of zipParts) {
    output.write(part);
  }
  output.end();
  
  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
  });
  
  const stats = statSync(zipPath);
  console.log(`✓ ZIP created: ${zipPath}`);
  console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
  
  return zipPath;
}

function copyFilesToBuildDir() {
  rmSync(BUILD_DIR, { recursive: true, force: true });
  mkdirSync(BUILD_DIR, { recursive: true });
  
  const files = collectFiles(EXTENSION_DIR, EXTENSION_DIR);
  
  for (const file of files) {
    const relativePath = relative(EXTENSION_DIR, file);
    const destPath = join(BUILD_DIR, relativePath);
    const destDir = dirname(destPath);
    mkdirSync(destDir, { recursive: true });
    copyFileSync(file, destPath);
  }
  
  return BUILD_DIR;
}

function createCrxPackage() {
  console.log('📦 Creating CRX package for sideloading...');

  const crxPath = join(DIST_DIR, 'proxy-vpn-extension.crx');

  // Check if PEM file exists
  if (!PEM_FILE) {
    console.log('⚠️  PEM file not found. Cannot sign CRX.');
    console.log('   Options:');
    console.log('   1. Place proxy-vpn-extension.pem in the extension directory');
    console.log('   2. Set PEM_FILE environment variable');
    console.log('   3. For GitHub Actions, add CRX_PEM_FILE secret');
    console.log('   Skipping CRX build, ZIP only.');
    return null;
  }

  try {
    // Copy files to clean build directory
    const buildDir = copyFilesToBuildDir();

    // Run crx3 on the build directory
    execSync(`crx3 -o "${crxPath}" -p "${PEM_FILE}" "${buildDir}"`, {
      stdio: 'inherit'
    });

    const stats = statSync(crxPath);
    console.log(`✓ CRX created: ${crxPath}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);

    // Cleanup build directory
    rmSync(BUILD_DIR, { recursive: true, force: true });

    return crxPath;
  } catch (error) {
    console.log('⚠ crx3 error:', error.message);

    // Check if we have existing CRX
    const existingCrx = join(ROOT_DIR, 'proxy-vpn-extension.crx');
    if (existsSync(existingCrx)) {
      console.log('⚠ Using existing CRX file (may be outdated).');
      console.log('   Ensure crx3 is installed: npm install -g crx3');
      const newCrxPath = join(DIST_DIR, 'proxy-vpn-extension.crx');
      const content = readFileSync(existingCrx);
      const output = createWriteStream(newCrxPath);
      output.write(content);
      output.end();
      console.log(`✓ CRX copied: ${newCrxPath}`);
      return newCrxPath;
    }
    console.log('⚠ crx3 failed and no existing CRX found.');
    return null;
  }
}

async function main() {
  const mode = process.argv.find(arg => arg.startsWith('--'))?.slice(2) || 'both';
  
  console.log('🚀 Building distribution packages...\n');
  
  try {
    // Clean dist directory
    rmSync(DIST_DIR, { recursive: true, force: true });
    mkdirSync(DIST_DIR, { recursive: true });
    
    if (mode === 'zip' || mode === 'both') {
      await createZipPackage();
    }
    
    if (mode === 'crx' || mode === 'both') {
      await createCrxPackage();
    }
    
    console.log('\n✅ Distribution build complete!');
    console.log('\n📁 Output directory:', DIST_DIR);
    console.log('\n📋 Next steps:');
    console.log('   • For Chrome Web Store: Upload the ZIP file to https://chrome.google.com/webstore/devconsole');
    console.log('   • For sideloading: Load the CRX file in Chrome at chrome://extensions (Developer mode)');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

main();
