// src/services/HybridEmbeddingService.ts
import { EmbeddingService } from "./embeddings";
import { RustBinaryEmbeddingService } from "./RustBinaryEmbeddingService";
import * as vscode from 'vscode';

export class HybridEmbeddingService implements EmbeddingService {
    private rustService: RustBinaryEmbeddingService;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.rustService = new RustBinaryEmbeddingService(context);
        console.log(`[HybridEmbeddingService] Initialized with extension context`);
    }

    async init(): Promise<void> {
        await this.rustService.init();
        console.log(`[HybridEmbeddingService] Rust backend initialized`);        
    }

    dim(): number {
        return this.rustService.dim();
    }

    async generateEmbedding(text: string): Promise<Float32Array> {
        return this.rustService.generateEmbedding(text);
    }

    async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
        return this.rustService.generateEmbeddings(texts);
    }

    async dispose(): Promise<void> {
        await this.rustService.dispose();
    }
}