// esbuild.js
const esbuild = require('esbuild');

const isProd = process.argv.includes('--production');

esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],           // bundle everything except the VS Code API
  outfile: 'dist/extension.js',
  sourcemap: !isProd,
  minify: isProd,
  logLevel: isProd ? 'silent' : 'info'
}).catch(() => process.exit(1));
