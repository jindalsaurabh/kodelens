// src/chunking.ts
import * as crypto from 'crypto';
import { RawCodeChunk, CodeChunk } from './types';

/**
 * Normalizes code text for consistent processing and hashing.
 * @param text The raw code string from the AST.
 * @returns The normalized string.
 */

// src/chunking.ts (add this function)
export function extractChunksFromAst(rootNode: any, fileContent: string): RawCodeChunk[] {
    const chunks: RawCodeChunk[] = [];
    // Types of nodes we want to chunk
    const targetNodeTypes = new Set(['class_declaration', 'method_declaration']);

    // Recursive function to walk the tree
    function walk(node: any) {
        if (targetNodeTypes.has(node.type)) {
            // This is the node we want to chunk. Extract its text.
            const chunkText = node.text;
            chunks.push({
                type: node.type,
                text: chunkText,
                startPosition: node.startPosition,
                endPosition: node.endPosition
            });
            // We don't walk children of a chunked node to avoid nested chunks
        }

        // If it's not a target node, walk all its children.
        if (node.children) {
            for (const child of node.children) {
                walk(child);
            }
        }
    }

    // Start the walk from the root node
    walk(rootNode);
    return chunks;
}

export function normalizeText(text: string): string {
    // Trim whitespace. Add other normalization rules here later if needed.
    return text.trim();
}

/**
 * Generates a SHA-256 hash of the given text.
 * @param text The input text (should be normalized first).
 * @returns A hexadecimal string representing the hash.
 */
export function generateHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}