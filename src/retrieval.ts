//src/retrieval.ts
import { LocalCache } from './database';
import { CodeChunk } from './types';
import { EmbeddingService } from './services/embeddings';
import { HybridEmbeddingService } from './services/HybridEmbeddingService';

export interface SearchResult {
    chunk: CodeChunk;
    score: number;
    matchType: 'semantic' | 'keyword' | 'hybrid';
}

/**
 * ---------------------------
 * Unified Retrieval Function
 * ---------------------------
 */
export async function findRelevantChunks(
    question: string, 
    cache: LocalCache,
    embeddingService: HybridEmbeddingService,
    limit: number = 10
): Promise<SearchResult[]> {
    console.log(`[retrieval] Searching for: "${question}"`);
    
    try {
        // Try semantic search first
        const semanticResults = await semanticSearch(question, cache, embeddingService, limit * 2);
        
        // If we have good semantic results, use them
        if (semanticResults.length > 0 && semanticResults[0].score > 0.3) {
            console.log(`[retrieval] Using semantic search: ${semanticResults.length} results`);
            return semanticResults.slice(0, limit).map(result => ({
                ...result,
                matchType: 'semantic' as const
            }));
        }
        
        // Fallback to keyword search
        console.log(`[retrieval] Semantic results weak, falling back to keywords`);
        const keywordResults = keywordSearch(question, cache, limit);
        return keywordResults.map(result => ({
            chunk: result,
            score: 0.5, // Base score for keyword matches
            matchType: 'keyword' as const
        }));
        
    } catch (error) {
        console.error(`[retrieval] Semantic search failed, using keyword fallback:`, error);
        // Final fallback to pure keyword search
        const keywordResults = keywordSearch(question, cache, limit);
        return keywordResults.map(result => ({
            chunk: result,
            score: 0.3,
            matchType: 'keyword' as const
        }));
    }
}

/**
 * ---------------------------
 * Semantic Search
 * ---------------------------
 */
async function semanticSearch(
    query: string, 
    cache: LocalCache,
    embeddingService: HybridEmbeddingService,
    limit: number = 10
): Promise<{ chunk: CodeChunk; score: number }[]> {
    const qEmb = await embeddingService.generateEmbedding(query);
    console.log(`[retrieval] Generated query embedding with ${qEmb.length} dimensions`);
    
    const allEmbeddings = cache.getAllEmbeddings();
    console.log(`[retrieval] Comparing against ${allEmbeddings.length} stored embeddings`);
    
    const scored: { chunk: CodeChunk; score: number }[] = [];
    
    for (const { id, embedding } of allEmbeddings) {
        const chunk = cache.getChunkById(id);
        if (chunk && embedding.length === qEmb.length) {
            const similarity = cosineSimilarity(qEmb, embedding);
            scored.push({ chunk, score: similarity });
        }
    }
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    console.log(`[retrieval] Semantic search found ${scored.length} results, top score: ${scored[0]?.score.toFixed(3)}`);
    return scored.slice(0, limit);
}

/**
 * ---------------------------
 * Keyword Search (Enhanced)
 * ---------------------------
 */
function keywordSearch(question: string, cache: LocalCache, limit: number = 10): CodeChunk[] {
    const keywords = extractKeywords(question);
    console.log(`[retrieval] Keyword search with:`, keywords);
    
    if (keywords.length === 0) {
        return [];
    }
    
    const relevantChunks = cache.findChunksByKeywords(keywords);
    console.log(`[retrieval] Found ${relevantChunks.length} chunks via keywords`);
    
    // Enhanced scoring: prioritize chunks that match more keywords and have better context
    relevantChunks.sort((a, b) => calculateRelevanceScore(b, keywords) - calculateRelevanceScore(a, keywords));
    
    return relevantChunks.slice(0, limit);
}

/**
 * ---------------------------
 * Hybrid Search (Best of Both)
 * ---------------------------
 */
export async function hybridSearch(
    query: string,
    cache: LocalCache,
    embeddingService: HybridEmbeddingService,
    limit: number = 10
): Promise<SearchResult[]> {
    console.log(`[retrieval] Hybrid search for: "${query}"`);
    
    // Run both searches in parallel
    const [semanticResults, keywordChunks] = await Promise.all([
        semanticSearch(query, cache, embeddingService, limit * 2).catch(() => []),
        Promise.resolve(keywordSearch(query, cache, limit * 2))
    ]);
    
    // Combine and deduplicate with proper type safety
    const seen = new Set<string>();
    const combined: SearchResult[] = [];
    
    // Add semantic results first (higher quality)
    semanticResults.forEach(({ chunk, score }) => {
        // Type-safe ID check
        if (chunk.id && !seen.has(chunk.id)) {
            seen.add(chunk.id);
            combined.push({ chunk, score, matchType: 'semantic' });
        }
    });
    
    // Add keyword results with adjusted scores
    keywordChunks.forEach(chunk => {
        // Type-safe ID check
        if (chunk.id && !seen.has(chunk.id)) {
            seen.add(chunk.id);
            combined.push({ 
                chunk, 
                score: 0.4, // Lower base score for keyword-only matches
                matchType: 'keyword' 
            });
        }
    });
    
    // Final sort by score
    combined.sort((a, b) => b.score - a.score);
    
    console.log(`[retrieval] Hybrid search results: ${combined.length} total`);
    return combined.slice(0, limit);
}

/**
 * ---------------------------
 * Utility Functions
 * ---------------------------
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, normA = 0, normB = 0;
    const n = Math.min(a.length, b.length);
    
    for (let i = 0; i < n; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dot / denominator : 0;
}

function extractKeywords(question: string): string[] {
    const stopWords = new Set([
        'how', 'do', 'i', 'a', 'the', 'is', 'in', 'on', 'with', 'to', 'for', 
        'and', 'or', 'but', 'of', 'at', 'by', 'from', 'as', 'what', 'where',
        'when', 'why', 'which', 'who', 'whom', 'this', 'that', 'these', 'those'
    ]);
    
    return question.toLowerCase()
        .split(/[\s\.,!?;:]+/)
        .filter(word => word.length > 2 && !stopWords.has(word))
        .map(word => word.replace(/[^a-z0-9]/g, '')) // Clean special chars
        .filter(word => word.length > 0);
}

function calculateRelevanceScore(chunk: CodeChunk, keywords: string[]): number {
    const chunkText = chunk.text?.toLowerCase() || '';
    let score = 0;
    
    // Base score: number of keyword matches
    const matches = keywords.filter(keyword => chunkText.includes(keyword)).length;
    score += matches * 10;
    
    // Bonus for exact matches
    keywords.forEach(keyword => {
        if (chunkText === keyword || chunkText.includes(` ${keyword} `)) {
            score += 5;
        }
    });
    
    // Bonus for method/class declarations (usually more important)
    if (chunk.type === 'method_declaration' || chunk.type === 'class_declaration') {
        score += 15;
    } else if (chunk.type === 'trigger_declaration') {
        score += 10;
    }
    
    return score;
}

/**
 * ---------------------------
 * Safe ID Helper Function
 * ---------------------------
 */
function getChunkId(chunk: CodeChunk): string {
    if (!chunk.id) {
        // Generate a deterministic ID if missing
        const content = chunk.text || chunk.code || '';
        return `fallback_${hashCode(chunk.filePath + content)}`;
    }
    return chunk.id;
}

function hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}