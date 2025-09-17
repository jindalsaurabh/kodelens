//scripts/test-embeddings.ts
import "dotenv/config";
import { UnifiedEmbeddingService } from "../src/services/UnifiedEmbeddingService";

async function main() {
  // Pick provider name from env or fallback
  const provider = process.env.EMBEDDING_PROVIDER || "bge-micro";
  const apiKey = process.env.HF_API_KEY!;

  if (provider === "bge-micro" && !apiKey) {
    console.error("❌ Missing HF_API_KEY in .env");
    process.exit(1);
  }

  // Create embedding service dynamically
  const embeddingService = UnifiedEmbeddingService.fromProviderName(provider, apiKey);

  console.log(`🔹 Using provider: ${provider}`);

  const query = "How do I add two numbers in Apex?";
    const vec = await embeddingService.generateEmbedding(query);

  console.log("✅ Got embedding vector!");
  console.log("   Dimension:", vec.length);
  console.log("   First 10 values:", Array.from(vec).slice(0, 10));
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
