//src/retrieval.ts
import { LocalCache } from './database';
import { CodeChunk } from './types';
import { EmbeddingService } from './services/embeddings';

/**
 * ---------------------------
 * Existing keyword-based retrieval
 * ---------------------------
 */
export async function findRelevantChunks(question: string, cache: LocalCache): Promise<CodeChunk[]> {
    const keywords = extractKeywords(question);
    console.log('Extracted keywords:', keywords);

    if (keywords.length === 0) {
        return [];
    }

    const relevantChunks = await cache.findChunksByKeywords(keywords);
    console.log('Chunks found from DB:', relevantChunks);

    relevantChunks.sort((a, b) => calculateScore(b, keywords) - calculateScore(a, keywords));

    return relevantChunks.slice(0, 5);
}

function extractKeywords(question: string): string[] {
    const stopWords = new Set(['how', 'do', 'i', 'a', 'the', 'is', 'in', 'on', 'with']);
    return question.toLowerCase()
                  .split(/\s+/)
                  .filter(word => word.length > 2 && !stopWords.has(word));
}

function calculateScore(chunk: CodeChunk, keywords: string[]): number {
    const chunkText = chunk.text.toLowerCase();
    return keywords.filter(keyword => chunkText.includes(keyword)).length;
}

/**
 * ---------------------------
 * Semantic retrieval (optional, new)
 * ---------------------------
 */
function cosine(a: Float32Array, b: Float32Array): number {
    let dot = 0, na = 0, nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb) || 1e-8;
    return dot / denom;
}

export class SemanticRetrievalService {
    private embeddingService: EmbeddingService;
    private cache: LocalCache;

    constructor(embeddingService: EmbeddingService, dbPathOrCache: string | LocalCache) {
        this.embeddingService = embeddingService;
        if (typeof dbPathOrCache === 'string') {
            this.cache = new LocalCache(dbPathOrCache);
            this.cache.init();
        } else {
            this.cache = dbPathOrCache;
        }
    }

    async rankCandidatesByQuery(query: string, candidateIds: string[]): Promise<{ id: string; score: number }[]> {
        if (!candidateIds || candidateIds.length === 0) {return [];}
        const qEmb = await this.embeddingService.generateEmbedding(query);
        const rows = this.cache.getEmbeddingsByIds(candidateIds);
        const scored: { id: string; score: number }[] = [];

        for (const r of rows) {
            if (!r.embedding || r.embedding.length !== qEmb.length) {
                scored.push({ id: r.id, score: 0 });
                continue;
            }
            const sim = cosine(qEmb, r.embedding);
            scored.push({ id: r.id, score: sim });
        }

        scored.sort((a, b) => b.score - a.score);
        return scored;
    }

    async findRelevantChunks(
        query: string,
        keywords?: string[],
        maxCandidates = 200,
        topK = 20
    ): Promise<{ chunk: CodeChunk; score: number }[]> {
        let candidateChunks: CodeChunk[] = [];
        if (keywords && keywords.length > 0) {
            candidateChunks = this.cache.findChunksByKeywords(keywords).slice(0, maxCandidates);
        }

        let candidateIds: string[] = [];
        if (candidateChunks.length > 0) {
            candidateIds = candidateChunks.map(c => c.id);
        } else {
            const allEmb = this.cache.getAllEmbeddings();
            candidateIds = allEmb.slice(0, maxCandidates).map(r => r.id);
        }

        const ranked = await this.rankCandidatesByQuery(query, candidateIds);
        const top = ranked.slice(0, topK);

        const results: { chunk: CodeChunk; score: number }[] = [];
        for (const r of top) {
            const chunk = this.cache.getChunkById(r.id);
            if (chunk) {results.push({ chunk, score: r.score });}
        }
        return results;
    }
}
