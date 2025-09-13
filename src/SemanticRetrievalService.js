"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticRetrievalService = void 0;
/**
 * SemanticRetrievalService
 * - Finds relevant code chunks using semantic embeddings
 */
class SemanticRetrievalService {
    constructor(embeddingService, cache, topK = 5) {
        this.embeddingService = embeddingService;
        this.cache = cache;
        this.topK = topK;
    }
    /**
     * Finds top K relevant chunks for a query
     */
    async findRelevantChunks(query) {
        // 1. Generate embedding for query
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);
        console.log("Query embedding (first 5 values):", queryEmbedding.slice(0, 5));
        // 2. Fetch all chunks with embeddings
        const allEmbeddings = this.cache.getAllEmbeddings();
        if (allEmbeddings.length === 0) {
            return [];
        }
        console.log("Query embedding (first 5 values):", queryEmbedding.slice(0, 5));
        // 3. Compute cosine similarity
        const scored = allEmbeddings.map(c => {
            const score = this.cosineSimilarity(queryEmbedding, c.embedding);
            console.log(`Similarity with chunk ${c.id}: ${score.toFixed(4)}`);
            return { id: c.id, score };
        });
        /*
          const scored: { id: string; score: number }[] = allEmbeddings.map(c => ({
            id: c.id,
            score: this.cosineSimilarity(queryEmbedding, c.embedding)
          }));
          */
        // Inside findRelevantChunks before sorting
        console.log("🔍 Similarity scores:");
        allEmbeddings.forEach(c => {
            const score = this.cosineSimilarity(queryEmbedding, c.embedding);
            console.log(` - ${c.id}: ${score.toFixed(4)}`);
        });
        // 4. Sort by descending similarity
        scored.sort((a, b) => b.score - a.score);
        // 5. Pick top K
        const topIds = scored.slice(0, this.topK).map(s => s.id);
        console.log("Top K chunks by similarity:", topIds);
        // 6. Retrieve CodeChunk objects
        const topChunks = topIds
            .map(id => this.cache.getChunkById(id))
            .filter((c) => c !== null);
        return topChunks;
    }
    /** ---------------- Cosine similarity helper ---------------- */
    cosineSimilarity(a, b) {
        let dot = 0, normA = 0, normB = 0;
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
exports.SemanticRetrievalService = SemanticRetrievalService;
