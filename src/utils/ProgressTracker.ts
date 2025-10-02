// src/utils/ProgressTracker.ts
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface ProgressState {
    totalFiles: number;
    processedFiles: string[];
    failedFiles: Array<{ path: string; error: string; timestamp: number }>;
    startTime: number;
    currentBatch: number;
    totalChunks: number;
    status: 'running' | 'paused' | 'completed' | 'failed';
}

export class ProgressTracker {
    private progressFile: string;

    constructor(private context: vscode.ExtensionContext) {
        const storagePath = this.context.globalStorageUri.fsPath;
        this.progressFile = path.join(storagePath, 'parsing_progress.json');
        this.ensureStoragePath();
    }

    private ensureStoragePath(): void {
        const dir = path.dirname(this.progressFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    async saveProgress(state: ProgressState): Promise<void> {
        try {
            const data = JSON.stringify(state, null, 2);
            await fs.promises.writeFile(this.progressFile, data, 'utf8');
        } catch (error) {
            console.error('[ProgressTracker] Failed to save progress:', error);
        }
    }

    async loadProgress(): Promise<ProgressState | null> {
        try {
            if (!fs.existsSync(this.progressFile)) {return null;}
            const data = await fs.promises.readFile(this.progressFile, 'utf8');
            return JSON.parse(data) as ProgressState;
        } catch (error) {
            console.error('[ProgressTracker] Failed to load progress:', error);
            return null;
        }
    }

    async clearProgress(): Promise<void> {
        try {
            if (fs.existsSync(this.progressFile)) {
                await fs.promises.unlink(this.progressFile);
            }
        } catch (error) {
            console.error('[ProgressTracker] Failed to clear progress:', error);
        }
    }

    async getProgressPercentage(): Promise<number> {
        const state = await this.loadProgress();
        if (!state || state.totalFiles === 0) {return 0;}
        return Math.round((state.processedFiles.length / state.totalFiles) * 100);
    }
}