"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockEmbeddingService = void 0;
// src/services/embeddings.ts
const crypto_1 = __importDefault(require("crypto"));
/**
 * MockEmbeddingService
 * - Deterministic pseudo-embeddings used for testing & development.
 * - Good for validating pipeline without heavy models.
 */
class MockEmbeddingService {
    constructor(dim = 384) {
        this._dim = dim;
    }
    dim() { return this._dim; }
    async generateEmbedding(text) {
        return this._embFromText(text);
    }
    async generateEmbeddings(texts) {
        return Promise.all(texts.map(t => this._embFromText(t)));
    }
    _embFromText(text) {
        const h = crypto_1.default.createHash('sha256').update(text).digest();
        const arr = new Float32Array(this._dim);
        // simple deterministic expansion of bytes to floats
        let state = 0;
        for (let i = 0; i < h.length; i++) {
            state = (state << 8) | h[i];
        }
        state = state >>> 0;
        for (let i = 0; i < this._dim; i++) {
            state = (1664525 * state + 1013904223) >>> 0;
            arr[i] = ((state / 0xffffffff) * 2) - 1;
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
exports.MockEmbeddingService = MockEmbeddingService;
