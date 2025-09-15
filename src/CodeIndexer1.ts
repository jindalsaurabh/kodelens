//src/CodeIndexer.ts
import * as vscode from "vscode";
import * as path from "path";
import { safeParse } from "./services/parserService";
import { normalizeCode } from "./services/normalize";
import { sha256Hex } from "./services/crypto";
import { CodeChunk } from "./types";
import { computeChunkHash } from "./utils";
//import * as database from "./database";
import { LocalCache } from "./database";

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
/*
  constructor(workspaceRoot: string, context: vscode.ExtensionContext, private db: Database) {
    this.workspaceRoot = workspaceRoot;
    this.context = context;
  }
*/
  constructor(
  workspaceRoot: string,
  context: vscode.ExtensionContext,
  private db: LocalCache,
  private embeddingService: { generateEmbedding: (code: string) => Promise<Float32Array> }
) {
  this.workspaceRoot = workspaceRoot;
  this.context = context;
}

async indexChunks(chunks: CodeChunk[], filePath: string, fileHash: string): Promise<void> {
  for (const chunk of chunks) {
    const chunkHash = computeChunkHash(chunk.filePath, chunk.code, chunk.type);
    const existing = this.db.getChunkByHash(chunkHash);

    if (existing) {
      // ✅ Skip unchanged chunks
      continue;
    }

    // ❌ New or modified chunk → generate embedding + insert
    const embedding = await this.embeddingService.generateEmbedding(chunk.code);
    this.db.insertOrUpdateChunk(chunk, filePath, fileHash, embedding);
  }
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
      const fileHash = sha256Hex(normalized);

      const tree = await safeParse(this.workspaceRoot, this.context, normalized);

      if (!tree) {
        console.warn(`Skipping ${filePath}, parse failed`);
        return null;
      }
    
      // ✅ Extract semantic chunks
    const chunks = this.extractChunks(filePath, tree.rootNode, content);

    // ✅ Index chunks (store only new/changed ones)
    await this.indexChunks(chunks, filePath, fileHash);

      return {
        filePath,
        hash: fileHash,
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

  /**
   * Extract semantic chunks from an AST.
   * Default implementation: single chunk (whole file).
   * Subclasses can override for finer-grained chunking.
   */
  /*
  protected extractChunks(
    filePath: string,
    ast: any,
    content: string
  ): CodeChunk[] {
    const lines = content.split("\n");
    const startRow = 0;
    const endRow = lines.length - 1;
    return [
      {
        id: sha256Hex(filePath + content),
        filePath,
        text: content,
        code: content,
        name: "root",
        type: "file",
        hash: sha256Hex(content),
        startLine: startRow,
        endLine: endRow,
        startPosition: { row: startRow, column: 0 },
        endPosition: { row: endRow, column: lines[endRow]?.length ?? 0 },
        range: {
        start: { row: startRow, column: 0 },
        end: { row: endRow, column: lines[endRow]?.length ?? 0 },
      },
      },
    ];
  }
    */

  protected extractChunks(filePath: string, ast: any, content: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const sourceLines = content.split("\n");

  const visitNode = (node: any) => {
    let chunkType: string | null = null;

    switch (node.type) {
      case "function_declaration":
      case "method_definition":
        chunkType = "function";
        break;
      case "class_declaration":
        chunkType = "class";
        break;
      case "arrow_function":
        chunkType = "arrow_function";
        break;
    }

    if (chunkType) {
      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;
      const chunkText = sourceLines.slice(startLine - 1, endLine).join("\n");

      chunks.push({
        id: sha256Hex(`${filePath}:${startLine}:${endLine}:${chunkType}`),
        filePath,
        text: chunkText,
        code: chunkText,
        name: chunkType,
        type: chunkType,
        hash: sha256Hex(chunkText),
        startLine,
        endLine,
        startPosition: node.startPosition,
        endPosition: node.endPosition,
        range: { start: node.startPosition, end: node.endPosition },
      });
    }

    // Recurse into children
    if (node.children) {
      for (const child of node.children) {
        visitNode(child);
      }
    }
  };

  visitNode(ast);

  // Fallback if nothing extracted → whole file
  if (chunks.length === 0) {
    return [
      {
        id: sha256Hex(filePath + content),
        filePath,
        text: content,
        code: content,
        name: "root",
        type: "file",
        hash: sha256Hex(content),
        startLine: 1,
        endLine: sourceLines.length,
        startPosition: { row: 1, column: 0 },
        endPosition: { row: sourceLines.length, column: 0 },
        range: {
          start: { row: 1, column: 0 },
          end: { row: sourceLines.length, column: 0 },
        },
      },
    ];
  }

  return chunks;
}

}
