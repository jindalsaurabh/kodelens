// src/services/ServiceContainer.ts
import { HybridEmbeddingService } from "./HybridEmbeddingService";
import { ResultsProvider } from "../ResultsProvider";
import { LocalCache } from "../database";
import { CodeIndexer } from "../CodeIndexer";

export class ServiceContainer {
  constructor(
    public readonly cache: LocalCache,
    public readonly embeddingService: HybridEmbeddingService,
    public readonly resultsProvider: ResultsProvider,
    public readonly codeIndexer?: CodeIndexer
  ) {}
  
  // Helper method to ensure services are ready
  async ensureReady(): Promise<boolean> {
    if (this.embeddingService.init) {
      await this.embeddingService.init();
    }
    return true;
  }
}