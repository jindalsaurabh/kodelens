// src/services/GoogleGeminiEmbeddingService.ts
import { GoogleAuth } from "google-auth-library";
import { EmbeddingService } from "./embeddings";

/**
 * GoogleGeminiEmbeddingService
 * - Default model: "gemini-embedding-001"
 * - Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent
 *
 * Auth priority:
 * 1. API key from process.env.GOOGLE_API_KEY
 * 2. Service account (GOOGLE_APPLICATION_CREDENTIALS)
 */
export class GoogleGeminiEmbeddingService implements EmbeddingService {
  private auth?: GoogleAuth;
  private model: string;
  private _dim: number;
  private useApiKey: boolean;

  constructor(model = "gemini-embedding-001", dim = 3072) {
    this.model = model;
    this._dim = dim;

    if (process.env.GOOGLE_API_KEY) {
      this.useApiKey = true;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      this.useApiKey = false;
      this.auth = new GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ["https://www.googleapis.com/auth/generative-language"], // ✅ correct scope
      });
    } else {
      throw new Error(
        "Missing Google auth: set GOOGLE_API_KEY (recommended) or GOOGLE_APPLICATION_CREDENTIALS"
      );
    }
  }

  dim(): number {
    return this._dim;
  }

  private async getAccessToken(): Promise<string> {
    if (this.useApiKey) {
      return process.env.GOOGLE_API_KEY as string;
    }
    if (!this.auth) {throw new Error("GoogleAuth not initialized");}
    const client = await this.auth.getClient();
    const access = await client.getAccessToken();
    const token = (access && (access as any).token) || access;
    if (!token) {throw new Error("Failed to obtain access token from GoogleAuth");}
    return token as string;
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    const res = await this.generateEmbeddings([text]);
    return res[0];
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];

    for (const text of texts) {
      const payload = {
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.useApiKey) {
        headers["x-goog-api-key"] = process.env.GOOGLE_API_KEY as string;
      } else {
        headers["Authorization"] = `Bearer ${await this.getAccessToken()}`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const textErr = await res.text().catch(() => "");
        throw new Error(
          `Gemini API error: ${res.status} ${res.statusText} - ${textErr}`
        );
      }

      const json: any = await res.json();

      // ✅ Handle all known response shapes
      let arr: number[] | undefined;
      if (json?.embedding?.values) {
        arr = json.embedding.values;
      } else if (Array.isArray(json?.embeddings)) {
        arr = json.embeddings[0]?.values ?? json.embeddings[0];
      } else if (Array.isArray(json?.data)) {
        arr =
          json.data[0]?.embedding?.values ??
          json.data[0]?.embedding ??
          json.data[0]?.values;
      } else if (Array.isArray(json?.results)) {
        arr =
          json.results[0]?.embedding?.values ??
          json.results[0]?.embedding ??
          json.results[0]?.values;
      }

      if (!arr) {
        throw new Error(
          "Unexpected Gemini response shape: " +
            JSON.stringify(json).slice(0, 200)
        );
      }

      results.push(new Float32Array(arr.map((v: any) => Number(v))));
    }

    return results;
  }
}
