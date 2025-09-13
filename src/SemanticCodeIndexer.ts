// src/SemanticCodeIndexer.ts
import * as vscode from "vscode";
import { CodeIndexer } from "./CodeIndexer";
import { LocalCache } from "./database";
import { EmbeddingService } from "./services/embeddings";
import { CodeChunk } from "./types";
import { createEmbeddingService } from "./services/embeddingFactory";

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
    embeddingChoice: string = "mock",
    apiKey?: string
  ) {
    super(workspaceRoot, context);
    this.cache = cache;
    this.embeddingService = createEmbeddingService(embeddingChoice, apiKey);
  }

  /**
   * Index a file and also generate embeddings for each chunk
   */
  async indexFileWithEmbeddings(filePath: string, content: string): Promise<void> {
    const result = await this.indexFile(filePath, content);
    if (!result) {return;}

    // Extract chunks using CodeIndexer logic
    // TODO: replace with real AST-based chunk extraction
    const chunks: CodeChunk[] = this.extractChunks(filePath, result.ast, content);

    // Generate embeddings for each chunk
    const embeddings = await this.embeddingService.generateEmbeddings(
      chunks.map(c => c.text)
    );

    // Insert into DB with embeddings
    this.cache.insertChunksWithEmbeddings(chunks, filePath, result.hash, embeddings);
  }
}
