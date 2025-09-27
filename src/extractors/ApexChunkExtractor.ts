import { ApexAdapter } from "../adapters/ApexAdapter";
import { CodeChunk } from "../types";
import Parser from "web-tree-sitter";

export class ApexChunkExtractor {
  constructor(private apexAdapter: ApexAdapter) {}

  /** 
   * Extract code chunks from a Parser.Tree or SyntaxNode
   * @param filePath relative path of the file
   * @param treeOrNode Parser.Tree or Parser.SyntaxNode (root or subtree)
   */
  public extractChunks(
    filePath: string,
    treeOrNode: Parser.Tree | Parser.SyntaxNode
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const rootNode: Parser.SyntaxNode =
      "rootNode" in treeOrNode ? treeOrNode.rootNode : treeOrNode;

    const visitNode = (node: Parser.SyntaxNode | null) => {
      if (!node) {return;}

      // Collect top-level classes and methods
      if (["class_declaration", "method_declaration", "trigger_declaration"].includes(node.type)) {
        chunks.push({
          id: "",
          hash: "",
          filePath,
          type: node.type,
          name: node.type,
          code: node.text,
          text: node.text,
          startLine: node.startPosition.row,
          endLine: node.endPosition.row,
          startPosition: node.startPosition,
          endPosition: node.endPosition,
          range: { start: node.startPosition, end: node.endPosition },
        });
      }

      // Some files can produce 0 AST nodes matching your extractor rules — we should gracefully 
      // fallback and create at least one chunk representing the file.
      // after you finish the AST traversal and have `chunks` array:
if (chunks.length === 0) {
  // use rootNode.text as a single chunk (whole file)
  const fullText = rootNode?.text ?? "";
  chunks.push({
    id: "", hash: "", filePath,
    type: "file",
    name: filePath,
    code: fullText,
    text: fullText,
    startLine: 0,
    endLine: (fullText.match(/\n/g) || []).length,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: (fullText.match(/\n/g) || []).length, column: 0 },
    range: { start: { row: 0, column: 0 }, end: { row: (fullText.match(/\n/g) || []).length, column: 0 } }
  });
}

      for (let i = 0; i < node.childCount; i++) {
        visitNode(node.child(i));
      }
    };

    visitNode(rootNode);
    console.info(`ApexChunkExtractor: extracted ${chunks.length} chunks from ${filePath}`);
    return chunks;
  }
}
