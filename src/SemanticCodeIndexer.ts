// src/SemanticCodeIndexer.ts
import * as vscode from "vscode";
import { CodeIndexer } from "./CodeIndexer";
import { ILocalCache } from "./database";
import { CodeChunk } from "./types";
import { createEmbeddingService } from "./services/embeddingFactory";
import { EmbeddingService } from "./services/embeddings";

/**
 * SemanticCodeIndexer
 * Extends CodeIndexer to generate embeddings for each chunk
 */
export class SemanticCodeIndexer extends CodeIndexer {
  private cache: ILocalCache;

  constructor(
    workspaceRoot: string,
    context: vscode.ExtensionContext,
    cache: ILocalCache,
    apexAdapter: any = {} as any
  ) {
    super(workspaceRoot, context, cache as any, apexAdapter);
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

    const chunks: CodeChunk[] = this.extractor.extractChunks(filePath, content);
    console.log("Chunks extracted:", chunks);

    if (!this.embeddingService) {
      console.warn("Embedding service not initialized, skipping embeddings");
      return;
    }

    const chunkTexts = chunks.map(c => c.code).filter((t): t is string => !!t);
    const embeddings = await this.embeddingService.generateEmbeddings(chunkTexts);

    for (let i = 0; i < chunks.length; i++) {
      (chunks[i] as any).embedding = embeddings[i];
    }

    await this.cache.insertChunksWithEmbeddings(chunks, filePath, result.fileHash, embeddings);

    console.info(`SemanticCodeIndexer: indexed ${chunks.length} chunks with embeddings for ${filePath}`);
  }

  /**
   * Index arbitrary chunks with optional embeddings
   * Embeddings are stored in CodeChunk.embedding
   */
  async indexChunks(
    chunks: CodeChunk[],
    filePath: string,
    fileHash: string,
    embeddings?: Float32Array[]
  ): Promise<void> {
    if (embeddings && embeddings.length !== chunks.length) {
      throw new Error("Chunks and embeddings length mismatch");
    }

    for (let i = 0; i < chunks.length; i++) {
      if (embeddings) {chunks[i].embedding = embeddings[i];}
    }

    if (this.cache.insertChunksWithEmbeddings && embeddings) {
      await this.cache.insertChunksWithEmbeddings(chunks, filePath, fileHash, embeddings);
    } else {
      for (const c of chunks) {
        await this.cache.insertChunk(c, filePath, fileHash);
      }
    }

    console.info(`SemanticCodeIndexer: indexed ${chunks.length} chunk(s) for ${filePath}`);
  }
}
