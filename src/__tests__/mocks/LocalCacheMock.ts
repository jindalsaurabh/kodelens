// src/__tests__/mocks/LocalCacheMock.ts
import { CodeChunk } from '../../types';

export class LocalCacheMock {
  private chunks: Record<string, CodeChunk> = {};

  getChunkByHash(hash: string): CodeChunk | null {
    return this.chunks[hash] ?? null;
  }

  insertOrUpdateChunk(chunk: CodeChunk, fileHash: string, embedding?: Float32Array) {
    this.chunks[chunk.hash!] = { ...chunk };
  }

  insertChunksWithEmbeddings(
  chunks: CodeChunk[],
  filePath: string,
  fileHash: string,
  embeddings: Float32Array[]
) {
  for (let i = 0; i < chunks.length; i++) {
    this.insertOrUpdateChunk(chunks[i], fileHash, embeddings[i]);
  }
}


  deleteChunksForFile(filePath: string, validHashes: string[]) {
    for (const key of Object.keys(this.chunks)) {
      const chunk = this.chunks[key];
      if (chunk.filePath === filePath && !validHashes.includes(chunk.hash!)) {
        delete this.chunks[key];
      }
    }
  }

  getAllChunks(): CodeChunk[] {
    return Object.values(this.chunks);
  }
}
