// src/__tests__/BgeMicroEmbeddingService.test.ts
import { BgeMicroEmbeddingService } from "../services/BgeMicroEmbeddingService";

describe("BgeMicroEmbeddingService (integration)", () => {
  let service: BgeMicroEmbeddingService;

  beforeAll(() => {
    if (!process.env.HF_API_KEY) {
      throw new Error("HF_API_KEY missing in env");
    }
    service = new BgeMicroEmbeddingService(process.env.HF_API_KEY);
  });

  it("should return a 384-dim vector for a single input", async () => {
    const vec = await service.generateEmbedding("hello world");
    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec.length).toBe(384);
  });

  it("should return multiple embeddings for batch input", async () => {
    const inputs = ["hello", "world"];
    const vecs = await service.generateEmbeddings(inputs);
    expect(vecs.length).toBe(2);
    vecs.forEach((v) => {
      expect(v).toBeInstanceOf(Float32Array);
      expect(v.length).toBe(384);
    });
  });
});
