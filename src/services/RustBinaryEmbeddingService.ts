// src/services/RustBinaryEmbeddingService.ts
// src/services/RustBinaryEmbeddingService.ts
import { spawn } from "child_process";
import * as path from "path";

export class RustBinaryEmbeddingService {
  private binaryPath: string;
  private modelPath?: string;
  private process: any; // we can keep a handle if persistent mode is needed

  constructor() {
    // Rust binary will be copied to dist/bin
    this.binaryPath = path.resolve(__dirname, "..", "..", "dist", "bin", "embedder");
  }

  async init(): Promise<void> {
    // Nothing heavy yet, just check binary presence
    console.log(`[RustBinaryEmbeddingService] Initialized with binary at ${this.binaryPath}`);
  }

  setModelPath(modelPath: string): void {
    this.modelPath = modelPath;
    console.log(`[RustBinaryEmbeddingService] Model path set: ${this.modelPath}`);
  }

  dim(): number {
    // Hardcode for now, later query from Rust
    return 384; // Example: MiniLM dimension
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    return this.callRust(["--model", this.modelPath!, "--text", text]);
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    for (const t of texts) {
      results.push(await this.generateEmbedding(t));
    }
    return results;
  }

  async dispose(): Promise<void> {
    // If we later keep a long-running Rust process, close here
    console.log("[RustBinaryEmbeddingService] Disposed");
  }

  private callRust(args: string[]): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, args);
      let output = "";
      let error = "";

      proc.stdout.on("data", (data) => (output += data.toString()));
      proc.stderr.on("data", (data) => (error += data.toString()));

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Rust binary failed: ${error}`));
        } else {
          try {
            const arr = JSON.parse(output) as number[];
            resolve(new Float32Array(arr));
          } catch (e) {
            reject(new Error(`Failed to parse embedding output: ${output}`));
          }
        }
      });
    });
  }
}
