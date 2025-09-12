// src/CodeIndexer.ts
import * as vscode from "vscode";
import * as path from "path";
import { safeParse } from "./services/parserService";
import { normalizeCode } from "./services/normalize";
import { sha256Hex } from "./services/crypto";
import { CodeChunk } from "./types";

/**
 * CodeIndexer indexes files in a workspace:
 *  - normalizes code
 *  - computes hashes
 *  - parses code into AST
 *  - prepares metadata for chunking
 */
export class CodeIndexer {
  private workspaceRoot: string;
  private context: vscode.ExtensionContext;

  constructor(workspaceRoot: string, context: vscode.ExtensionContext) {
    this.workspaceRoot = workspaceRoot;
    this.context = context;
  }

  /**
   * Index a single file.
   * Returns normalized code hash and AST root node.
   */
  async indexFile(
    filePath: string,
    content: string
  ): Promise<{ filePath: string; hash: string; ast: any } | null> {
    try {
      const normalized = normalizeCode(content);
      const hash = sha256Hex(normalized);

      const tree = await safeParse(this.workspaceRoot, this.context, normalized);

      if (!tree) {
        console.warn(`Skipping ${filePath}, parse failed`);
        return null;
      }

      return {
        filePath,
        hash,
        ast: tree.rootNode,
      };
    } catch (err) {
      console.error(`Indexing failed for ${filePath}`, err);
      vscode.window.showErrorMessage(
        `KodeLens: Indexing failed for ${path.basename(filePath)}`
      );
      return null;
    }
  }
}