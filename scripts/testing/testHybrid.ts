import path from "path";
import { HybridEmbeddingService } from "../src/services/HybridEmbeddingService";

async function main() {
  const basePath = path.resolve(".cache");
  const hybrid = new HybridEmbeddingService(basePath);

  await hybrid.init();

  console.log("Hybrid service initialized.");
  console.log("Active embedding dimension:", hybrid.dim());

  const query = "How do I add two numbers in Python?";
  const embedding = await hybrid.generateEmbedding(query);

  console.log("Generated embedding shape:", embedding.length);
  console.log("First 8 values:", Array.from(embedding.slice(0, 8)));
}

main().catch(console.error);
