// scripts/testRustService.ts
import { RustBinaryEmbeddingService } from "../../src/services/RustBinaryEmbeddingService";

async function run() {
  const rustService = new RustBinaryEmbeddingService();
  const modelPath = `${__dirname}/../dist/models/modelA/embedding_model.pt`;
  rustService.setModelPath(modelPath);

  await rustService.init();

  const embedding = await rustService.generateEmbedding("Hello world");
  console.log("Embedding length:", embedding.length);
  console.log("First 8 dims:", embedding.slice(0, 8));

  const batch = ["Hello", "Rust", "Kodelens"];
  const batchEmb = await rustService.generateEmbeddings(batch);
  console.log("Batch embeddings:", batchEmb.map(e => e.slice(0, 5)));
}

run().catch(console.error);
