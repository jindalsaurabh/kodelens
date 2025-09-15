//src/services/embeddingFactory.ts
import { EmbeddingService, MockEmbeddingService } from "./embeddings";
import { OpenAIEmbeddingService } from "./OpenAIEmbeddingService";
import { GoogleGeminiEmbeddingService } from "./GoogleGeminiEmbeddingService";

export function createEmbeddingService(choice: string, apiKey?: string): EmbeddingService {
  switch (choice.toLowerCase()) {
    case "openai":
        if (!apiKey) {throw new Error("OpenAI API key required");}
      return new OpenAIEmbeddingService(apiKey);
    case "google":
        if (!apiKey) {throw new Error("Google Gemini API key required");}
      //return new GoogleGeminiEmbeddingService(apiKey);
      return new GoogleGeminiEmbeddingService("models/embedding-001");
    case "mock":
      return new MockEmbeddingService();
    default:
      throw new Error(`Unknown embedding model: ${choice}`);
  }
}
