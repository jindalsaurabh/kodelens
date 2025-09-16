// src/embeddings/LocalEmbeddingService.ts
import { EmbeddingService } from "../services/embeddings";

export class LocalEmbeddingService implements EmbeddingService {
  private _dim = 384;
  private extractorPromise: Promise<any>;

  constructor(model = "BAAI/bge-micro") {
    this.extractorPromise = (async () => {
      const { pipeline, env } = await import("@xenova/transformers");
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      return pipeline("feature-extraction", model);
    })();
  }

  dim(): number {
    return this._dim;
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    const extractor = await this.extractorPromise;
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return output.data as Float32Array;
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const extractor = await this.extractorPromise;
    const results: Float32Array[] = [];
    for (const t of texts) {
      const output = await extractor(t, { pooling: "mean", normalize: true });
      results.push(output.data as Float32Array);
    }
    return results;
  }
}
