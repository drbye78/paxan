import * as esbuild from 'esbuild';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'src');
const outDir = __dirname;

const isWatch = process.argv.includes('--watch');
const target = process.argv.find(arg => arg.startsWith('--target='))?.split('=')[1];

async function build() {
  if (!existsSync(srcDir)) {
    mkdirSync(srcDir, { recursive: true });
  }

  const buildOptions = {
    bundle: true,
    minify: !isWatch,
    sourcemap: isWatch,
    target: ['chrome120'],
    format: 'iife',
    globalName: 'PeasyProxy',
  };

  // Background now uses ES modules directly in manifest.json
  // No build needed - uses src/background/index.js directly
  
  // Popup now uses modular architecture - bundle popup modules
  if (!target || target === 'popup') {
    // Bundle popup modules into popup.js
    await esbuild.build({
      ...buildOptions,
      entryPoints: [join(__dirname, 'src/popup-modules/main.js')],
      outfile: join(outDir, 'popup.js'),
      define: {
        'process.env.NODE_ENV': isWatch ? '"development"' : '"production"'
      }
    });
    console.log('✓ Built popup.js');
  }

  if (isWatch) {
    console.log('👀 Watching for changes...');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
