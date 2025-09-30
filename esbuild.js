const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs-extra");

const outdir = "dist";

async function build() {
  // 1️⃣ Bundle extension
  await esbuild.build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: path.join(outdir, "extension.js"),
    platform: "node",
    external: ["vscode", "better-sqlite3", "path", "fs", "sharp"],
    sourcemap: false,
    target: "node22",
    format: "cjs",
  });

  // Helper to recursively copy files/folders
  function copyRecursiveSync(src, dest) {
    if (!fs.existsSync(src)) {return;}
    if (fs.statSync(src).isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const file of fs.readdirSync(src)) {
        copyRecursiveSync(path.join(src, file), path.join(dest, file));
      }
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }

  // Helper to set executable permissions recursively
  function chmodRecursive(p) {
    if (!fs.existsSync(p)) {return;}
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const f of fs.readdirSync(p)) {chmodRecursive(path.join(p, f));}
    } else {
      try {
        fs.chmodSync(p, 0o755);
      } catch (e) {
        /* ignore on Windows */
      }
    }
  }

  // 📦 Copy Candle model - FIXED PATH to match Rust binary expectation
  const candleModelSrc = path.join(__dirname, "candle-model");
  const candleModelDest = path.join(__dirname, outdir, "models", "shipped", "all-MiniLM-L6-v2");
  copyRecursiveSync(candleModelSrc, candleModelDest);
  console.log(`✓ Copied Candle Model → ${candleModelDest}`);

  // ⚙️ Copy Candle Rust binary
  const candleBinSrc = path.join(__dirname, "candle-engine", "target", "release", "kodelens-embedder");
  const candleBinDestDir = path.join(__dirname, outdir, "bin", process.platform, process.arch);
  const candleBinDest = path.join(candleBinDestDir, "kodelens-embedder");

  if (fs.existsSync(candleBinSrc)) {
    copyRecursiveSync(candleBinSrc, candleBinDest);
    chmodRecursive(candleBinDestDir);
    console.log(`✓ Copied Candle Rust binary → ${candleBinDest}`);
  } else {
    console.warn(`⚠️  Candle binary not found at: ${candleBinSrc}`);
  }

  /*
  // 📦 Copy existing models (keep for compatibility)
  const modelSrc = path.join(__dirname, "assets", "models");
  const modelDest = path.join(__dirname, outdir, "models");
  if (fs.existsSync(modelSrc)) {
    copyRecursiveSync(modelSrc, modelDest);
    console.log(`✓ Copied Existing Models → ${modelDest}`);
  } 
*/
  // ⚙️ Copy existing Rust binary (keep for compatibility)
  const rustBinSrc = path.join(__dirname, "assets", "bin", "darwin", "x64", "rust_embed");
  const rustBinDestDir = path.join(__dirname, outdir, "bin", process.platform, process.arch);
  const rustBinDest = path.join(rustBinDestDir, "rust_embed");

  if (fs.existsSync(rustBinSrc)) {
    copyRecursiveSync(rustBinSrc, rustBinDest);
    chmodRecursive(rustBinDestDir);
    console.log(`✓ Copied Existing Rust binary → ${rustBinDest}`);
  }

  // 2️⃣ Copy runtime WASM
  const wasmSrc = path.join(__dirname, "media", "runtime", "tree-sitter.wasm");
  const wasmDest = path.join(__dirname, outdir, "tree-sitter.wasm");
  await fs.copy(wasmSrc, wasmDest, { overwrite: true });
  console.log(`✓ Copied tree-sitter.wasm → ${wasmDest}`);

  console.log("✅ esBuild complete");

  // VERIFICATION: Show what was created
  console.log("\n📁 Final Distribution Structure:");
  function listFiles(dir, prefix = "") {
    if (!fs.existsSync(dir)) {return;}
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        console.log(`${prefix}📁 ${item}/`);
        listFiles(fullPath, prefix + "  ");
      } else {
        const size = (stat.size / 1024 / 1024).toFixed(2);
        console.log(`${prefix}📄 ${item} (${size}MB)`);
      }
    }
  }
  
  listFiles(path.join(__dirname, outdir));
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});