// testSemantic.ts
import * as vscode from "vscode"; // Needed for SemanticCodeIndexer ctor
import { LocalCache } from "./src/database";
import { SemanticRetrievalService } from "./src/SemanticRetrievalService";
import { SemanticCodeIndexer } from "./src/SemanticCodeIndexer";
import { MockEmbeddingService } from "./src/services/embeddings";

async function main() {
  const cache = new LocalCache();
  cache.init();

  // Use mock embedding service for testing
  const embedder = new MockEmbeddingService();
  const retriever = new SemanticRetrievalService(embedder, cache, 3);

  // Create a fake VSCode extension context (minimal stub)
  const fakeContext = {} as vscode.ExtensionContext;

  // Instantiate SemanticCodeIndexer
  const indexer = new SemanticCodeIndexer(
    process.cwd(), // workspace root
    fakeContext,
    cache,
    "mock" // embeddingChoice
  );

  // Simulate indexing a couple of files
  await indexer.indexFileWithEmbeddings(
    "FileA.cls",
    "function add(x, y) { return x + y; }"
  );

  await indexer.indexFileWithEmbeddings(
    "FileB.cls",
    "function subtract(x, y) { return x - y; }"
  );

  await indexer.indexFileWithEmbeddings(
    "FileC.cls",
    "function multiply(x, y) { return x * y; }"
  );

  // Run a semantic query
  const results = await retriever.findRelevantChunks("How do I add two numbers?");
  console.log("Semantic search results:", results);
}

main();
