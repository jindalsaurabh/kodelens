// src/SemanticCodeIndexer.ts
import fs from "fs";
import crypto from "crypto";
import { EmbeddingService } from "./services/embeddings";
import { LocalCache } from "./database";
import { ApexAdapter } from "./adapters/ApexAdapter";
import { ApexChunkExtractor } from "./extractors/ApexChunkExtractor";
import { CodeChunk } from "./types";
import { logger } from "./utils/logger";

let instanceCounter = 0;

export class SemanticCodeIndexer {
  private db: LocalCache;
  private apexAdapter: ApexAdapter;
  private extractor: ApexChunkExtractor;
  private embeddingService: EmbeddingService;
  private debug: boolean;
  private instanceId: number;

  constructor(
    db: LocalCache,
    apexAdapter: ApexAdapter,
    extractor: ApexChunkExtractor,
    embeddingService: EmbeddingService,
    debug = false
  ) {
    this.db = db;
    this.apexAdapter = apexAdapter;
    this.extractor = extractor;
    this.embeddingService = embeddingService;
    this.debug = debug;
    this.instanceId = ++instanceCounter;

    logger.info(
      `[SemanticCodeIndexer] Created instance #${this.instanceId} with extractor=${extractor.constructor.name}`
    );
  }

  /**
   * Index a single file incrementally
   */
  async indexFile(
    filePath: string,
    content?: string
  ): Promise<{ filePath: string; fileHash: string; chunkCount: number } | null> {
    try {
      logger.info(`[SemanticCodeIndexer #${this.instanceId}] Processing ${filePath}`);

      if (!fs.existsSync(filePath)) {
        logger.warn(`[SemanticCodeIndexer] File not found: ${filePath}`);
        return null;
      }

      const fileContent = content ?? fs.readFileSync(filePath, "utf-8");
      const fileHash = this.generateFileHash(fileContent);

      // Check if the file is already fully indexed
      const stats = this.db.getChunkStatsForFile(filePath);
      if (stats.total > 0) {
        // Simple heuristic: skip if all chunks already have embeddings and fileHash matches
        const firstChunk = this.db.getChunkById(`${filePath}:${fileHash}`);
        if (firstChunk) {
          logger.info(`[SemanticCodeIndexer] Skipping ${filePath}, already indexed and up-to-date`);
          return null;
        }
      }

      // Parse into AST
      const tree = this.apexAdapter.parse(fileContent);

      // Extract chunks (they already have unique id=filePath+chunkHash)
      const chunks: CodeChunk[] = this.extractor.extractChunks(filePath, tree.rootNode, fileContent);

      if (!chunks.length) {
        logger.info(`[SemanticCodeIndexer #${this.instanceId}] No chunks found for ${filePath}`);
        return null;
      }

      if (this.debug) {
        logger.info(`[SemanticCodeIndexer #${this.instanceId}] Extracted ${chunks.length} chunks`);
        chunks.forEach((c, i) => {
          const snippet = (c.code || c.text || "").slice(0, 80).replace(/\s+/g, " ");
          logger.info(`  [chunk ${i}] "${snippet}"`);
        });
      }

      const texts = chunks
        .map((c) => c.code || c.text || "")
        .filter((t) => t.trim().length > 0);

      if (texts.length === 0) {
        logger.warn(`[SemanticCodeIndexer #${this.instanceId}] No valid texts to embed for ${filePath}`);
        return null;
      }

      logger.info(`[SemanticCodeIndexer #${this.instanceId}] Generating embeddings for ${texts.length} chunks`);
      const embeddings = await this.embeddingService.generateEmbeddings(texts);

      if (embeddings.length !== texts.length) {
        throw new Error("Embedding generation failed - count mismatch");
      }

      // Bulk insert/update all chunks with embeddings
      this.db.insertChunksWithEmbeddings(chunks, filePath, fileHash, embeddings);

      logger.info(`[SemanticCodeIndexer #${this.instanceId}] ✅ Indexed ${chunks.length} chunks for ${filePath}`);
      return { filePath, fileHash, chunkCount: chunks.length };
    } catch (err) {
      logger.error(`[SemanticCodeIndexer #${this.instanceId}] ❌ Failed to index ${filePath}: ${err}`);
      return null;
    }
  }

  private generateFileHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }
}
