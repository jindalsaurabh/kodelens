// src/services/GoogleGeminiEmbeddingService.ts
import { EmbeddingService } from "./embeddings";
import { GoogleAuth } from "google-auth-library";

export class GoogleGeminiEmbeddingService implements EmbeddingService {
  private readonly model: string;
  private readonly embeddingDim: number;

  constructor(model: string = "models/embedding-001", dim: number = 768) {
    this.model = model;
    this.embeddingDim = dim;
  }

  dim(): number {
    return this.embeddingDim;
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    const [embedding] = await this.generateEmbeddings([text]);
    return embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) {return [];}

    const auth = new GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) {throw new Error("Failed to obtain Google access token");}

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts.map((t) => ({ content: t })),
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as any;

    if (!json || !Array.isArray(json.data)) {
      throw new Error('Gemini response invalid: "data" array missing');
    }

    return json.data.map(
      (d: any) => new Float32Array(d.embedding.values)
    );
  }
}
