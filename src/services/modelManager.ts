import * as fs from 'fs';
import * as path from 'path';

export interface ModelDescriptor {
  id: string;
  name: string;
  diskSizeBytes?: number;
  dims: number;
  recommendedFor: 'default' | 'code' | 'gpu';
  manifestUrl?: string; // optional remote manifest
}

export class ModelManager {
  private installPath: string;
  private models: ModelDescriptor[] = [
    { id: 'mock-mini', name: 'Mock Mini (for dev)', dims: 384, recommendedFor: 'default', diskSizeBytes: 80 * 1024 * 1024 },
    { id: 'mock-code', name: 'Mock Code (for dev)', dims: 768, recommendedFor: 'code', diskSizeBytes: 300 * 1024 * 1024 },
  ];

  constructor(installPath?: string) {
    this.installPath = installPath || path.join(process.env.HOME || process.cwd(), '.kodelens', 'models');
    if (!fs.existsSync(this.installPath)) {
      try { fs.mkdirSync(this.installPath, { recursive: true }); } catch (e) { /* noop */ }
    }
  }

  availableModels(): Promise<ModelDescriptor[]> {
    return Promise.resolve(this.models.slice());
  }

  isInstalled(modelId: string): boolean {
    const p = path.join(this.installPath, modelId);
    return fs.existsSync(p);
  }

  async installModel(modelId: string, onProgress?: (p: number) => void): Promise<void> {
    // Mock install: create a folder and a small marker file. In real impl -> download + verify
    const dest = path.join(this.installPath, modelId);
    if (!fs.existsSync(dest)) {fs.mkdirSync(dest, { recursive: true });}
    const marker = path.join(dest, 'installed.txt');
    fs.writeFileSync(marker, `installed:${new Date().toISOString()}`);
    if (onProgress) {onProgress(100);}
  }

  async uninstallModel(modelId: string): Promise<void> {
    const dest = path.join(this.installPath, modelId);
    if (fs.existsSync(dest)) {
      try { fs.rmSync(dest, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    }
  }

  getModelPath(modelId: string): string | null {
    const dest = path.join(this.installPath, modelId);
    return fs.existsSync(dest) ? dest : null;
  }

  async verifyModel(modelId: string): Promise<boolean> {
    // Mock verification
    return this.isInstalled(modelId);
  }
}