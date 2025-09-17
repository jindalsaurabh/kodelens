// src/services/UnifiedEmbeddingService.ts
import { EmbeddingService } from "./embeddings";
import { BgeMicroEmbeddingService } from "./BgeMicroEmbeddingService";
// import { OpenAIEmbeddingService } from "./OpenAIEmbeddingService";
// import { GeminiEmbeddingService } from "./GeminiEmbeddingService";

export class UnifiedEmbeddingService implements EmbeddingService {
  public batchSize: number;
  public provider: EmbeddingService;

  constructor(provider: EmbeddingService, batchSize = 32) {
    this.provider = provider;
    this.batchSize = batchSize;
  }

  // ✅ Optional: convenience factory
  static fromProviderName(name: string, apiKey: string): UnifiedEmbeddingService {
    let provider: EmbeddingService;
    switch (name) {
      case "bge-micro":
        provider = new BgeMicroEmbeddingService(apiKey);
        break;
      // case "openai":
      //   provider = new OpenAIEmbeddingService(apiKey);
      //   break;
      // case "gemini":
      //   provider = new GeminiEmbeddingService(apiKey);
      //   break;
      default:
        throw new Error(`Unknown provider: ${name}`);
    }
    return new UnifiedEmbeddingService(provider);
  }

  dim(): number {
    return this.provider.dim();
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    try {
      return await this.provider.generateEmbedding(text);
    } catch (err) {
      console.error("KodeLens: embedding failed for single item", err, text);
      return new Float32Array(this.dim());
    }
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    if (typeof this.provider.generateEmbeddings === "function") {
      try {
        return await this.provider.generateEmbeddings(texts);
      } catch (err) {
        console.error("KodeLens: batch embedding failed", err);
      }
    }

    // fallback: per-item
    const results: Float32Array[] = [];
    for (const t of texts) {
      try {
        results.push(await this.generateEmbedding(t));
      } catch {
        results.push(new Float32Array(this.dim()));
      }
    }
    return results;
  }
}
