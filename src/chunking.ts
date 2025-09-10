// src/chunking.ts
/**
 * Walks the AST recursively and extracts Apex constructs as "chunks".
 * Each chunk is normalized, hashed, and tagged with location info.
 * Returns CodeChunk[] ready for DB insert/search.
 */

// src/chunking.ts
import { SyntaxNode } from "web-tree-sitter";
import { CodeChunk } from "./types";
import { generateHash } from "./utils";
import * as vscode from "vscode";

/**
 * Extract code "chunks" from an AST node for storage.
 * Ensures all required fields are populated and types are consistent.
 */
/** Example: create hash for a chunk */
export function createChunkId(chunk: CodeChunk): string {
  return chunk.id ?? generateHash(chunk.code);
}

export function extractChunks(filePath: string, rootNode: SyntaxNode): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  function traverse(node: SyntaxNode) {
    // Only consider named nodes that have some content
    if (!node || !node.type || node.text.trim() === "") {return;}

    const startPosition = {
      row: Number(node.startPosition.row ?? 0),
      column: Number(node.startPosition.column ?? 0),
    };
    const endPosition = {
      row: Number(node.endPosition.row ?? 0),
      column: Number(node.endPosition.column ?? 0),
    };

    const chunkText = node.text ?? "";

    rootNode.children.forEach((node: any) => {
    const startLine = Number(node.startPosition.row ?? 0);
    const startColumn = Number(node.startPosition.column ?? 0);
    const endLine = Number(node.endPosition.row ?? 0);
    const endColumn = Number(node.endPosition.column ?? 0);

    /*
    const chunk: CodeChunk = {
      id: generateHash(`${filePath}:${chunkText}:${startPosition.row}:${startPosition.column}`),
      name: node.type ?? "unknown",
      type: node.type ?? "unknown",
      code: chunkText,
      text: chunkText,
      hash: generateHash(chunkText),
      filePath,
      startLine: startPosition.row,
      endLine: endPosition.row,
      range: {
        start: startPosition,
        end: endPosition,
      } as any, // vscode.Range will be built in LocalCache if needed
      startPosition,
      endPosition,
    };
      */

    const chunk: CodeChunk = {
            id: generateHash(node.text),
            name: node.type,
            type: node.type,
            code: node.text,
            text: node.text,
            hash: generateHash(node.text),
            filePath,
            startLine,
            endLine,
            startPosition: { row: startLine, column: startColumn },
            endPosition: { row: endLine, column: endColumn },
            range: new vscode.Range(startLine, startColumn, endLine, endColumn)
        };  
    
    chunks.push(chunk);
  });
    // Recursively traverse child nodes
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) {traverse(child);}
    }
  }

  traverse(rootNode);
  return chunks;
}

