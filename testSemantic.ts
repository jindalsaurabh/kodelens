// testSemantic.ts
import { LocalCache } from "./src/database";
import { MockEmbeddingService } from "./src/services/embeddings";
import { SemanticRetrievalService } from "./src/SemanticRetrievalService";
import { CodeChunk } from "./src/types";

async function main() {
  const cache = new LocalCache();
  cache.init();
  const embedder = new MockEmbeddingService();
  const retriever = new SemanticRetrievalService(embedder, cache, 3);

  // ✅ Fully populated CodeChunks with startPosition, endPosition, range
  const chunks: CodeChunk[] = [
    {
      id: "1",
      filePath: "FileA.cls",
      text: "function add(x, y) { return x + y; }",
      hash: "hash1",
      type: "function",
      name: "add",
      code: "function add(x, y) { return x + y; }",
      startLine: 1,
      endLine: 1,
      startPosition: { row: 1, column: 0 },
      endPosition: { row: 1, column: 30 },
      range: { start: { row: 1, column: 0 }, end: { row: 1, column: 30 } }
    },
    {
      id: "2",
      filePath: "FileB.cls",
      text: "function subtract(x, y) { return x - y; }",
      hash: "hash2",
      type: "function",
      name: "subtract",
      code: "function subtract(x, y) { return x - y; }",
      startLine: 1,
      endLine: 1,
      startPosition: { row: 1, column: 0 },
      endPosition: { row: 1, column: 35 },
      range: { start: { row: 1, column: 0 }, end: { row: 1, column: 35 } }
    },
    {
      id: "3",
      filePath: "FileC.cls",
      text: "function multiply(x, y) { return x * y; }",
      hash: "hash3",
      type: "function",
      name: "multiply",
      code: "function multiply(x, y) { return x * y; }",
      startLine: 1,
      endLine: 1,
      startPosition: { row: 1, column: 0 },
      endPosition: { row: 1, column: 35 },
      range: { start: { row: 1, column: 0 }, end: { row: 1, column: 35 } }
    }
  ];

  // Generate embeddings
  const embeddings = await embedder.generateEmbeddings(chunks.map(c => c.text));

  // Insert into local cache
  cache.insertChunksWithEmbeddings(chunks, "testFile", "hash123", embeddings);

  // Run semantic query
  const results = await retriever.findRelevantChunks("How do I add two numbers?");
  console.log("Semantic search results:", results);
}

main();
