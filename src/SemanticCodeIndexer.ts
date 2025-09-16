// src/SemanticCodeIndexer.ts
import * as vscode from "vscode";
import { CodeIndexer } from "./CodeIndexer";
import { LocalCache } from "./database";
import { CodeChunk } from "./types";
import { createEmbeddingService } from "./services/embeddingFactory";
import { EmbeddingService } from "./services/embeddings";

/**
 * SemanticCodeIndexer
 * Extends CodeIndexer to generate embeddings for each chunk
 */
export class SemanticCodeIndexer extends CodeIndexer {
  private cache: LocalCache;
  //protected embeddingService?: EmbeddingService;

  constructor(
    workspaceRoot: string,
    context: vscode.ExtensionContext,
    cache: LocalCache,
    apexAdapter: any = {} as any
  ) {
    super(workspaceRoot, context, cache, apexAdapter);
    this.cache = cache;
  }

  /**
   * Initialize async services (embeddingService)
   */
  async init(embeddingChoice: string = "mock", apiKey?: string): Promise<void> {
    this.embeddingService = await createEmbeddingService(embeddingChoice, apiKey);
  }

  /**
   * Index a file and also generate embeddings for each chunk
   */
  async indexFileWithEmbeddings(filePath: string, content: string): Promise<void> {
    const result = await this.indexFile(filePath, content);
    if (!result) {return;}

    // Extract chunks using CodeIndexer logic
    // Use a protected getter to access extractor from CodeIndexer
    const chunks: CodeChunk[] = this.getExtractor().extractChunks(filePath, content);
    console.log("Chunks extracted:", chunks);

    // Ensure embedding service is initialized
    if (!this.embeddingService) {
      console.warn("Embedding service not initialized, skipping embeddings");
      return;
    }

    // Generate embeddings for each chunk
    const embeddings = await this.embeddingService.generateEmbeddings(
      chunks.map(c => c.text)
    );

    // Insert into DB with embeddings
    await this.cache.insertChunksWithEmbeddings(
      chunks,
      filePath,
      result.fileHash,
      embeddings
    );

    console.info(`SemanticCodeIndexer: indexed ${chunks.length} chunks with embeddings for ${filePath}`);
  }

  /**
   * Protected getter for the extractor (CodeIndexer.extractor is private)
   */
  private getExtractor() {
    // @ts-ignore: access private member from parent class
    return this.extractor;
  }
}
