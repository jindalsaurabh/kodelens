// src/services/embeddingFactory.ts
import { EmbeddingService, MockEmbeddingService } from "./embeddings";
import { OpenAIEmbeddingService } from "./OpenAIEmbeddingService";
import { GoogleGeminiEmbeddingService } from "./GoogleGeminiEmbeddingService";

/**
 * Factory to create an EmbeddingService instance
 * @param choice "openai" | "google" | "mock" | "local"
 * @param apiKey optional API key for cloud providers
 */
export async function createEmbeddingService(
  choice: string,
  apiKey?: string
): Promise<EmbeddingService> {
  switch (choice.toLowerCase()) {
    case "openai":
      if (!apiKey) {throw new Error("OpenAI API key required");}
      return new OpenAIEmbeddingService(apiKey);

    case "google":
      if (!apiKey) {throw new Error("Google Gemini API key required");}
      return new GoogleGeminiEmbeddingService("models/embedding-001");

    case "mock":
      return new MockEmbeddingService();

    case "local":
      // Dynamic import to load LocalEmbeddingService only when needed
      const { LocalEmbeddingService } = await import( "../embeddings/LocalEmbeddingService.js");
      return new LocalEmbeddingService();

    default:
      throw new Error(`Unknown embedding model: ${choice}`);
  }
}
