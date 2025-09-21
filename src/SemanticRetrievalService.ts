// src/SemanticRetrievalService.ts
import { LocalCache } from "./database";
import { EmbeddingService } from "./services/embeddings";
import { CodeChunk } from "./types";

export interface ScoredChunk {
  chunk: CodeChunk;
  score: number;
}

/**
 * SemanticRetrievalService
 * - Finds relevant code chunks using semantic embeddings
 */
export class SemanticRetrievalService {
  private embeddingService: EmbeddingService;
  private cache: LocalCache;
  private topK: number;

  constructor(embeddingService: EmbeddingService, cache: LocalCache, topK = 5) {
    this.embeddingService = embeddingService;
    this.cache = cache;
    this.topK = topK;
  }

  /**
   * Finds top K relevant chunks for a query
   */
  async findRelevantChunks(query: string): Promise<ScoredChunk[]> {
    // 1. Generate embedding for query
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // 2. Fetch all embeddings from cache
    const allEmbeddings = this.cache.getAllEmbeddings();
    if (allEmbeddings.length === 0) {return [];}

    // 3. Compute cosine similarity
    const scored: ScoredChunk[] = allEmbeddings
      .map((c) => {
        const score = this.cosineSimilarity(queryEmbedding, c.embedding);
        const chunk = this.cache.getChunkById(c.id);
        if (!chunk) {return null;}
        return { chunk, score };
      })
      .filter((s): s is ScoredChunk => s !== null);

    // 4. Sort by descending similarity
    scored.sort((a, b) => b.score - a.score);

    // 5. Return top K
    return scored.slice(0, this.topK);
  }

  /** ---------------- Cosine similarity helper ---------------- */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    normA = Math.sqrt(normA) || 1;
    normB = Math.sqrt(normB) || 1;
    return dot / (normA * normB);
  }
}
