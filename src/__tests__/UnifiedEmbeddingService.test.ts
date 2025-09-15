import { UnifiedEmbeddingService } from "../services/UnifiedEmbeddingService";

describe("UnifiedEmbeddingService", () => {
  let service: UnifiedEmbeddingService;

  beforeEach(() => {
    // Mock provider with generateEmbedding + optional generateEmbeddings
    const mockProvider = {
      dim: () => 4,
      generateEmbedding: jest.fn(async (text: string) => {
        return new Float32Array([1, 2, 3, 4]);
      }),
      generateEmbeddings: jest.fn(async (texts: string[]) => {
        return texts.map(() => new Float32Array([5, 6, 7, 8]));
      }),
    };

    service = new UnifiedEmbeddingService(mockProvider);
  });

  it("should call batch API if available", async () => {
    const texts = ["a", "b", "c"];
    const embeddings = await service.generateEmbeddings(texts);
    expect(embeddings.length).toBe(3);
    expect(embeddings[0]).toEqual(new Float32Array([5, 6, 7, 8]));
    expect((service.provider.generateEmbeddings as jest.Mock).mock.calls.length).toBe(1);
  });

  it("should fallback to single-item embedding if batch API missing", async () => {
    // remove generateEmbeddings
    (service.provider as any).generateEmbeddings = undefined;

    const texts = ["x", "y"];
    const embeddings = await service.generateEmbeddings(texts);

    expect(embeddings.length).toBe(2);
    embeddings.forEach(e => expect(e).toEqual(new Float32Array([1, 2, 3, 4])));
  });

  it("should retry/fallback on individual embedding failures", async () => {
    const faultyProvider = {
      dim: () => 3,
      generateEmbedding: jest.fn(async (text: string) => {
        if (text === "fail") {throw new Error("fail!");}
        return new Float32Array([1, 1, 1]);
      }),
    };

    service = new UnifiedEmbeddingService(faultyProvider as any);

    const texts = ["ok", "fail", "ok2"];
    const embeddings = await service.generateEmbeddings(texts);

    expect(embeddings.length).toBe(3);
    // failed embedding returns zero vector
    expect(embeddings[1]).toEqual(new Float32Array([0, 0, 0]));
  });

  it("dim() should return provider dim", () => {
    expect(service.dim()).toBe(4);
  });
});
