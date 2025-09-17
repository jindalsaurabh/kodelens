// src/services/BgeMicroEmbeddingService.ts
import { HfInference } from "@huggingface/inference";
import { EmbeddingService } from "./embeddings";

/**
 * BgeMicroEmbeddingService
 * Uses HuggingFace BGE-Micro model to generate embeddings
 * Implements EmbeddingService interface so it can be used in UnifiedEmbeddingService
 */
export class BgeMicroEmbeddingService implements EmbeddingService {
  private client: HfInference;
  private readonly embeddingDim = 384; // BGE-Micro embedding dimension

  constructor(apiKey: string) {
    this.client = new HfInference(apiKey);
  }

  /** Return embedding dimension */
  dim(): number {
    return this.embeddingDim;
  }

  /** Generate embedding for a single text */
  async generateEmbedding(text: string): Promise<Float32Array> {
    const result = await this.client.featureExtraction({
      model: "TaylorAI/bge-micro",
      inputs: text,
    });

    // HuggingFace returns nested arrays: flatten to a 1D array
    const flat = Array.isArray(result) ? (result.flat(Infinity) as number[]) : [];
    return new Float32Array(flat);
  }

  /** Generate embeddings for an array of texts */
  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const results = await Promise.all(
      texts.map(async (t) => {
        const r = await this.client.featureExtraction({
          model: "TaylorAI/bge-micro",
          inputs: t,
        });
        const flat = Array.isArray(r) ? (r.flat(Infinity) as number[]) : [];
        return new Float32Array(flat);
      })
    );
    return results;
  }
}
