import { CodeIndexer } from "../CodeIndexer";
import { CodeChunk } from "../types";
import { ApexAdapter } from "../adapters/ApexAdapter";
import { LocalCacheMock } from "./mocks/LocalCacheMock";
import { generateHash } from "../utils";

describe("CodeIndexer Delta Indexing & Stale Cleanup", () => {
  let db: LocalCacheMock;
  let indexer: CodeIndexer;
  let apexAdapter: ApexAdapter;
  const filePath = "test.cls";

  beforeEach(async () => {
    db = new LocalCacheMock();
    apexAdapter = { parse: jest.fn() } as any;
    indexer = new CodeIndexer("workspaceRoot", {} as any, db as any, apexAdapter);
    (indexer as any).embeddingService = {
      dim: () => 2,
      generateEmbedding: async () => new Float32Array(2).fill(1),
      generateEmbeddings: async (texts: string[]) => texts.map(() => new Float32Array(2).fill(1)),
    };
  });

  it("should insert new chunks only", async () => {
    const chunks: CodeChunk[] = [
      {
        id: "c1",
        filePath,
        code: "class A {}",
        type: "class",
        name: "A",
        text: "class A {}",
        hash: "h1",
        startLine: 1,
        endLine: 1,
        startPosition: { row: 1, column: 0 },
        endPosition: { row: 1, column: 10 },
        range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } },
      },
      {
        id: "c2",
        filePath,
        code: "class B {}",
        type: "class",
        name: "B",
        text: "class B {}",
        hash: "h2",
        startLine: 2,
        endLine: 2,
        startPosition: { row: 2, column: 0 },
        endPosition: { row: 2, column: 10 },
        range: { start: { row: 2, column: 0 }, end: { row: 2, column: 10 } },
      },
    ];

    await indexer.indexChunks(chunks, filePath, generateHash("fileContent"));
    const allChunks: CodeChunk[] = db.getAllChunks();
    expect(allChunks.map(c => c.code)).toEqual(["class A {}", "class B {}"]);
  });

  it("should skip unchanged chunks", async () => {
    const chunk: CodeChunk = {
      id: "c1",
      filePath,
      code: "class A {}",
      type: "class",
      name: "A",
      text: "class A {}",
      hash: "h1",
      startLine: 1,
      endLine: 1,
      startPosition: { row: 1, column: 0 },
      endPosition: { row: 1, column: 10 },
      range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } },
    };

    await indexer.indexChunks([chunk], filePath, generateHash("fileContent"));
    await indexer.indexChunks([chunk], filePath, generateHash("fileContent"));

    const allChunks: CodeChunk[] = db.getAllChunks();
    expect(allChunks.length).toBe(1);
    expect(allChunks[0].code).toBe("class A {}");
  });

  it("should remove stale chunks", async () => {
    const chunk1: CodeChunk = {
      id: "c1",
      filePath,
      code: "class A {}",
      type: "class",
      name: "A",
      text: "class A {}",
      hash: "h1",
      startLine: 1,
      endLine: 1,
      startPosition: { row: 1, column: 0 },
      endPosition: { row: 1, column: 10 },
      range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } },
    };
    const chunk2: CodeChunk = {
      id: "c2",
      filePath,
      code: "class B {}",
      type: "class",
      name: "B",
      text: "class B {}",
      hash: "h2",
      startLine: 2,
      endLine: 2,
      startPosition: { row: 2, column: 0 },
      endPosition: { row: 2, column: 10 },
      range: { start: { row: 2, column: 0 }, end: { row: 2, column: 10 } },
    };

    await indexer.indexChunks([chunk1, chunk2], filePath, generateHash("fileContent"));
    let allChunks: CodeChunk[] = db.getAllChunks();
    expect(allChunks.length).toBe(2);

    // simulate deleting chunk2 from file
    const validHashes = [chunk1.hash!];
    await db.deleteChunksForFile(filePath, validHashes);

    allChunks = db.getAllChunks();
    expect(allChunks.length).toBe(1);
    expect(allChunks[0].hash).toBe(chunk1.hash);
  });
});
