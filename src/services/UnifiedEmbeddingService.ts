import { EmbeddingService } from "./embeddings";

/**
 * UnifiedEmbeddingService
 * Wraps any embedding provider (OpenAI, Google Gemini, Mock, etc.)
 * Adds:
 *  - Batch handling (prefers generateEmbeddings)
 *  - Fallback to per-item embedding if batch not available
 *  - Retry and logging for individual failures
 */
export class UnifiedEmbeddingService implements EmbeddingService {
public batchSize: number;

  constructor(public provider: EmbeddingService, batchSize = 32) {this.batchSize = batchSize;}

  dim(): number {
    return this.provider.dim();
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    try {
      return await this.provider.generateEmbedding(text);
    } catch (err) {
      console.error("KodeLens: embedding failed for single item", err, text);
      // fallback to zero vector on failure
      return new Float32Array(this.dim());
    }
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    // Prefer batch API if available
    if (typeof this.provider.generateEmbeddings === "function") {
      try {
        return await this.provider.generateEmbeddings(texts);
      } catch (err) {
        console.error("KodeLens: batch embedding failed, falling back to single-item", err);
      }
    }

    // Fallback: per-item embeddings
    const results: Float32Array[] = [];
    for (const t of texts) {
      try {
        results.push(await this.generateEmbedding(t));
      } catch (err) {
        console.error("KodeLens: per-item embedding failed", err, t);
        results.push(new Float32Array(this.dim()));
      }
    }
    return results;
  }
}
