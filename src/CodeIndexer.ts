// src/CodeIndexer.ts
import * as vscode from "vscode";
import * as path from "path";
import { CodeChunk } from "./types";
import { generateHash, computeChunkHash } from "./utils";
import { ApexChunkExtractor } from "./extractors/ApexChunkExtractor";
import { ApexAdapter } from "./adapters/ApexAdapter";
import { LocalCache } from "./database";
import { UnifiedEmbeddingService } from "./services/UnifiedEmbeddingService";
import { EmbeddingService } from "./services/embeddings";

/**
 * CodeIndexer indexes files in a workspace:
 *  - normalizes code
 *  - parses code into AST
 *  - prepares metadata for chunking
 *  - handles delta/upsert and garbage collection
 */
export class CodeIndexer {
  protected extractor: ApexChunkExtractor;

  constructor(
    private workspaceRoot: string,
    private context: vscode.ExtensionContext,
    private db: LocalCache,
    private apexAdapter: ApexAdapter,
    protected embeddingService?: EmbeddingService
  ) {
    this.extractor = new ApexChunkExtractor(this.apexAdapter);
  }

  /**
   * Index multiple chunks with delta and embedding support
   */
  async indexChunks(
    chunks: CodeChunk[],
    filePath: string,
    fileHash: string
  ): Promise<void> {
    // collect only new/changed chunks
    const toIndex: CodeChunk[] = [];
    

    for (const chunk of chunks) {
      const chunkHash =
        chunk.hash ?? computeChunkHash(filePath, chunk.code ?? chunk.text ?? "", chunk.type);
      chunk.hash = chunkHash;

      const existing = this.db.getChunkByHash ? this.db.getChunkByHash(chunkHash) : null;
      if (existing) {continue;}

      toIndex.push(chunk);
    }

    if (toIndex.length === 0) {return;}

    const BATCH_SIZE = this.embeddingService?.batchSize ?? 32;

    if (!this.embeddingService) {
      for (const c of toIndex) {
        this.db.insertOrUpdateChunk(c, fileHash, undefined);
      }
      console.info(`KodeLens: indexed ${toIndex.length} chunk(s) from ${filePath}`);
      return;
    }

    for (let i = 0; i < toIndex.length; i += BATCH_SIZE) {
      const batch = toIndex.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.code ?? c.text ?? "");

      let embeddings: Float32Array[] | null = null;

      if (this.embeddingService) {
  try {
    embeddings = this.embeddingService.generateEmbeddings
      ? await this.embeddingService.generateEmbeddings(texts)
      : await Promise.all(
          texts.map(async (t) => {
            try {
              return await this.embeddingService!.generateEmbedding(t);
            } catch (err) {
              console.error("KodeLens: per-chunk embedding failed", err, t);
              return new Float32Array(this.embeddingService!.dim());
            }
          })
        );
  } catch (err) {
        console.error("KodeLens: batch embedding failed", err);
        embeddings = null;
      }}

      if (embeddings && embeddings.length === batch.length) {
        try {
          if (typeof this.db.insertChunksWithEmbeddings === "function") {
            this.db.insertChunksWithEmbeddings(batch, filePath, fileHash, embeddings);
          } else {
            // fallback per-chunk
            for (let k = 0; k < batch.length; k++) {
              this.db.insertOrUpdateChunk(batch[k], fileHash, embeddings[k]);
            }
          }
        } catch (err) {
          console.error("KodeLens: insertChunksWithEmbeddings failed", err);
          for (let k = 0; k < batch.length; k++) {
            try {
              this.db.insertOrUpdateChunk(batch[k], fileHash, embeddings[k]);
            } catch (err2) {
              console.error("KodeLens: per-chunk upsert failed", err2, "chunk:", batch[k]);
            }
          }
        }
      } else {
        // embeddings unavailable; insert metadata only
        for (const c of batch) {
          try {
            this.db.insertOrUpdateChunk(c, fileHash, undefined);
          } catch (err) {
            console.error("KodeLens: insertOrUpdateChunk (no-embedding) failed:", err, "chunk:", c);
          }
        }
      }
    }

    console.info(`KodeLens: indexed ${toIndex.length} chunk(s) from ${filePath}`);
  }

  /**
   * Index a single file.
   */
  async indexFile(
    filePath: string,
    content: string
  ): Promise<{ filePath: string; fileHash: string } | null> {
    try {
      const normalized = content; // replace with normalizeCode(content) if needed
      const fileHash = generateHash(normalized);

      const chunks = this.extractor.extractChunks(filePath, normalized);

      const validHashes = chunks.map((c) =>
        computeChunkHash(filePath, c.code ?? c.text ?? "", c.type)
      );

      await this.db.deleteChunksForFile(filePath, validHashes);

      await this.indexChunks(chunks, filePath, fileHash);

      return { filePath, fileHash };
    } catch (err) {
      console.error(`Indexing failed for ${filePath}`, err);
      vscode.window.showErrorMessage(
        `KodeLens: Indexing failed for ${path.basename(filePath)}`
      );
      return null;
    }
  }
}
