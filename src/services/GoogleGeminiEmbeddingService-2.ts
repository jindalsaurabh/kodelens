// src/services/GoogleGeminiEmbeddingService.ts
import { GoogleAuth } from "google-auth-library";
import { EmbeddingService } from "./embeddings";

/**
 * GoogleGeminiEmbeddingService
 * Minimal, robust wrapper for Gemini embeddings REST API using a GCP service account.
 *
 * - model default: "gemini-embedding-001" (official Gemini embedding model)
 * - endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent
 *   (matches official examples). See docs. :contentReference[oaicite:5]{index=5}
 */
export class GoogleGeminiEmbeddingService implements EmbeddingService {
  private auth: GoogleAuth;
  private model: string;
  private _dim: number;

  constructor(model = "gemini-embedding-001", dim = 3072) {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error("Set GOOGLE_APPLICATION_CREDENTIALS to your service-account JSON path");
    }
    this.auth = new GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    this.model = model;
    this._dim = dim; // default Gemini embedding size; you can control output_dim via request
  }

  dim(): number {
    return this._dim;
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    const res = await this.generateEmbeddings([text]);
    return res[0];
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    if (!texts.length) {return [];}

    // 1) get access token via google-auth-library (service account)
    const client = await this.auth.getClient();
    const access = await client.getAccessToken();
    const token = (access && (access as any).token) || access; // library returns token in different shapes

    if (!token) {throw new Error("Failed to obtain access token from GoogleAuth");}

    // 2) build request payload (embedContent accepts a list of content parts)
    // Use the same request shape shown in the official docs. :contentReference[oaicite:6]{index=6}
    const payload: any = {
      model: `models/${this.model}`,
      content: texts.map((t) => ({ parts: [{ text: t }] })),
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini API error: ${res.status} ${res.statusText} - ${text}`);
    }

    const json = (await res.json()) as any;

    // 3) Support a couple of plausible response shapes (the docs show several SDK shapes):
    // - json.embeddings (client SDK)
    // - json.data[].embedding / json.data[].values
    // - json.embeddings[].values
       // 3) Parse response shapes
    let arrays: number[][] = [];

    if (Array.isArray(json?.embeddings)) {
      arrays = json.embeddings.map((e: any) => e.values ?? e);
    } else if (Array.isArray(json?.data)) {
      arrays = json.data.map((d: any) => (d.embedding?.values ?? d.embedding ?? d.values ?? d));
    } else if (Array.isArray(json?.results)) {
      arrays = json.results.map((r: any) => r.embedding?.values ?? r.embedding ?? r.values ?? r);
    } else if (Array.isArray(json)) {
      arrays = json as number[][];
    }

    if (arrays.length === 0) {
      throw new Error("Unexpected Gemini response shape: " + JSON.stringify(json).slice(0, 200));
    }

    // 4) Convert to Float32Array[]
    return arrays.map((arr) => {
      const f = new Float32Array(arr.length);
      for (let i = 0; i < arr.length; i++) {f[i] = Number(arr[i]);}
      return f;
    });
  }}