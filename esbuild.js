// esbuild.js
const esbuild = require('esbuild');
//const { copy } = require('esbuild-plugin-copy');
const isProd = process.argv.includes('--production');

esbuild.build({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['vscode', '@vscode/sqlite3'], // ADD @vscode/sqlite3 to the external list
    outfile: 'dist/extension.js',
    sourcemap: !isProd,
    minify: isProd,
    logLevel: isProd ? 'silent' : 'info',
}).catch(() => process.exit(1));


