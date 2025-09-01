const esbuild = require('esbuild');
const { copy } = require('esbuild-plugin-copy'); // Import the plugin

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
    logLevel: isProd ? 'silent' : 'info',
    // ADD THIS PLUGIN CONFIGURATION
    plugins: [
        copy({
            assets: [
                {
                    from: './media/**/*',
                    to: './media/'
                }
            ]
        })
    ]
}).catch(() => process.exit(1));