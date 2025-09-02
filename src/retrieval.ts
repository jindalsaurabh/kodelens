// src/retrieval.ts
import { LocalCache } from './database'; // We'll need to add a new method to the cache
import { CodeChunk } from './types'; // <-- Add this import
export async function findRelevantChunks(question: string, cache: LocalCache): Promise<CodeChunk[]> {
    // 1. Simple keyword extraction (split by space, remove common words)
    const keywords = extractKeywords(question);
    console.log('Extracted keywords:', keywords); // <-- ADD THIS LINE

    if (keywords.length === 0) {
        return [];
    }

    // 2. Query the database for chunks containing these keywords
    const relevantChunks = await cache.findChunksByKeywords(keywords);
    console.log('Chunks found from DB:', relevantChunks); // <-- ADD THIS LINE
    
    // 3. Rank chunks by number of keyword matches (simple scoring)
    relevantChunks.sort((a, b) => calculateScore(b, keywords) - calculateScore(a, keywords));
    
    // 4. Return the top 5 most relevant chunks
    return relevantChunks.slice(0, 5);
}

// Helper function to extract keywords from a question
function extractKeywords(question: string): string[] {
    // Simple implementation: split by spaces and filter out short/common words
    const stopWords = new Set(['how', 'do', 'i', 'a', 'the', 'is', 'in', 'on', 'with']);
    return question.toLowerCase()
                  .split(/\s+/)
                  .filter(word => word.length > 2 && !stopWords.has(word));
}

// Helper function to calculate a simple relevance score
function calculateScore(chunk: CodeChunk, keywords: string[]): number {
    const chunkText = chunk.text.toLowerCase();
    return keywords.filter(keyword => chunkText.includes(keyword)).length;
}