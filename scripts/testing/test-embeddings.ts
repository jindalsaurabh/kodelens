#!/usr/bin/env ts-node

import { LocalMiniLMEmbeddingService } from "../src/services/LocalMiniLMEmbeddingService";

async function testEmbeddings() {
  try {
    const svc = new LocalMiniLMEmbeddingService();
    const texts = ["Hello world", "This is a test of embeddings"];
    const embeddings = await svc.generateEmbeddings(texts);

    console.log("Number of embeddings:", embeddings.length);
    console.log("Dimension of first embedding:", embeddings[0].length);
    console.log("First embedding vector (truncated):", embeddings[0].slice(0, 10));
  } catch (err) {
    console.error("Embedding test failed:", err);
  }
}

testEmbeddings();
