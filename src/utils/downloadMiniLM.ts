// src/utils/downloadMiniLM.ts
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const MODEL_NAME = "all-MiniLM-L6-v2";
const BASE_URL = "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main"; // quantized WASM

export async function getLocalMiniLMPath(context: vscode.ExtensionContext): Promise<string> {
  const modelDir = path.join(context.globalStorageUri.fsPath, "models", MODEL_NAME);

  if (!fs.existsSync(modelDir)) {fs.mkdirSync(modelDir, { recursive: true });}

  const files = ["config.json", "model.json", "tokenizer.json", "vocab.txt", "merges.txt"];

  for (const file of files) {
    const filePath = path.join(modelDir, file);
    if (!fs.existsSync(filePath)) {
      const url = `${BASE_URL}/${file}`;
      const res = await fetch(url);
      if (!res.ok) {throw new Error(`Failed to download ${file}: ${res.statusText}`);}
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      console.log(`[MiniLM] Downloaded ${file}`);
    }
  }

  return modelDir;
}
