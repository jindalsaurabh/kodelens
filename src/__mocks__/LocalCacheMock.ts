// src/__mocks__/LocalCacheMock.ts
import { ILocalCache } from '../database';
import { CodeChunk } from '../types';

export class LocalCacheMock implements ILocalCache {
  SCHEMA_VERSION: number = 2; // match the real LocalCache
  private chunks: Record<string, CodeChunk> = {};
  private embeddings: Record<string, Float32Array> = {};

  /** ---------------- Core Methods ---------------- */
  init(): void {
    // no-op for mock
  }

  insertChunk(chunk: CodeChunk, filePath: string, fileHash: string): boolean {
    this.chunks[chunk.hash!] = { ...chunk };
    return true;
  }

  insertChunks(chunks: CodeChunk[], filePath: string, fileHash: string): number {
    chunks.forEach((c) => this.insertChunk(c, filePath, fileHash));
    return chunks.length;
  }

  insertChunksWithEmbeddings(
    chunks: CodeChunk[],
    filePath: string,
    fileHash: string,
    embeddings: Float32Array[]
  ): number {
    if (chunks.length !== embeddings.length) {throw new Error("Chunks and embeddings length mismatch");}
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const e = embeddings[i];
      this.chunks[c.hash!] = { ...c };
      this.embeddings[c.hash!] = e;
    }
    return chunks.length;
  }

  getEmbeddingsByIds(ids: string[]): { id: string; embedding: Float32Array }[] {
    return ids
      .filter((id) => this.embeddings[id])
      .map((id) => ({ id, embedding: this.embeddings[id] }));
  }

  getAllEmbeddings(): { id: string; embedding: Float32Array }[] {
    return Object.entries(this.embeddings).map(([id, embedding]) => ({ id, embedding }));
  }

  getChunkById(id: string): CodeChunk | null {
    return this.chunks[id] || null;
  }

  getChunkByHash(hash: string): CodeChunk | null {
    return this.chunks[hash] || null;
  }

  deleteChunksForFile(filePath: string, validChunkHashes: string[]): Promise<void> {
    for (const key of Object.keys(this.chunks)) {
      const chunk = this.chunks[key];
      if (chunk.filePath === filePath && !validChunkHashes.includes(chunk.hash!)) {
        delete this.chunks[key];
        delete this.embeddings[key];
      }
    }
    return Promise.resolve();
  }

  findChunksByKeywords(keywords: string[]): CodeChunk[] {
    return Object.values(this.chunks).filter((c) =>
      keywords.some((kw) => c.text.includes(kw))
    );
  }

  getAllChunks(): CodeChunk[] {
    return Object.values(this.chunks);
  }

  close(): void {
    // no-op
  }
}
