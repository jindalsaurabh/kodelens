// src/services/LocalFallbackEmbeddingService.ts
import { EmbeddingService } from "./embeddings";
import fs from "fs";
import path from "path";

export class LocalFallbackEmbeddingService implements EmbeddingService {
  private modelPath: string;
  private modelLoaded: boolean = false;

  constructor(modelFolderPath: string) {
    this.modelPath = path.resolve(modelFolderPath);
  }

  async init(): Promise<void> {
    if (!fs.existsSync(this.modelPath)) {
      throw new Error(`[LocalFallbackEmbeddingService] Model folder not found: ${this.modelPath}`);
    }

    // Here you would load the model (wasm, onnx, etc.) from modelPath
    console.log(`[LocalFallbackEmbeddingService] Loaded model from: ${this.modelPath}`);
    this.modelLoaded = true;
  }

  dim(): number {
    if (!this.modelLoaded) {throw new Error("Model not initialized");}
    return 384; // your shipped model embedding dimension
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    if (!this.modelLoaded) {throw new Error("Model not initialized");}
    // Return dummy vector for now, replace with real model inference
    return new Float32Array(this.dim()).fill(Math.random());
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    return Promise.all(texts.map((t) => this.generateEmbedding(t)));
  }

  async dispose(): Promise<void> {
    // Clean up resources if needed
    this.modelLoaded = false;
  }
}
