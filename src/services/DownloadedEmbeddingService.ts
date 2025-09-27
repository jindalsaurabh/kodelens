//src/services/LocalFallbackEmbeddingService.ts
import { EmbeddingService } from "./embeddings";

// Loose type for ESM-only pipeline
type FeatureExtractionPipeline = (input: string | string[], options?: any) => Promise<any>;

export class DownloadedEmbeddingService implements EmbeddingService {
  private extractor?: FeatureExtractionPipeline;
  private _dim: number;
  private modelId: string;

  constructor(modelId: string, dim: number) {
    this.modelId = modelId;
    this._dim = dim;
  }

  async init(): Promise<void> {
    if (!this.extractor) {
      const { pipeline, env } = await import("@xenova/transformers");
      env.allowLocalModels = true;
      this.extractor = await pipeline("feature-extraction", this.modelId);
    }
  }

  dim(): number {
    return this._dim;
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    await this.init();
    const output = await this.extractor!(text, { pooling: "mean", normalize: true });
    return new Float32Array(output.data as Float32Array);
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    await this.init();
    const output = await this.extractor!(texts, { pooling: "mean", normalize: true });
    return output.tolist().map((arr: number[]) => Float32Array.from(arr));
  }
}
