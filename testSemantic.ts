// testSemantic.ts
import { LocalCache } from "./src/database";
import { MockEmbeddingService } from "./src/services/embeddings";
import { SemanticRetrievalService } from "./src/SemanticRetrievalService";
import { CodeChunk } from "./src/types";

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  na = Math.sqrt(na) || 1;
  nb = Math.sqrt(nb) || 1;
  return dot / (na * nb);
}

async function main() {
  console.log("🔹 Starting semantic search test (mock embeddings)...");

  // 1) Init DB/cache
  const cache = new LocalCache(); // defaults to :memory:
  cache.init();
  console.log("✅ LocalCache initialized");

  // 2) Embedding service (mock for offline testing)
  const embedder = new MockEmbeddingService(); // deterministic for repeatable tests
  console.log("✅ MockEmbeddingService initialized (dim=" + embedder.dim() + ")");

  // 3) Semantic retriever (uses embedder + cache)
  const retriever = new SemanticRetrievalService(embedder, cache, 3);
  console.log("✅ SemanticRetrievalService ready");

  // 4) Prepare fully-populated CodeChunk objects (match your types)
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

  console.log(`✅ Prepared ${chunks.length} test code chunks`);

  // 5) Generate embeddings for chunks
  const embeddings = await embedder.generateEmbeddings(chunks.map(c => c.text));
  console.log("✅ Generated embeddings for all chunks (mock)");

  // 6) Insert chunks + embeddings into LocalCache
  const insertedCount = cache.insertChunksWithEmbeddings(chunks, "testFile", "hash123", embeddings);
  console.log(`✅ Inserted ${insertedCount} chunks with embeddings into LocalCache`);

  // 7) Run semantic query via SemanticRetrievalService
  const query = "How do I add two numbers?";
  console.log(`🔹 Running semantic search for query: "${query}"`);

  // Query embedding (for debug)
  const queryEmbedding = await embedder.generateEmbedding(query);
  console.log("Query embedding (first 6 values):", Array.from(queryEmbedding.slice(0, 6)));

  // Debug: compute similarity for all stored embeddings (via cache.getAllEmbeddings)
  const allEmbRows = cache.getAllEmbeddings(); // returns {id, embedding: Float32Array}[]
  const scores = allEmbRows.map(e => {
    const chunk = cache.getChunkById(e.id);
    return {
      id: e.id,
      filePath: chunk?.filePath ?? "(unknown)",
      name: chunk?.name ?? "(unknown)",
      score: cosineSimilarity(queryEmbedding, e.embedding)
    };
  }).sort((a,b) => b.score - a.score);

  console.log("🔍 Cosine similarity (all chunks):");
  scores.forEach(s => {
    console.log(` - [id=${s.id}] ${s.name} (${s.filePath}) -> ${s.score.toFixed(4)}`);
  });

  // 8) Use the service to get top-K results (this will use same embeddings + ranking)
  const results = await retriever.findRelevantChunks(query);
  console.log("🔹 Semantic retrieval service results (top K):");
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.name} (id=${r.id}, file=${r.filePath})`);
    console.log(`   code: ${r.code}`);
  });

  // done
  console.log("✅ Test complete");
}

main().catch(err => {
  console.error("❌ testSemantic failed:", err);
  process.exit(1);
});
