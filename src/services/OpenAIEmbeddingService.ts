// src/services/OpenAIEmbeddingService.ts
import OpenAI from "openai";
import { EmbeddingService } from "./embeddings";

export class OpenAIEmbeddingService implements EmbeddingService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "text-embedding-3-small") {
    if (!apiKey) {throw new Error("OpenAI API key is required");}
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  dim(): number {
    // OpenAI’s "text-embedding-3-small" → 1536 dims
    return 1536;
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    const res = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    return new Float32Array(res.data[0].embedding);
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const res = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return res.data.map(d => new Float32Array(d.embedding));
  }
}
