// src/services/embeddingFactory.ts
import { EmbeddingService, MockEmbeddingService } from "./embeddings";
/**
 * Factory to create an EmbeddingService instance
 * @param choice "openai" | "google" | "mock" | "local-bge"
 * @param apiKey optional API key for cloud providers
 */
export async function createEmbeddingService(
  choice: string,
  apiKey?: string
): Promise<EmbeddingService> {
  switch (choice.toLowerCase()) {
    case "mock":
      return new MockEmbeddingService();

    default:
    console.warn(`[EmbeddingFactory] Unknown embedding model: ${choice}, falling back to 'mock'`);
      return new MockEmbeddingService();
  }
}
