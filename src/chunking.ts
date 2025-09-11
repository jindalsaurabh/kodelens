// src/chunking.ts - probable
import { Tree, SyntaxNode } from "web-tree-sitter";
import { CodeChunk } from "./types";
import { generateHash } from "./utils"; // or your existing hash util

// Define node types we care about
const MEANINGFUL_NODE_TYPES = new Set([
  "class_declaration",
  "method_declaration",
  "interface_declaration",
  "enum_declaration",
  "trigger_declaration",
  "variable_declaration",
  "function_declaration",
  "property_declaration",
]);

export function extractChunks(filePath: string, rootNode: SyntaxNode): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  function traverse(node: SyntaxNode) {
    // Only process meaningful node types
    if (MEANINGFUL_NODE_TYPES.has(node.type)) {
      const text = node.text.trim();
      if (text.length > 0) {
        const startPosition = { row: node.startPosition.row, column: node.startPosition.column };
        const endPosition = { row: node.endPosition.row, column: node.endPosition.column };

        const chunk: CodeChunk = {
          id: generateHash(text),
          name: node.type,
          type: node.type,
          code: text,
          text,
          hash: generateHash(text),
          filePath,
          startLine: startPosition.row,
          endLine: endPosition.row,
          range: {
            start: startPosition,
            end: endPosition,
          } as any,
          startPosition,
          endPosition,
        };

        chunks.push(chunk);
      }
    }

    // Recurse into children
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(rootNode);
  return chunks;
}
