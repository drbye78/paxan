import * as esbuild from 'esbuild';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'src');
const outDir = __dirname;

const isWatch = process.argv.includes('--watch');
const target = process.argv.find(arg => arg.startsWith('--target='))?.split('=')[1];

const backgroundModules = [
  'src/background/proxy-fetcher.js',
  'src/background/proxy-manager.js', 
  'src/background/health-monitor.js',
  'src/background/index.js'
];

const popupModules = [
  'src/popup/state.js'
];

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
    globalName: 'ProxyMania',
  };

  // Background now uses ES modules directly in manifest.json
  // No build needed - uses src/background/index.js directly
  
  if (!target || target === 'popup') {
    for (const module of popupModules) {
      const outFile = module.replace('src/', '').replace('.js', '.bundle.js');
      await esbuild.build({
        ...buildOptions,
        entryPoints: [join(__dirname, module)],
        outfile: join(outDir, outFile),
        define: {
          'process.env.NODE_ENV': isWatch ? '"development"' : '"production"'
        }
      });
      console.log(`✓ Built ${outFile}`);
    }
  }

  if (isWatch) {
    console.log('👀 Watching for changes...');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
