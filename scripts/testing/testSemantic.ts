// scripts/testSemantic.ts
import { LocalCache } from "../src/database";
import { SemanticRetrievalService } from "../src/SemanticRetrievalService";
import { ModelManager } from "../src/ModelManager";
import { CodeChunk } from "../src/types";
import path from "path";



async function main() {
  console.log("🔹 Starting semantic search test...");

  const cache = new LocalCache(":memory:");
  cache.init();
  const basePath = path.resolve(__dirname, "..", "..", ".cache"); 
  const modelManager = new ModelManager(basePath);

  const retrieval = new SemanticRetrievalService(cache, modelManager, "./models/fallback.onnx");
  await retrieval.init();

  // Insert chunks
  const chunks: CodeChunk[] = [
    { id: "1", text: "function add(a, b) { return a + b; }" } as CodeChunk,
    { id: "2", text: "function subtract(a, b) { return a - b; }" } as CodeChunk,
    { id: "3", text: "const greeting = 'Hello world';" } as CodeChunk,
  ];

  await retrieval.insertChunks(chunks, "testFile.ts", "filehash123");

  const query = "How do I add two numbers?";
  const results = await retrieval.search(query, 3);

  console.log("✅ Results:");
  results.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [score=${r.score.toFixed(3)}] ${r.content}`);
  });
}

main().catch(console.error);
