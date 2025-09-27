async function main() {
  const { pipeline } = await import("@xenova/transformers");

  console.log("🔹 Initializing MiniLM embedding pipeline...");
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
    { revision: "main" }
  );

  const text = "Hello world, embeddings test!";
  const output = await extractor(text, { pooling: "mean", normalize: true });

  const embedding = Array.from(output.data);

  console.log("✅ Embedding dim:", embedding.length);
  console.log("✅ Embedding (first 5):", embedding.slice(0, 5));
}

main().catch(console.error);
