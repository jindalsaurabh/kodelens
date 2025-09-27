// src/SemanticCodeIndexer.ts
import * as fs from "fs";
import * as path from "path";
import { LocalCache } from "./database";
import { ApexAdapter } from "./adapters/ApexAdapter";
import { ApexChunkExtractor } from "./extractors/ApexChunkExtractor";
import { CodeChunk } from "./types";
import { HybridEmbeddingService } from "./services/HybridEmbeddingService";
import { logger } from "./utils/logger";

export class SemanticCodeIndexer {
  private embeddingService: HybridEmbeddingService;
  private apexAdapter: ApexAdapter;
  private db: LocalCache;
  private extractor: ApexChunkExtractor;

  /**
   * @param db - instance of LocalCache
   * @param apexAdapter - instance of ApexAdapter
   * @param extensionBasePath - root path of extension/project, used for models
   */
  constructor(db: LocalCache, apexAdapter: ApexAdapter, extensionBasePath: string) {
    this.db = db;
    this.apexAdapter = apexAdapter;
    this.extractor = new ApexChunkExtractor(apexAdapter);

    // Initialize HybridEmbeddingService with the base path
    this.embeddingService = new HybridEmbeddingService(extensionBasePath);
  }

  /** Initialize embedding service */
  async init(): Promise<void> {
    try {
      logger.info("[SemanticCodeIndexer] Initializing embedding service...");
      await this.embeddingService.init?.();
      logger.info("✓ Embedding service initialized successfully");
    } catch (error) {
      logger.error(`[SemanticCodeIndexer] Failed to initialize embedding service: ${error}`);
      throw error;
    }
  }

  /** Generate embeddings for multiple texts */
  async embedTexts(texts: string[]): Promise<Float32Array[]> {
    try {
      logger.info(`[SemanticCodeIndexer] Generating embeddings for ${texts.length} texts`);
      return await this.embeddingService.generateEmbeddings(texts);
    } catch (error) {
      logger.error(`[SemanticCodeIndexer] Failed to generate embeddings: ${error}`);
      throw error;
    }
  }

  /** Index a single file */
  async indexFile(
    filePath: string,
    content?: string
  ): Promise<{ filePath: string; fileHash: string; chunkCount: number } | null> {
    try {
      logger.info(`[SemanticCodeIndexer] Processing ${filePath}`);

      if (!fs.existsSync(filePath)) {
        logger.warn(`[SemanticCodeIndexer] File not found: ${filePath}`);
        return null;
      }

      const fileContent = content ?? fs.readFileSync(filePath, "utf-8");
      const fileHash = this.generateFileHash(fileContent);

      const tree = this.apexAdapter.parse(fileContent);
      const chunks: CodeChunk[] = this.extractor.extractChunks(filePath, tree.rootNode);

      if (!chunks.length) {
        logger.info(`[SemanticCodeIndexer] No chunks found for ${filePath}`);
        return null;
      }

      const texts = chunks.map((c) => c.code || c.text || "").filter((t) => t.trim().length > 0);
      if (texts.length === 0) {
        logger.warn(`[SemanticCodeIndexer] No valid texts to embed for ${filePath}`);
        return null;
      }

      logger.info(`[SemanticCodeIndexer] Generating embeddings for ${texts.length} chunks`);
      const embeddings = await this.embeddingService.generateEmbeddings(texts);

      if (embeddings.length !== texts.length) {
        logger.error(`[SemanticCodeIndexer] Embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`);
        throw new Error("Embedding generation failed - count mismatch");
      }

      await this.db.insertChunksWithEmbeddings(
        chunks.slice(0, embeddings.length),
        filePath,
        fileHash,
        embeddings
      );

      logger.info(`[SemanticCodeIndexer] ✅ Indexed ${chunks.length} chunks for ${filePath}`);
      return { filePath, fileHash, chunkCount: chunks.length };
    } catch (err) {
      logger.error(`[SemanticCodeIndexer] ❌ Failed to index ${filePath}: ${err}`);
      return null;
    }
  }

  /** Batch index multiple files */
  async indexFiles(filePaths: string[]): Promise<Array<{ filePath: string; fileHash: string; chunkCount: number } | null>> {
    const results: Array<{ filePath: string; fileHash: string; chunkCount: number } | null> = [];
    let totalChunks = 0;

    logger.info(`[SemanticCodeIndexer] Starting batch indexing of ${filePaths.length} files`);

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      try {
        const result = await this.indexFile(filePath);
        if (result) {totalChunks += result.chunkCount;}
        results.push(result);

        if (filePaths.length > 5 && (i + 1) % 5 === 0) {
          logger.info(`[SemanticCodeIndexer] Progress: ${i + 1}/${filePaths.length} files processed`);
        }

        if (i < filePaths.length - 1) {await new Promise((resolve) => setTimeout(resolve, 10));}
      } catch (error) {
        logger.error(`[SemanticCodeIndexer] Error processing ${filePath}: ${error}`);
        results.push(null);
      }
    }

    const successCount = results.filter((r) => r !== null).length;
    logger.info(`[SemanticCodeIndexer] ✅ Batch indexing complete: ${successCount}/${filePaths.length} files successful`);
    logger.info(`[SemanticCodeIndexer] ✅ Total chunks indexed: ${totalChunks}`);

    return results;
  }

  /** Simple search stub */
  async search(query: string, limit: number = 10): Promise<Array<{ chunk: CodeChunk; similarity: number }>> {
    try {
      logger.info(`[SemanticCodeIndexer] Searching for: "${query.substring(0, 50)}..."`);
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      logger.info(`[SemanticCodeIndexer] Search completed`);
      return [];
    } catch (error) {
      logger.error(`[SemanticCodeIndexer] Search failed: ${error}`);
      return [];
    }
  }

  /** Return embedding dimensionality */
  getEmbeddingDimensions(): number {
    return this.embeddingService.dim();
  }

  /** Check if initialized */
  isInitialized(): boolean {
  return !!this.embeddingService?.dim && this.embeddingService.dim() > 0;
}


  /** Hash utility */
  private generateFileHash(content: string): string {
    return require("crypto").createHash("sha256").update(content).digest("hex");
  }

  /** Dispose resources */
  async dispose(): Promise<void> {
    try {
      logger.info("[SemanticCodeIndexer] Disposing resources...");
      if (this.embeddingService.dispose) {await this.embeddingService.dispose();}
      logger.info("[SemanticCodeIndexer] ✅ Resources disposed successfully");
    } catch (error) {
      logger.error(`[SemanticCodeIndexer] Error during disposal: ${error}`);
    }
  }
}
