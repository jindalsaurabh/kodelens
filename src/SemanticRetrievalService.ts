// src/services/SemanticRetrievalService.ts
import { HybridEmbeddingService } from "./services/HybridEmbeddingService";
import type { EmbeddingService } from "./services/embeddings";
import { LocalCache } from "./database";
import type { CodeChunk } from "./types";
import { ModelManager } from "./ModelManager";

export interface ScoredChunk {
  id: string;
  content: string;
  score: number;
}

/**
 * SemanticRetrievalService
 * - Wraps embedding + DB storage
 * - Supports semantic insertion and retrieval
 */
export class SemanticRetrievalService {
  private embeddingService: HybridEmbeddingService;
  private cache: LocalCache;

  constructor(cache: LocalCache, modelManager: ModelManager, fallbackPath: any) {
    this.embeddingService = new HybridEmbeddingService(fallbackPath);
    this.cache = cache;
  }

  async init() {
    if (this.embeddingService.init) {
      await this.embeddingService.init();
    }
    console.log("[SemanticRetrievalService] Ready.");
  }

  /** Insert one chunk with embedding */
  async insertChunk(chunk: CodeChunk, filePath: string, fileHash: string) {
    const emb = await this.embeddingService.generateEmbedding(chunk.text || chunk.code || "");
    return this.cache.insertOrUpdateChunk(chunk, fileHash, emb);
  }

  /** Insert many chunks with embeddings */
  async insertChunks(chunks: CodeChunk[], filePath: string, fileHash: string) {
    const texts = chunks.map((c) => c.text || c.code || "");
    const embs = await this.embeddingService.generateEmbeddings(texts);
    return this.cache.insertChunksWithEmbeddings(chunks, filePath, fileHash, embs);
  }

  /** Search chunks by semantic similarity */
  async search(query: string, topK = 5): Promise<ScoredChunk[]> {
    const qemb = await this.embeddingService.generateEmbedding(query);

    // Pull all embeddings from DB
    const all = this.cache.getAllEmbeddings();
    if (all.length === 0) {
      return [];
    }

    // Compute cosine similarity
    const scored = all.map(({ id, embedding }) => ({
      id,
      score: this.cosineSimilarity(qemb, embedding),
    }));

    // Top K
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK);

    // Fetch content for each
    const results: ScoredChunk[] = [];
    for (const { id, score } of top) {
      const chunk = this.cache.getChunkById(id);
      if (chunk) {
        results.push({ id, content: chunk.text || chunk.code || "", score });
      }
    }
    return results;
  }

  /** Cosine similarity helper */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0,
      na = 0,
      nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
  }
}
