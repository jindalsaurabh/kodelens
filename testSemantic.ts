// testSemantic.ts
import "dotenv/config"; // load .env
import { LocalCache } from "./src/database";
import { GoogleGeminiEmbeddingService } from "./src/services/GoogleGeminiEmbeddingService";
import { OpenAIEmbeddingService } from "./src/services/OpenAIEmbeddingService";
import { SemanticRetrievalService } from "./src/SemanticRetrievalService";
import { CodeChunk } from "./src/types";

/**
 * Simple cosine similarity helper
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
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

/**
 * Create the embedding service based on ENV or config
 * - DEV: use Gemini
 * - PROD: use OpenAI
 */
function createEmbeddingService(): any {
  const provider = process.env.EMBEDDING_PROVIDER || "gemini"; // "gemini" or "openai"

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {throw new Error("OPENAI_API_KEY is required for OpenAI embeddings");}
    return new OpenAIEmbeddingService(apiKey, "text-embedding-3-small");
  } else {
    // Default: Gemini
    return new GoogleGeminiEmbeddingService("gemini-embedding-001", 3072);
  }
}

async function main() {
  console.log("🔹 Starting semantic search test...");

  // 1) Init cache
  const cache = new LocalCache();
  cache.init();
  console.log("✅ LocalCache initialized");

  // 2) Embedding service
  const embedder = createEmbeddingService();
  console.log(`✅ ${embedder.constructor.name} initialized (dim=${embedder.dim()})`);

  // 3) Semantic retriever
  const retriever = new SemanticRetrievalService(embedder, cache, 3);
  console.log("✅ SemanticRetrievalService ready");

  // 4) Sample code chunks
  const chunks: CodeChunk[] = [
    { id: "1", filePath: "FileA.cls", text: "function add(x, y) { return x + y; }", hash: "hash1", type: "function", name: "add", code: "function add(x, y) { return x + y; }", startLine: 1, endLine: 1, startPosition: { row: 1, column: 0 }, endPosition: { row: 1, column: 30 }, range: { start: { row: 1, column: 0 }, end: { row: 1, column: 30 } } },
    { id: "2", filePath: "FileB.cls", text: "function subtract(x, y) { return x - y; }", hash: "hash2", type: "function", name: "subtract", code: "function subtract(x, y) { return x - y; }", startLine: 1, endLine: 1, startPosition: { row: 1, column: 0 }, endPosition: { row: 1, column: 35 }, range: { start: { row: 1, column: 0 }, end: { row: 1, column: 35 } } },
    { id: "3", filePath: "FileC.cls", text: "function multiply(x, y) { return x * y; }", hash: "hash3", type: "function", name: "multiply", code: "function multiply(x, y) { return x * y; }", startLine: 1, endLine: 1, startPosition: { row: 1, column: 0 }, endPosition: { row: 1, column: 35 }, range: { start: { row: 1, column: 0 }, end: { row: 1, column: 35 } } },
  ];
  console.log(`✅ Prepared ${chunks.length} test code chunks`);

  // 5) Generate embeddings
  const embeddings = await embedder.generateEmbeddings(chunks.map(c => c.text));
  console.log(`✅ Generated embeddings for all chunks`);

  // 6) Insert into cache
  cache.insertChunksWithEmbeddings(chunks, "testFile", "hash123", embeddings);
  console.log(`✅ Inserted ${chunks.length} chunks with embeddings into LocalCache`);

  // 7) Query example
  const query = "How do I add two numbers?";
  console.log(`🔹 Running semantic search for query: "${query}"`);

  const queryEmbedding = await embedder.generateEmbedding(query);
  console.log("Query embedding (first 6 values):", Array.from(queryEmbedding.slice(0, 6)));

  // Compute similarity
  const allEmbRows = cache.getAllEmbeddings();
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
  scores.forEach(s => console.log(` - [id=${s.id}] ${s.name} (${s.filePath}) -> ${s.score.toFixed(4)}`));

  // 8) Top-K retrieval
  const results = await retriever.findRelevantChunks(query);
  console.log("🔹 Semantic retrieval service results (top K):");
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.name} (id=${r.id}, file=${r.filePath})`);
    console.log(`   code: ${r.code}`);
  });

  console.log("✅ Test complete");
}

async function compareProviders(query: string, chunks: CodeChunk[]) {
  console.log("🔹 Comparing Gemini vs OpenAI embeddings...");

  // 1) Gemini embeddings
  const gemini = new GoogleGeminiEmbeddingService("gemini-embedding-001", 3072);
  const geminiEmb = await gemini.generateEmbedding(query);

  // 2) OpenAI embeddings
  const openaiApiKey = process.env.OPENAI_API_KEY!;
  const openai = new OpenAIEmbeddingService(openaiApiKey, "text-embedding-3-small");
  const openaiEmb = await openai.generateEmbedding(query);

  // Compare cosine similarity with first chunk
  const chunkEmb = await gemini.generateEmbedding(chunks[0].text); // using Gemini for reference
  console.log("Chunk:", chunks[0].text);

  console.log("Cosine similarity (Gemini -> chunk1):", cosineSimilarity(geminiEmb, chunkEmb).toFixed(4));
  console.log("Cosine similarity (OpenAI -> chunk1):", cosineSimilarity(openaiEmb, chunkEmb).toFixed(4));

  console.log("✅ Comparison done");
}

// Call in main() after preparing chunks
// await compareProviders(query, chunks);


main().catch(err => {
  console.error("❌ testSemantic failed:", err);
  process.exit(1);
});
