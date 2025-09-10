// src/chunking.ts
import * as vscode from "vscode";
import Parser from "web-tree-sitter";
import { createHash, randomUUID } from "crypto";
import { CodeChunk } from "./types";

/**
 * Hash helper - deterministic sha256 hex
 */
function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Node types to extract as chunks (based on your grammar inspection)
 */
const INTERESTING_NODE_TYPES = new Set([
  "class_declaration",
  "constructor_declaration",
  "method_declaration",
  "field_declaration",
  "trigger_declaration",
  // add more if your grammar contains other meaningful nodes
]);

/**
 * Extracts a reasonable "name" for a node (identifier child or fallback to node type)
 */
function extractName(node: Parser.SyntaxNode): string {
  // some grammars use 'identifier' or 'name' field — try both
  const idNode = node.childForFieldName?.("identifier") ?? node.childForFieldName?.("name");
  if (idNode && idNode.text) {return idNode.text;}
  // fallback: sometimes a direct child named 'name' exists
  const child = node.namedChildren.find((c) => c.type === "identifier" || c.type === "name");
  return child?.text ?? node.type;
}

/**
 * Extract chunks from a parse tree root node.
 * createRange controls whether we attach a vscode.Range (use false in tests).
 */
export function extractChunks(
  filePath: string,
  rootNode: Parser.SyntaxNode,
  createRange = true
): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  function traverse(node: Parser.SyntaxNode) {
    if (!node || !node.type) {return;}

    // Skip empty text nodes
    const nodeText = String(node.text ?? "").trim();
    if (!nodeText) {
      // still recurse into children since deeper nodes might contain content
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child) {traverse(child);}
      }
      return;
    }

    // Only record interesting constructs
    if (INTERESTING_NODE_TYPES.has(node.type)) {
      const startRow = Number(node.startPosition?.row ?? 0);
      const startCol = Number(node.startPosition?.column ?? 0);
      const endRow = Number(node.endPosition?.row ?? 0);
      const endCol = Number(node.endPosition?.column ?? 0);

      const code = String(node.text ?? "");
      const name = extractName(node);

      const chunk: CodeChunk = {
        id: randomUUID ? randomUUID() : sha256Hex(`${filePath}:${node.type}:${startRow}:${startCol}:${code}`),
        hash: sha256Hex(code),
        filePath,
        type: node.type,
        name,
        code,
        text: code,
        startLine: startRow,
        endLine: endRow,
        startPosition: { row: startRow, column: startCol },
        endPosition: { row: endRow, column: endCol },
        range: createRange
          ? new vscode.Range(new vscode.Position(startRow, startCol), new vscode.Position(endRow, endCol))
          : undefined,
      };

      chunks.push(chunk);
    }

    // Recurse into named children (correct traversal)
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) {traverse(child);}
    }
  }

  traverse(rootNode);
  return chunks;
}
