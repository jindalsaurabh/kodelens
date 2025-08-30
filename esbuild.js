const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Copy entire node_modules folder for problematic dependencies
function copyNodeModules() {
  const srcPath = path.join(__dirname, 'node_modules', 'web-tree-sitter');
  const destPath = path.join(__dirname, 'dist', 'node_modules', 'web-tree-sitter');
  
  if (fs.existsSync(srcPath)) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.cpSync(srcPath, destPath, { recursive: true });
    console.log('✓ Copied web-tree-sitter module');
  }
}

// Copy WASM files
function copyWasmFiles() {
  const wasmFiles = [
    'tree-sitter.wasm',
    'tree-sitter-sfapex.wasm'
  ];
  
  wasmFiles.forEach(file => {
    const srcPath = path.join(__dirname, 'grammars', file);
    const destPath = path.join(__dirname, 'dist', file);
    
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copied ${file}`);
    }
  });
}

async function build() {
  try {
    await esbuild.build({
      entryPoints: ['src/extension.ts'],
      bundle: true,
      outfile: 'dist/extension.js',
      external: ['vscode'],
      format: 'cjs',
      platform: 'node',
      target: 'node16',
      sourcemap: true,
      minify: false, // Keep false for debugging
      keepNames: true, // Prevent class name mangling
      // Don't exclude web-tree-sitter - we're copying the module instead
    });
    
    copyNodeModules();
    copyWasmFiles();
    
    console.log('✓ Build completed successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();