// src/SemanticCodeIndexer.ts
import fs from "fs";
import * as path from "path"; // ✅ Added missing import
import { EmbeddingService } from "./services/embeddings";
import { LocalCache } from "./database";
import { ApexAdapter } from "./adapters/ApexAdapter";
import { ApexChunkExtractor } from "./extractors/ApexChunkExtractor";
import { CodeChunk } from "./types";
import { logger } from "./utils/logger";
import { generateHash } from "./utils";

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
      const fileHash = generateHash(fileContent);

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

  // ✅ Fixed: Use existing methods and properties
  private async extractChunks(filePath: string, sourceCode?: string): Promise<CodeChunk[]> {
    if (!sourceCode) {
      sourceCode = await fs.promises.readFile(filePath, 'utf8');
    }
    
    // ✅ Fixed: Use existing parse method, not parseApex
    const tree = this.apexAdapter.parse(sourceCode);
    
    // ✅ Fixed: Use existing extractor property, not chunkExtractor
    return this.extractor.extractChunks(filePath, tree.rootNode, sourceCode);
  }

  private async storeChunksWithEmbeddings(
    filePaths: (string | any)[], // ✅ Allow both string and vscode.Uri
    chunks: CodeChunk[], 
    embeddings: Float32Array[]
  ): Promise<void> {
    // Group chunks by file path for storage
    const chunksByFile = new Map<string, CodeChunk[]>();
    const embeddingsByFile = new Map<string, Float32Array[]>();
    
    chunks.forEach((chunk, index) => {
      const filePath = chunk.filePath;
      if (!chunksByFile.has(filePath)) {
        chunksByFile.set(filePath, []);
        embeddingsByFile.set(filePath, []);
      }
      chunksByFile.get(filePath)!.push(chunk);
      embeddingsByFile.get(filePath)!.push(embeddings[index]);
    });
    
    // Store chunks for each file
    for (const [filePath, fileChunks] of chunksByFile) {
      const fileEmbeddings = embeddingsByFile.get(filePath)!;
      const fileHash = generateHash(await fs.promises.readFile(filePath, 'utf8'));
      
      // ✅ Fixed: Use existing db property, not cache
      await this.db.insertChunksWithEmbeddings(
        fileChunks, 
        filePath, 
        fileHash, 
        fileEmbeddings
      );
    }
  }

  async indexFilesBatch(filePaths: (string | any)[], batchSize: number = 5): Promise<void> {
    const allChunks: CodeChunk[] = [];
    
    // Phase 1: Extract chunks from all files in batch
    for (const fileUri of filePaths) {
      try {
        // ✅ Fixed: Handle vscode.Uri vs string properly
        const filePath = typeof fileUri === 'string' ? fileUri : fileUri.fsPath;
        const sourceCode = await fs.promises.readFile(filePath, 'utf8');
        const chunks = await this.extractChunks(filePath, sourceCode);
        allChunks.push(...chunks);
        
        // ✅ Fixed: Use logger instead of console, path is now imported
        logger.info(`[SemanticCodeIndexer] Extracted ${chunks.length} chunks from ${path.basename(filePath)}`);
      } catch (error) {
        // ✅ Fixed: filePath is now properly defined in scope
        const filePath = typeof fileUri === 'string' ? fileUri : fileUri.fsPath;
        logger.error(`[SemanticCodeIndexer] Failed to extract chunks from ${filePath}:`);
      }
    }
    
    if (allChunks.length === 0) {
      logger.info(`[SemanticCodeIndexer] No chunks extracted from batch of ${filePaths.length} files`);
      return;
    }
    
    // Phase 2: Generate embeddings for all chunks in batch
    const texts = allChunks.map(c => c.text);
    logger.info(`[SemanticCodeIndexer] Generating embeddings for ${texts.length} chunks...`);
    
    const embeddings = await this.embeddingService.generateEmbeddings(texts);
    
    // Phase 3: Store all chunks with embeddings
    await this.storeChunksWithEmbeddings(filePaths, allChunks, embeddings);
    
    logger.info(`[SemanticCodeIndexer] Successfully processed batch: ${allChunks.length} chunks from ${filePaths.length} files`);
  }

  async indexFilesParallel(filePaths: (string | any)[], batchSize: number = 5, concurrency: number = 3): Promise<void> {
    const batches: (string | any)[][] = [];
    
    // Create batches
    for (let i = 0; i < filePaths.length; i += batchSize) {
      batches.push(filePaths.slice(i, i + batchSize));
    }
    
    // Process batches with limited concurrency
    for (let i = 0; i < batches.length; i += concurrency) {
      const currentBatches = batches.slice(i, i + concurrency);
      
      logger.info(`[SemanticCodeIndexer] Processing batches ${i + 1}-${i + currentBatches.length} of ${batches.length}`);
      
      // Process batches in parallel
      await Promise.allSettled(
        currentBatches.map((batch, batchIndex) => 
          this.indexFilesBatch(batch).catch(error => {
            logger.error(`[SemanticCodeIndexer] Batch ${i + batchIndex + 1} failed:`);
            throw error;
          })
        )
      );
      
      // Optional: Add small delay to prevent resource exhaustion
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}