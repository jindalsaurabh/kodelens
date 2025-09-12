export interface EmbeddingService {
    dim(): number;
    generateEmbedding(text: string): Promise<Float32Array>;
    generateEmbeddings(texts: string[]): Promise<Float32Array[]>;
}

export class MockEmbeddingService implements EmbeddingService {
    constructor(dim?: number);
    dim(): number;
    generateEmbedding(text: string): Promise<Float32Array>;
    generateEmbeddings(texts: string[]): Promise<Float32Array[]>;
}
