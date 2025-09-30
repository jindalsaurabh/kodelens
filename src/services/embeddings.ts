// src/services/embeddings.ts
import crypto from 'crypto';
export interface EmbeddingService {
  dim(): number;
  generateEmbedding(text: string): Promise<Float32Array>;
  generateEmbeddings(texts: string[]): Promise<Float32Array[]>;
  init?(): Promise<void>;
  batchSize?: number;
  dispose?(): Promise<void>;
}

export interface EmbeddingService {
  init?(): Promise<void>;  // optional init hook
  generateEmbedding(text: string): Promise<Float32Array>;
}


/**
 * MockEmbeddingService
 * - Deterministic pseudo-embeddings used for testing & development.
 * - Good for validating pipeline without heavy models.
 */
export class MockEmbeddingService implements EmbeddingService {
  private _dim: number;

  constructor(dim = 384) {
    this._dim = dim;
    console.log(`[MockEmbeddingService] Initialized with dim=${dim}`);
  }

  async init(): Promise<void> {
    console.log("[MockEmbeddingService] init() called");
  }

  dim(): number {
    return this._dim;
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    console.log(`[MockEmbeddingService] generateEmbedding() called with text length=${text.length}`);
    return this._embFromText(text);
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    console.log(`[MockEmbeddingService] generateEmbeddings() called with ${texts.length} texts`);
    return Promise.all(texts.map((t) => this._embFromText(t)));
  }

  private _embFromText(text: string): Float32Array {
    console.log(`[MockEmbeddingService] _embFromText() hashing text snippet="${text.slice(0, 30)}..."`);
    const h = crypto.createHash("sha256").update(text).digest();
    const arr = new Float32Array(this._dim);

    let state = 0;
    for (let i = 0; i < h.length; i++) {
      state = (state << 8) | h[i];
    }
    state = state >>> 0;

    for (let i = 0; i < this._dim; i++) {
      state = (1664525 * state + 1013904223) >>> 0;
      arr[i] = (state / 0xffffffff) * 2 - 1;
    }

    // normalize
    let norm = 0;
    for (let i = 0; i < arr.length; i++) {
      norm += arr[i] * arr[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < arr.length; i++) {
      arr[i] /= norm;
    }
    return arr;
  }
}
