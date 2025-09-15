// src/CodeIndexer.ts
import * as vscode from "vscode";
import * as path from "path";
import { CodeChunk } from "./types";
import { generateHash, computeChunkHash } from "./utils";
import { ApexChunkExtractor } from "./extractors/ApexChunkExtractor";
import { ApexAdapter } from "./adapters/ApexAdapter";
import { LocalCache } from "./database";
// import { EmbeddingService } from "./services/embeddings"; 

/**
 * CodeIndexer indexes files in a workspace:
 *  - normalizes code
 *  - parses code into AST
 *  - prepares metadata for chunking
 */
export class CodeIndexer {
  private extractor: ApexChunkExtractor;

constructor(
  private workspaceRoot: string,
  private context: vscode.ExtensionContext,
  private db: LocalCache,
  private apexAdapter: ApexAdapter,
  // Embedding service should implement:
  // generateEmbedding(text: string): Promise<Float32Array>
  // generateEmbeddings?(texts: string[]): Promise<Float32Array[]>
  private embeddingService?: any
) {
  this.extractor = new ApexChunkExtractor(this.apexAdapter);
}

async indexChunks(chunks: CodeChunk[], filePath: string, fileHash: string): Promise<void> {
  // collect only new/changed chunks
  const toIndex: CodeChunk[] = [];

  for (const chunk of chunks) {
    // prefer extractor-provided hash if present; otherwise compute one (include filePath to avoid collisions across files)
  //    const chunkHash = chunk.hash ?? generateHash(`${filePath}::${chunk.type ?? 'unknown'}::${chunk.code ?? chunk.text ?? ''}`);
    const chunkHash = chunk.hash ?? computeChunkHash(filePath, chunk.code ?? chunk.text ?? '', chunk.type);
    // ensure chunk carries the canonical hash for DB insert
    chunk.hash = chunkHash;

    // check DB (better-sqlite3 API is sync)
    const existing = this.db.getChunkByHash ? this.db.getChunkByHash(chunkHash) : null;
    if (existing) {
      continue; // unchanged
    }

    toIndex.push(chunk);
  }

  if (toIndex.length === 0) {
    // nothing to do
    return;
  }

  // batching parameters (tweak as needed)
  const BATCH_SIZE = 32; // safe default; adjust per API quotas/perf

  // If no embedding service provided, just insert metadata (no embeddings)
  if (!this.embeddingService) {
    for (const c of toIndex) {
      this.db.insertOrUpdateChunk(c, fileHash, undefined);
    }
    return;
  }

  // process in batches
  for (let i = 0; i < toIndex.length; i += BATCH_SIZE) {
    const batch = toIndex.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.code ?? c.text ?? '');

    let embeddings: Float32Array[] | null = null;

    /*
    try {
      // Prefer batch API if available
      if (typeof this.embeddingService.generateEmbeddings === "function") {
        embeddings = await this.embeddingService.generateEmbeddings(texts);
      } else {
        // Fallback: call single-item API repeatedly
        embeddings = [];
        for (const t of texts) {
          const e = await this.embeddingService.generateEmbedding(t);
          embeddings.push(e);
        }
      }
    }
      */
     try {
      embeddings = this.embeddingService.generateEmbeddings
        ? await this.embeddingService.generateEmbeddings(texts)
        : await Promise.all(texts.map(t => this.embeddingService.generateEmbedding(t)));
    }
       catch (err) {
      console.error("KodeLens: embedding generation failed for batch:", err);
      embeddings = null;
    }

    if (embeddings && embeddings.length === batch.length) {
      // Insert chunks together with embeddings (your LocalCache has this helper)
      try {
        this.db.insertChunksWithEmbeddings(batch, filePath, fileHash, embeddings);
      } catch (err) {
        console.error("KodeLens: insertChunksWithEmbeddings failed:", err);
        // attempt per-chunk fallback
        for (let k = 0; k < batch.length; k++) {
          try {
            this.db.insertOrUpdateChunk(batch[k], fileHash, embeddings[k]);
          } catch (err2) {
            console.error("KodeLens: per-chunk upsert failed:", err2, "chunk:", batch[k]);
          }
        }
      }
    } else {
      // Embeddings not available — insert metadata only so chunk is still discoverable by other mechanisms
      for (const c of batch) {
        try {
          this.db.insertOrUpdateChunk(c, fileHash, undefined);
        } catch (err) {
          console.error("KodeLens: insertOrUpdateChunk (no-embedding) failed:", err, "chunk:", c);
        }
      }
    }
  }

  // log summary
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
      const normalized = content; // Replace with normalizeCode(content) if needed
      const fileHash = generateHash(normalized);

      // Extract semantic chunks via ApexChunkExtractor
      const chunks = this.extractor.extractChunks(filePath, normalized);

      // collect the valid hashes
      //const validHashes = chunks.map(c => generateHash(c.code + c.type));
      const validHashes = chunks.map(c => computeChunkHash(filePath, c.code ?? c.text ?? '', c.type));

      // cleanup any stale chunks for this file
      await this.db.deleteChunksForFile(filePath, validHashes);

      // Index chunks (store only new/changed ones)
      await this.indexChunks(chunks, filePath, fileHash);
      return {
        filePath,
        fileHash,
      };} catch (err) {
      console.error(`Indexing failed for ${filePath}`, err);
      vscode.window.showErrorMessage(`KodeLens: Indexing failed for ${path.basename(filePath)}`);
      return null;
    }
  }
}
