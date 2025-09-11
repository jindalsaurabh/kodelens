//src/CodeIndexer.ts - probable
import * as vscode from "vscode";
import * as path from "path";
import { safeParse } from "./services/parserService";
import { normalizeCode } from "./services/normalize";
import { sha256Hex } from "./services/crypto";
import { CodeChunk } from "./types";

/**
 * CodeIndexer is responsible for indexing files in a workspace.
 * It normalizes code, hashes content, parses the AST, and prepares metadata for chunking and caching.
 */
export class CodeIndexer {
  private workspaceRoot: string;
  private context: vscode.ExtensionContext;

  constructor(workspaceRoot: string, context: vscode.ExtensionContext) {
    this.workspaceRoot = workspaceRoot;
    this.context = context;
  }

  /**
   * Index a single file: normalize, hash, parse.
   * @param filePath Absolute path of the file.
   * @param content File content as string.
   * @returns Object containing filePath, hash, and AST rootNode, or null on failure.
   */
  async indexFile(filePath: string, content: string): Promise<{ filePath: string; hash: string; ast: any } | null> {
    try {
      const normalized = normalizeCode(content);
      const hash = sha256Hex(normalized);

      // Parse code using workspace-aware singleton parser
      const tree = await safeParse(this.workspaceRoot, this.context, normalized);

      if (!tree) {
        console.warn(`Skipping ${filePath}, parse failed`);
        return null;
      }

      return {
        filePath,
        hash,
        ast: tree.rootNode, // downstream chunking will use this
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

