// PeasyProxy VPN - Module Bundler
// Bundles ES modules into a single popup.js file for Chrome Extension compatibility

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MODULES_DIR = join(__dirname, 'modules');
const OUTPUT_FILE = join(__dirname, '..', 'popup.bundle.js');
const ENTRY_FILE = join(__dirname, '..', 'popup.entry.js');

// Modules to include (in dependency order)
const MODULES = [
  'state.js',
  'utils.js',
  'dom.js',
  'storage.js',
  'toast.js',
  'settings.js',
  'ui-core.js',
  'security.js',
  'ip-detector.js',
  'site-rules.js',
  'auto-rotation.js',
  'country-blacklist.js',
  'connection.js',
  'proxy-list.js',
  'quick-connect.js',
  'tabs-filters.js',
  'monitoring.js',
  'onboarding.js',
  'import-export.js',
  'stats.js',
  'auto-refresh.js',
  'events.js',
  'accessibility.js'
];

console.log('🔧 Bundling PeasyProxy VPN modules...\n');

// Read entry file (main popup.js entry point)
let entryContent = '';
try {
  entryContent = readFileSync(ENTRY_FILE, 'utf8');
  console.log('✓ Read entry file: popup.entry.js');
} catch (error) {
  console.error('❌ Entry file not found. Creating template...');
  console.error('   Please create popup.entry.js with your main application code');
  process.exit(1);
}

// Bundle modules
let bundledContent = `// PeasyProxy VPN - Bundled Modules
// Generated: ${new Date().toISOString()}
// DO NOT EDIT - This file is auto-generated

'use strict';

// ============================================================================
// MOCK CHROME API (for testing)
// ============================================================================

if (typeof chrome === 'undefined' && typeof window !== 'undefined' && !window.chrome) {
  const noop = () => {};
  global.chrome = {
    runtime: {
      sendMessage: noop,
      onMessage: { addListener: noop, removeListener: noop },
      lastError: null,
    },
    storage: {
      local: { get: noop, set: noop, clear: noop, remove: noop }
    },
    proxy: {
      settings: { set: noop, get: noop, clear: noop }
    },
    tabs: { query: noop, create: noop, update: noop, remove: noop },
    alarms: {
      create: noop, clear: noop, clearAll: noop, get: noop, getAll: noop,
      onAlarm: { addListener: noop, removeListener: noop }
    },
    notifications: {
      create: noop, clear: noop, getAll: noop,
      onClosed: { addListener: noop }
    },
    extension: { getURL: (path) => \`chrome-extension://test-id/\${path}\` }
  };
}

`;

// Read and bundle each module
for (const module of MODULES) {
  const modulePath = join(MODULES_DIR, module);
  try {
    const content = readFileSync(modulePath, 'utf8');
    
    // Remove import/export statements and adapt for bundled environment
    const adaptedContent = content
      .replace(/^import\s+.*?from\s+['"].*?['"];?/gm, '') // Remove import statements
      .replace(/^export\s+{/gm, 'const ') // Convert export { to const
      .replace(/^export\s+async\s+function/gm, 'async function') // Remove export from functions
      .replace(/^export\s+function/gm, 'function') // Remove export from functions
      .replace(/^export\s+let/gm, 'let') // Remove export from let
      .replace(/^export\s+const/gm, 'const') // Remove export from const
      .replace(/^export\s+default/gm, '') // Remove export default
      .replace(/export\s+{[^}]+};?/gm, ''); // Remove export { } blocks
    
    bundledContent += `\n// ============================================================================
// ${module.toUpperCase()}
// ============================================================================

${adaptedContent}
`;
    
    console.log(`✓ Bundled: ${module}`);
  } catch (error) {
    console.warn(`⚠ Skipped: ${module} (${error.message})`);
  }
}

// Add entry file content
bundledContent += `

// ============================================================================
// MAIN APPLICATION ENTRY POINT
// ============================================================================

${entryContent}
`;

// Write bundled file
writeFileSync(OUTPUT_FILE, bundledContent);
console.log(`\n✅ Bundle created: ${OUTPUT_FILE}`);
console.log(`   Size: ${(Buffer.byteLength(bundledContent) / 1024).toFixed(2)} KB`);

// Update manifest.json to use bundled file
const manifestPath = join(__dirname, '..', 'manifest.json');
try {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  
  // Update action popup
  if (manifest.action) {
    manifest.action.default_popup = 'popup.html'; // Keep HTML same
  }
  
  // Note: The HTML file should load popup.bundle.js instead of popup.js
  console.log('\n📝 Note: Update popup.html to load popup.bundle.js instead of popup.js');
  console.log('   Change: <script src="popup.js"></script>');
  console.log('   To:     <script src="popup.bundle.js"></script>');
  
} catch (error) {
  console.error('⚠ Could not update manifest:', error.message);
}

console.log('\n🎉 Bundling complete!');
