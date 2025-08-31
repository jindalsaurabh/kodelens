const esbuild = require('esbuild');
const copyPlugin = require('esbuild-plugin-copy').default;
const path = require('path');

const isProd = process.argv.includes('--production');

esbuild.build({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['vscode'],
    outfile: 'dist/extension.js',
    sourcemap: !isProd,
    minify: isProd,
    plugins: [
        copyPlugin({
  assets: [
    {
      from: './node_modules/web-tree-sitter/tree-sitter.wasm',
      to: './media/runtime/'  // Remove 'dist/' from the path
    },
    {
      from: './media/apex/tree-sitter-apex.wasm',
      to: './media/apex/'  // Remove 'dist/' from the path
    }
  ]
})
    ],
    logLevel: isProd ? 'silent' : 'info'
}).catch(() => process.exit(1));