// src/chunking.ts
/**
 * Walks the AST recursively and extracts Apex constructs as "chunks".
 * Each chunk is normalized, hashed, and tagged with location info.
 * Returns CodeChunk[] ready for DB insert/search.
 */

// src/chunking.ts
import { SyntaxNode } from "web-tree-sitter";
import { CodeChunk } from "./types";
//import { generateHash } from "./chunking";

/**
 * Extract code "chunks" from an AST node for storage.
 * Ensures all required fields are populated and types are consistent.
 */
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

    chunks.push(chunk);

    // Recursively traverse child nodes
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) {traverse(child);}
    }
  }

  traverse(rootNode);
  return chunks;
}

// Named export
export function generateHash(input: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(input).digest("hex");
}

