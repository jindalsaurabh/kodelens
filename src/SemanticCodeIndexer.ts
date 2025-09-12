// src/SemanticCodeIndexer.ts
import * as vscode from "vscode";
import { CodeIndexer } from "./CodeIndexer";
import { LocalCache } from "./database";
import { MockEmbeddingService, EmbeddingService } from "./services/embeddings";
import { CodeChunk } from "./types";

/**
 * SemanticCodeIndexer
 * Extends CodeIndexer to generate embeddings for each chunk
 */
export class SemanticCodeIndexer extends CodeIndexer {
  private cache: LocalCache;
  private embeddingService: EmbeddingService;

  constructor(
    workspaceRoot: string,
    context: vscode.ExtensionContext,
    cache: LocalCache,
    embeddingService?: EmbeddingService
  ) {
    super(workspaceRoot, context);
    this.cache = cache;
    this.embeddingService = embeddingService || new MockEmbeddingService();
  }

  /**
   * Index a single file (overrides base indexFile)
   * - Normalizes code
   * - Computes hash
   * - Parses code
   * - Generates embeddings for each chunk
   * - Stores in cache
   */
  async indexFileWithEmbeddings(
    filePath: string,
    content: string
  ): Promise<{ filePath: string; hash: string; ast: any } | null> {
    const result = await super.indexFile(filePath, content);
    if (!result) {return null;}

    // 1. Extract chunks (reuse normalizeCode / existing chunking)
    const normalizedText = content; // super.indexFile already normalizes
    const chunks: CodeChunk[] = this.extractChunksForFile(filePath, normalizedText);

    // 2. Generate embeddings for each chunk
    const texts = chunks.map(c => c.text || c.code || '');
    const embeddings = await this.embeddingService.generateEmbeddings(texts);

    // 3. Insert chunks into cache including embeddings
    if (!this.cache.insertChunksWithEmbeddings) {
        throw new Error(
            "LocalCache must implement insertChunksWithEmbeddings for semantic indexing"
        );
        }
    await this.cache.insertChunksWithEmbeddings(chunks, filePath, result.hash, embeddings);
    
    return result;
  }

  /**
   * Extract chunks from file content
   * - You can reuse your existing chunking logic from CodeIndexer
   */
  private extractChunksForFile(filePath: string, text: string): CodeChunk[] {
    // TODO: replace with real chunk extraction logic
    // For now, simple dummy split by lines as placeholder
    const lines = text.split("\n");
    return lines.map((line, idx) => ({
      id: `${filePath}-${idx}`,
      text: line,
      code: line,
      type: "line",
      hash: `h-${idx}`,
      startPosition: { row: idx, column: 0 },
      endPosition: { row: idx, column: line.length },
      filePath,
      name: `line-${idx}`,
      range: { start: { row: idx, column: 0 }, end: { row: idx, column: line.length } },
      startLine: idx,
      endLine: idx,
      embedding: undefined, // will be filled later
    }));
  }
}
