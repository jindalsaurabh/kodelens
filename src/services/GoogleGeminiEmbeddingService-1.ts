// src/services/GoogleGeminiEmbeddingService.ts
import { EmbeddingService } from "./embeddings";
//import fetch from {"node-fetch";}

interface EmbedResponse {
  embedding: {
    values: number[];
  };
}

export class GoogleGeminiEmbeddingService implements EmbeddingService {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "models/embedding-001") {
    if (!apiKey) {throw new Error("Google Gemini API key is required");}
    this.apiKey = apiKey;
    this.model = model;
  }

  dim(): number {
    // Gemini embedding-001 → 768 dims
    return 768;
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${this.model}:embedText?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as EmbedResponse;
    return new Float32Array(data.embedding.values);

}

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    for (const text of texts) {
      results.push(await this.generateEmbedding(text));
    }
    return results;
  }
}
