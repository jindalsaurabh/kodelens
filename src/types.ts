// src/types.ts

// Represents a raw, unprocessed code chunk directly from the AST
export interface RawCodeChunk {
    type: string; // e.g., 'class_declaration', 'method_declaration'
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
}

// Represents a processed chunk, ready for caching and embedding
export interface CodeChunk extends RawCodeChunk {
    hash: string; // SHA-256 hash of the normalized .text
}