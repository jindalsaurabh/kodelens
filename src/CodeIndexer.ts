// src/CodeIndexer.ts
import * as vscode from "vscode";
import * as crypto from "crypto";
import { LocalCache } from "./database";
import { CodeChunk } from "./types";
import { extractChunks } from "./chunking";
import { safeParse } from "./services/parserService";

export class CodeIndexer {
    private cache: LocalCache | null = null;

    constructor(private workspaceRoot: string, private context: vscode.ExtensionContext) {
        const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
        this.cache = new LocalCache(dbPath);
        this.cache.init().catch(err => console.error("DB init failed:", err));
    }

    /** Generate SHA-256 hash for a string */
    private generateHash(data: string): string {
        return crypto.createHash("sha256").update(data).digest("hex");
    }

    /** Index a single Apex file and return number of chunks inserted */
    async indexFile(fileUri: vscode.Uri): Promise<number> {
        if (!this.cache) {return 0;}

        const doc = await vscode.workspace.openTextDocument(fileUri);
        const source = doc.getText();
        const fileHash = this.generateHash(source);

        const tree = await safeParse(this.workspaceRoot, this.context, source);
        if (!tree) {return 0;}

        const chunks: CodeChunk[] = extractChunks(fileUri.fsPath, tree.rootNode);

        const inserted = await this.cache.insertChunks(chunks, fileUri.fsPath, fileHash);

        console.log(`File: ${fileUri.fsPath} - Chunks found: ${chunks.length}, inserted: ${inserted}`);
        return inserted;
    }

    /** Index all Apex files in the workspace */
    async indexWorkspace(progress?: vscode.Progress<{ message?: string; increment?: number }>, token?: vscode.CancellationToken): Promise<number> {
        if (!vscode.workspace.workspaceFolders || !this.cache) {return 0;}

        const apexFiles = await vscode.workspace.findFiles("**/*.{cls,trigger}", "**/node_modules/**");
        let totalInserted = 0;

        for (let i = 0; i < apexFiles.length; i++) {
            if (token?.isCancellationRequested) {break;}

            progress?.report({
                message: `Processing ${i + 1}/${apexFiles.length}: ${apexFiles[i].fsPath}`,
                increment: (1 / apexFiles.length) * 100,
            });

            try {
                const inserted = await this.indexFile(apexFiles[i]);
                totalInserted += inserted;
            } catch (err) {
                console.error(`Error indexing file ${apexFiles[i].fsPath}:`, err);
            }
        }

        console.log(`Workspace indexing complete. Total chunks inserted: ${totalInserted}`);
        return totalInserted;
    }

    /** Search indexed chunks by keywords */
    async searchByKeywords(keywords: string[]): Promise<CodeChunk[]> {
        if (!this.cache) {return [];}
        return this.cache.findChunksByKeywords(keywords);
    }

    /** Dispose DB connection */
    dispose() {
        this.cache?.close();
        this.cache = null;
    }
}
