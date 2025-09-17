//scripts/test-semantic-search.ts
import 'module-alias/register';
import { LocalCacheMock } from '../src/__mocks__/LocalCacheMock';
import { SemanticCodeIndexer } from '../src/SemanticCodeIndexer';
import { CodeChunk } from '../src/types';
//import { BgeMicroEmbeddingService } from '../src/services/BgeMicroEmbeddingService';
import { LocalBgeEmbeddingService } from '../src/services/LocalBgeEmbeddingService';
import * as vscode from 'vscode';

// Cosine similarity helper
function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
  const cache = new LocalCacheMock();
  const fakeApexAdapter = { parse: async () => ({ ast: {} }) };

  const indexer = new SemanticCodeIndexer(
    'workspaceRoot',
    {} as vscode.ExtensionContext,
    cache,
    fakeApexAdapter
  );

  const embeddingService = new LocalBgeEmbeddingService();

  // Mini corpus
  const chunks: CodeChunk[] = [
    { id: 'c1', filePath: 'test.cls', code: 'public class TestClass {}', text: 'public class TestClass {}' },
    { id: 'c2', filePath: 'test.cls', code: 'public class AnotherClass {}', text: 'public class AnotherClass {}' },
  ];

  // Compute embeddings
  const texts = chunks.map(c => c.code!).filter((t): t is string => !!t);
  const embeddings = await embeddingService.generateEmbeddings(texts);

  // Index chunks with embeddings
  await indexer.indexChunks(chunks, 'test.cls', 'dummyHash', embeddings);

  // Query
  const query = 'How do I add two numbers?';
  //const queryVec = (await embeddingService.generateEmbedding(query)) as Float32Array;
  const queryVec = (await embeddingService.generateEmbedding(query));

  // Find best match
  let best: { chunk: CodeChunk; score: number } | null = null;
  for (const chunk of chunks) {
    if (!chunk.embedding) {continue;}
    const sim = cosineSim(queryVec, chunk.embedding);
    if (!best || sim > best.score) {best = { chunk, score: sim };}
  }

  console.log('Best match:', best?.chunk.text, 'Score:', best?.score);
}

main().catch(console.error);
