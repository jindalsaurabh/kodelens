// src/services/HybridEmbeddingService.ts
// src/services/HybridEmbeddingService.ts
import { EmbeddingService } from "./embeddings";
import { RustBinaryEmbeddingService } from "./RustBinaryEmbeddingService";
import { ModelManager } from "../ModelManager";
import * as path from "path";
import * as fs from "fs";

export class HybridEmbeddingService implements EmbeddingService {
  private rustService: RustBinaryEmbeddingService;
  private activeModelPath: string;
  private modelManager: ModelManager;

  /**
   * @param extensionBasePath - root folder of the extension/project
   *   - downloaded models will go into extensionBasePath/.cache/models
   *   - bundled model will be read from dist/models/modelA
   */
  constructor(extensionBasePath: string) {
    const resolvedBase = path.resolve(extensionBasePath);

    // Directory for downloaded models (Model B)
    const cacheModelsPath = path.join(resolvedBase, ".cache", "models");
    if (!fs.existsSync(cacheModelsPath)) {
      fs.mkdirSync(cacheModelsPath, { recursive: true });
      console.log(`[HybridEmbeddingService] Created cache models folder: ${cacheModelsPath}`);
    }

    // Directory for bundled Model A
    const bundledModelsPath = path.join(resolvedBase, "dist", "models", "modelA", "embedding_model.pt");
    if (!fs.existsSync(bundledModelsPath)) {
      console.warn(`[HybridEmbeddingService] Bundled model not found at: ${bundledModelsPath}`);
    }

    this.modelManager = new ModelManager(cacheModelsPath);
    this.activeModelPath = bundledModelsPath; // default to Model A

    // Initialize Rust service
    this.rustService = new RustBinaryEmbeddingService();
    console.log(`[HybridEmbeddingService] Ready with default model: ${this.activeModelPath}`);
  }

  async init(): Promise<void> {
    // Initialize Rust binary
    try {
      await this.rustService.init();
    } catch (err: any) {
      throw new Error(`[HybridEmbeddingService] Rust binary failed to initialize: ${err?.message ?? err}`);
    }

    // Check for downloaded Model B
    try {
      const downloaded = await this.modelManager.getOrDownloadModel();
      if (downloaded) {
        console.log(`[HybridEmbeddingService] Using downloaded model: ${downloaded.id} (dim=${downloaded.dimension})`);
        this.activeModelPath = downloaded.path;
      } else {
        console.log(`[HybridEmbeddingService] No downloaded model found, sticking with bundled model`);
      }
    } catch (err: any) {
      console.error(`[HybridEmbeddingService] Error while checking downloaded model: ${err?.message ?? err}`);
      console.log(`[HybridEmbeddingService] Falling back to bundled model`);
      this.activeModelPath = path.join(process.cwd(), "dist", "models", "modelA", "embedding_model.pt");
    }

    // Inform Rust service about model path
    console.log(`[HybridEmbeddingService] Active model path set: ${this.activeModelPath}`);
    this.rustService.setModelPath(this.activeModelPath);
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
