// src/__mocks__/LocalCacheMock.ts
import { ILocalCache } from '../database';
import { CodeChunk } from '../types';

export class LocalCacheMock implements ILocalCache {
  private chunks: Record<string, CodeChunk> = {};

  init(): void {
    // no-op for mock
  }

  insertChunk(chunk: CodeChunk, filePath: string, fileHash: string): boolean {
    this.chunks[chunk.hash || chunk.id || filePath] = { ...chunk };
    return true;
  }

  insertChunks(chunks: CodeChunk[], filePath: string, fileHash: string): number {
    for (const c of chunks) {
      this.insertChunk(c, filePath, fileHash);
    }
    return chunks.length;
  }

  insertChunksWithEmbeddings(
    chunks: CodeChunk[],
    filePath: string,
    fileHash: string,
    embeddings: Float32Array[]
  ): number {
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i];
      this.insertChunk(chunks[i], filePath, fileHash);
    }
    return chunks.length;
  }

  getEmbeddingsByIds(ids: string[]): { id: string; embedding: Float32Array }[] {
    return ids
      .map((id) => {
        const c = this.chunks[id];
        return c?.embedding ? { id, embedding: c.embedding } : null;
      })
      .filter((x): x is { id: string; embedding: Float32Array } => !!x);
  }

  getAllEmbeddings(): { id: string; embedding: Float32Array }[] {
    return Object.values(this.chunks)
      .filter((c) => c.embedding)
      .map((c) => ({ id: c.id || '', embedding: c.embedding! }));
  }

  getChunkById(id: string): CodeChunk | null {
    return this.chunks[id] || null;
  }

  findChunksByKeywords(keywords: string[]): CodeChunk[] {
    return Object.values(this.chunks).filter((c) =>
      keywords.some((kw) => c.text?.includes(kw))
    );
  }

  async deleteChunksForFile(filePath: string, validChunkHashes: string[]): Promise<void> {
    for (const key of Object.keys(this.chunks)) {
      const c = this.chunks[key];
      if (c.filePath === filePath && c.hash && !validChunkHashes.includes(c.hash)) {
        delete this.chunks[key];
      }
    }
  }

  close(): void {
    // no-op
  }
}
