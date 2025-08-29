const esbuild = require("esbuild");

esbuild.build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  external: ["vscode", "web-tree-sitter"],
  outfile: "dist/extension.js",
  sourcemap: true
//  loader: {
//    ".wasm": "file", // prevent wasm bundling into dist
//  },
}).catch(() => process.exit(1));
