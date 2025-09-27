//src/ModelManager.ts
import * as fs from "fs";
import * as path from "path";

export interface ModelInfo {
  id: string;
  dimension: number;
  path: string;   // required
}

export class ModelManager {
  private storagePath: string;

  // Define our own models
  private preferredModels: Omit<ModelInfo, "path">[] = [
    { id: "model-b", dimension: 384 }, // better model, downloaded on first run
    { id: "model-a", dimension: 384 }, // fallback, bundled
  ];

  constructor(basePath: string) {
    this.storagePath = path.join(basePath, "models");
    console.log("ModelManager storage path:", this.storagePath);

    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  private getMarkerFile(modelId: string): string {
    return path.join(this.storagePath, `${modelId}.ok`);
  }

  async getOrDownloadModel(): Promise<ModelInfo | null> {
    for (const model of this.preferredModels) {
      const marker = this.getMarkerFile(model.id);
      const modelDir = path.join(this.storagePath, model.id);

      if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
      }

      if (fs.existsSync(marker)) {
        return { ...model, path: modelDir };
      }

      try {
        // TODO: real download (for now just marker)
        fs.writeFileSync(marker, "ok");
        return { ...model, path: modelDir };
      } catch (err) {
        console.warn(`Failed to prepare model ${model.id}`, err);
      }
    }
    return null;
  }
}
