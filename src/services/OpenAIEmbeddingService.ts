// src/services/OpenAIEmbeddingService.ts
import OpenAI from "openai";
import { EmbeddingService } from "./embeddings";

/**
 * OpenAIEmbeddingService
 * Provides embeddings using OpenAI’s API.
 *
 * Notes for prod switch:
 * 1. You can change the model to "text-embedding-3-large" for higher quality.
 *    Make sure to update `dim()` accordingly (1536 -> 3072).
 * 2. Ensure you use a secure API key (from env or secret manager) in prod.
 * 3. Supports batching natively — your generateEmbeddings() already handles multiple texts.
 * 4. Can be swapped directly in SemanticRetrievalService without other code changes.
 */
export class OpenAIEmbeddingService implements EmbeddingService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string, model = "text-embedding-3-small") {
    // If no apiKey passed, fallback to env variable (useful for dev vs prod)
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OpenAI API key is required. Pass it to the constructor or set OPENAI_API_KEY in env."
      );
    }

    this.client = new OpenAI({ apiKey: key });
    this.model = model;
  }

  dim(): number {
    // Update this if you switch to a different model:
    // text-embedding-3-small → 1536
    // text-embedding-3-large → 3072
    return 1536;
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    const res = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });

    // res.data[0].embedding is guaranteed by OpenAI API
    return new Float32Array(res.data[0].embedding);
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const res = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });

    return res.data.map((d) => new Float32Array(d.embedding));
  }
}
