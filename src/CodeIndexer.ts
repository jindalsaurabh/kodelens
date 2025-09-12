import * as vscode from "vscode";
import * as path from "path";
import { safeParse } from "./services/parserService";
import { normalizeChunk } from "./services/normalize";
import { sha256Hex } from "./services/crypto";
import { CodeChunk } from "./types";
import { LocalCache } from "./database";
import { extractChunks } from "./chunking"; // assuming you have this

export class CodeIndexer {
  private workspaceRoot: string;
  private context: vscode.ExtensionContext;
  private db: LocalCache;

  constructor(workspaceRoot: string, context: vscode.ExtensionContext, dbPath?: string) {
    this.workspaceRoot = workspaceRoot;
    this.context = context;
    this.db = new LocalCache(dbPath || ":memory:");
    this.db.init();
  }

  /** Index a single file: parse, chunk, normalize, insert */
  async indexFile(filePath: string, content: string): Promise<number> {
    try {
      // Step 1: normalize and hash
      const fileHash = sha256Hex(content);

      // Step 2: parse
      const tree = await safeParse(this.workspaceRoot, this.context, content);
      if (!tree) {return 0;}

      // Step 3: extract raw chunks
      const rawChunks = extractChunks(filePath, tree.rootNode);

      // Step 4: normalize all chunks
      const normalizedChunks: CodeChunk[] = rawChunks.map(normalizeChunk);

      // Step 5: bulk insert into DB
      const insertedCount = this.db.insertChunks(normalizedChunks, filePath, fileHash);

      console.log(`Indexed ${filePath}: found ${rawChunks.length}, inserted ${insertedCount}`);
      return insertedCount;
    } catch (err) {
      console.error(`Indexing failed for ${filePath}`, err);
      return 0;
    }
  }

  /** Optionally, close DB */
  close(): void {
    this.db.close();
  }
}
