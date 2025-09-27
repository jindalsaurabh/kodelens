// scripts/test-code-embeddings.ts
import { LocalCodeEmbeddingService } from "../src/services/LocalCodeEmbeddingService";

async function testEmbeddings() {
  try {
    const svc = new LocalCodeEmbeddingService();
    await svc.init();

    const texts = [
      "public class MyClass { void doSomething() {} }",
      "trigger AccountTrigger on Account (before insert) {}"
    ];

    const embeddings = await svc.generateEmbeddings(texts);

    console.log("Number of embeddings:", embeddings.length);
    console.log("Dimension of first embedding:", embeddings[0].length);
    console.log("First embedding vector (truncated):", embeddings[0].slice(0, 10));
  } catch (err) {
    console.error("Embedding test failed:", err);
  }
}

testEmbeddings();
