// src/extractors/ApexChunkExtractor.ts
import { ApexAdapter } from "../adapters/ApexAdapter";
import { CodeChunk } from "../types";
import Parser from "web-tree-sitter";
import crypto from "crypto";

export class ApexChunkExtractor {
  constructor(private apexAdapter: ApexAdapter) {}

  public extractChunks(
    filePath: string,
    treeOrNode: Parser.Tree | Parser.SyntaxNode,
    fileContent?: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const rootNode: Parser.SyntaxNode =
      "rootNode" in treeOrNode ? treeOrNode.rootNode : treeOrNode;

    if (!rootNode) {
      console.warn(`[ApexChunkExtractor] No root node found for ${filePath}`);
    } else {
      console.log(
        `[ApexChunkExtractor] rootNode type=${rootNode.type}, childCount=${rootNode.childCount}, text length=${rootNode.text?.length}`
      );
    }

    const visitNode = (node: Parser.SyntaxNode | null) => {
      if (!node) {return;}

      if (
        ["class_declaration", "method_declaration", "trigger_declaration"].includes(
          node.type
        )
      ) {
        const chunkText = node.text || "";
        const chunkHash = crypto.createHash("sha256").update(chunkText).digest("hex");
        const chunkId = crypto
          .createHash("sha256")
          .update(`${filePath}:${chunkHash}`)
          .digest("hex");

        chunks.push({
          id: chunkId,
          hash: chunkHash,
          filePath,
          type: node.type,
          name: node.type,
          code: chunkText,
          text: chunkText,
          startLine: node.startPosition.row,
          endLine: node.endPosition.row,
          startPosition: node.startPosition,
          endPosition: node.endPosition,
          range: { start: node.startPosition, end: node.endPosition },
        });
      }

      for (let i = 0; i < node.childCount; i++) {
        visitNode(node.child(i));
      }
    };

    visitNode(rootNode);

    // fallback chunk
    if (chunks.length === 0) {
      const fallbackText = rootNode?.text || fileContent || "";
      const chunkHash = crypto.createHash("sha256").update(fallbackText).digest("hex");
      const chunkId = crypto
        .createHash("sha256")
        .update(`${filePath}:${chunkHash}`)
        .digest("hex");

      const lineCount = (fallbackText.match(/\n/g) || []).length;

      chunks.push({
        id: chunkId,
        hash: chunkHash,
        filePath,
        type: "file",
        name: filePath,
        code: fallbackText,
        text: fallbackText,
        startLine: 0,
        endLine: lineCount,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: lineCount, column: 0 },
        range: { start: { row: 0, column: 0 }, end: { row: lineCount, column: 0 } },
      });

      console.info(
        `[ApexChunkExtractor] No AST matches, using fallback chunk for ${filePath}, length=${fallbackText.length}`
      );
    }

    console.info(`[ApexChunkExtractor] Extracted ${chunks.length} chunk(s) from ${filePath}`);
    chunks.forEach((c, i) =>
      console.info(
        `  [chunk ${i}] type=${c.type}, lines=${c.startLine}-${c.endLine}, preview="${c.code?.slice(
          0,
          50
        )}..."`
      )
    );

    return chunks;
  }
}
