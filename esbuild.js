// esbuild.js
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
    external: [
      "vscode",
      "@vscode/sqlite3",
      "path",
      "fs",
    ],
    sourcemap: false,
    target: "node18",
    format: "cjs",
  });

  // 2️⃣ Copy only the runtime WASM into dist/
  const wasmSrc = path.join(__dirname, "media", "runtime", "tree-sitter.wasm");
  const wasmDest = path.join(__dirname, outdir, "tree-sitter.wasm");

  await fs.copy(wasmSrc, wasmDest, { overwrite: true });
  console.log(`✓ Copied tree-sitter.wasm → ${wasmDest}`);

  console.log("✅ Build complete");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
