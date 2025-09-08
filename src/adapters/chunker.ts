// src/adapters/chunker.ts
// Parses tree-sitter AST into structured chunks (classes, methods, properties, triggers, etc.)
//import * as nodeCrypto from "crypto";
//import { createHash } from "crypto"; // Node built-in crypto
import * as crypto from 'crypto';


export type ASTChunk = {
  type: "class" | "method" | "property" | "trigger" | "other";
  name: string;
  start: number;
  end: number;
  code?: string;
  children?: ASTChunk[];
};

/**
 * Recursively traverses a tree-sitter AST node and converts it into ASTChunk objects.
 */
export function extractChunksFromAst(rootNode: any, sourceCode: string): ASTChunk[] {
  const chunks: ASTChunk[] = [];

  function traverse(node: any) {
    if (!node) {return;}

    // Determine the type of the node
    let type: ASTChunk['type'] | null = null;
    if (node.type === "class_declaration") {type = "class";}
    else if (node.type === "method_declaration") {type = "method";}
    else if (node.type === "property_declaration") {type = "property";}
    else if (node.type === "trigger") {type = "trigger";}
    else {type = "other";}

    // Get the name of the node
    const name: string = node.childForFieldName?.("name")?.text ?? "unknown";

    // Add the chunk
    chunks.push({
      type,
      name,
      start: node.startIndex ?? 0,
      end: node.endIndex ?? sourceCode.length,
      code: sourceCode.slice(node.startIndex ?? 0, node.endIndex ?? sourceCode.length),
      children: [],
    });

    // Recurse into children
    if (node.children && node.children.length > 0) {
      node.children.forEach(traverse);
    }
  }

  traverse(rootNode);
  return chunks;
}

// ---------------- Export utility functions ----------------
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/*
export function generateHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
*/
export function generateHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}