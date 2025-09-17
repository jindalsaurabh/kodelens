// src/services/LocalBgeEmbeddingService.ts
import { EmbeddingService } from "./embeddings";

export class LocalBgeEmbeddingService implements EmbeddingService {
  private embedder: any | null = null;
// fixed for bge-small-en-v1.5
  dim(): number {
  return 384;
}

  constructor() {}

  private async ensureLoaded() {
    if (!this.embedder) {
      const { pipeline } = await import("@xenova/transformers");
      this.embedder = await pipeline(
        "feature-extraction",
        "Xenova/bge-small-en-v1.5"
      );
    }
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    await this.ensureLoaded();
    const output = await this.embedder(text, { pooling: "mean", normalize: true });
    return new Float32Array(output.data);
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    await this.ensureLoaded();
    const results: Float32Array[] = [];
    for (const t of texts) {
      const output = await this.embedder(t, { pooling: "mean", normalize: true });
      results.push(new Float32Array(output.data));
    }
    return results;
  }
}
