// src/__tests__/SemanticCodeIndexer.test.ts
import * as vscode from "vscode";
import { SemanticCodeIndexer } from "../SemanticCodeIndexer";
import { LocalCacheMock } from "../__mocks__/LocalCacheMock";
import { CodeChunk } from "../types";

describe("SemanticCodeIndexer (unit)", () => {
  let cache: LocalCacheMock;
  let indexer: SemanticCodeIndexer;

  beforeEach(async () => {
    cache = new LocalCacheMock();

    // Fake ApexAdapter that bypasses real parsing
    const fakeApexAdapter = {
      parse: jest.fn().mockReturnValue({ ast: {} }),
    };

    // Initialize SemanticCodeIndexer with mock cache and fake ApexAdapter
    indexer = new SemanticCodeIndexer( "workspaceRoot", {} as vscode.ExtensionContext, cache as any, fakeApexAdapter as any);

    // Initialize embeddingService with "mock" embeddings
    await indexer.init("mock");

    // Monkey-patch extractor to avoid real AST parsing
    (indexer as any).extractor.extractChunks = jest
      .fn()
      .mockImplementation((filePath: string, content: string): CodeChunk[] => [
        {
          id: "c1",
          name: "TestClass",
          filePath,
          code: content,
          text: content,
          hash: "hash1",
          type: "class",
          startLine: 1,
          endLine: 1,
          startPosition: { row: 1, column: 0 },
          endPosition: { row: 1, column: 10 },
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } },
        },
      ]);
  });

  it("should index a file with embeddings and write to cache", async () => {
    const filePath = "test.cls";
    const content = "public class TestClass {}";

    // Index the file with embeddings
    await indexer.indexFileWithEmbeddings(filePath, content);

    // Check chunks inserted into cache
    const allChunks: CodeChunk[] = cache.getAllChunks();
    expect(allChunks.length).toBeGreaterThan(0);

    allChunks.forEach((c) => {
      expect(c.hash).toBeDefined();
      expect(c.text).toBe(content);
    });

    // Check embeddings
    const allEmbeddings = cache.getAllEmbeddings();
    expect(allEmbeddings.length).toBe(allChunks.length);
    allEmbeddings.forEach((e) => {
      expect(e.embedding.length).toBeGreaterThan(0);
    });
  });

  it("should find chunks by keywords", () => {
    const filePath = "test.cls";
    const content = "public class TestClass {}";

    cache.insertChunksWithEmbeddings(
      [
        {
          id: "c1",
          name: "TestClass",
          filePath,
          code: content,
          text: content,
          hash: "hash1",
          type: "class",
          startLine: 1,
          endLine: 1,
          startPosition: { row: 1, column: 0 },
          endPosition: { row: 1, column: 10 },
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } },
        },
      ],
      filePath,
      "fileHash1",
      [new Float32Array([0.1, 0.2])]
    );

    const found = cache.findChunksByKeywords(["TestClass"]);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].text).toContain("TestClass");
  });
});
