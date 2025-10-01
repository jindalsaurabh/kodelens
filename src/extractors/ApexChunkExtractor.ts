// src/extractors/ApexChunkExtractor.ts
// src/extractors/ApexChunkExtractor.ts
import { ApexAdapter } from "../adapters/ApexAdapter";
import { CodeChunk } from "../types";
import Parser from "web-tree-sitter";
import { generateChunkId, generateHash } from "../utils";

export class ApexChunkExtractor {
  constructor(private apexAdapter: ApexAdapter) {}

  // Enhanced node types for better semantic search
  private readonly EXTRACTABLE_NODE_TYPES = [
    "class_declaration",
    "method_declaration", 
    "trigger_declaration",
    "property_declaration",
    "constructor_declaration",
    "interface_declaration",
    "enum_declaration"
  ] as const;

  // Safety limit for large files
  private readonly MAX_FILE_SIZE = 100000; // 100KB

  public extractChunks(
    filePath: string,
    treeOrNode: Parser.Tree | Parser.SyntaxNode,
    fileContent?: string
  ): CodeChunk[] {
    // Performance & safety check for large files
    if (fileContent && fileContent.length > this.MAX_FILE_SIZE) {
      console.warn(`[ApexChunkExtractor] Large file detected: ${filePath} (${fileContent.length} bytes). Processing may be slow.`);
    }

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
      if (!node) { return; }

      // Check if this is an extractable node type
      if (this.EXTRACTABLE_NODE_TYPES.includes(node.type as any)) {
        const chunkText = node.text || "";
        const chunk = this.createCodeChunk(filePath, node, node.type, chunkText);
        chunks.push(chunk);
      }

      // Continue traversing the AST
      for (let i = 0; i < node.childCount; i++) {
        visitNode(node.child(i));
      }
    };

    visitNode(rootNode);

    // Enhanced fallback strategy
    if (chunks.length === 0) {
      const fallbackChunks = this.createFallbackChunks(filePath, rootNode, fileContent);
      chunks.push(...fallbackChunks);
    }

    console.info(`[ApexChunkExtractor] Extracted ${chunks.length} chunk(s) from ${filePath}`);
    
    // Debug logging for first few chunks
    chunks.slice(0, 3).forEach((c, i) =>
      console.info(
        `  [chunk ${i}] type=${c.type}, name=${c.name}, lines=${c.startLine}-${c.endLine}, preview="${c.code?.slice(0, 50)}..."`
      )
    );
    if (chunks.length > 3) {
      console.info(`  ... and ${chunks.length - 3} more chunks`);
    }

    return chunks;
  }

  /**
   * Create a standardized code chunk with proper naming and IDs
   */
  private createCodeChunk(
    filePath: string,
    node: Parser.SyntaxNode,
    type: string,
    chunkText: string
  ): CodeChunk {
    const chunkHash = generateHash(chunkText);
    const chunkId = generateChunkId(filePath, chunkText);
    const chunkName = this.extractChunkName(node, type);

    return {
      id: chunkId,
      hash: chunkHash,
      filePath,
      type,
      name: chunkName,
      code: chunkText,
      text: chunkText,
      startLine: node.startPosition.row,
      endLine: node.endPosition.row,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
      range: { start: node.startPosition, end: node.endPosition },
    };
  }

  /**
   * Extract meaningful names for different node types
   */
  private extractChunkName(node: Parser.SyntaxNode, type: string): string {
    switch (type) {
      case "class_declaration":
        const classNameNode = node.childForFieldName("name");
        return classNameNode?.text || "UnknownClass";
      
      case "method_declaration":
        const methodNameNode = node.childForFieldName("name");
        return methodNameNode?.text || "UnknownMethod";
      
      case "trigger_declaration":
        const triggerNameNode = node.childForFieldName("name");
        return triggerNameNode?.text || "UnknownTrigger";
      
      case "property_declaration":
        const propertyNameNode = node.childForFieldName("name");
        return propertyNameNode?.text || "UnknownProperty";
      
      case "constructor_declaration":
        const constructorNameNode = node.childForFieldName("name");
        return constructorNameNode?.text || "Constructor";
      
      case "interface_declaration":
        const interfaceNameNode = node.childForFieldName("name");
        return interfaceNameNode?.text || "UnknownInterface";
      
      case "enum_declaration":
        const enumNameNode = node.childForFieldName("name");
        return enumNameNode?.text || "UnknownEnum";
      
      default:
        return type;
    }
  }

  /**
   * Create fallback chunks when AST parsing fails or returns no results
   */
  private createFallbackChunks(
    filePath: string,
    rootNode: Parser.SyntaxNode,
    fileContent?: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const fallbackText = rootNode?.text || fileContent || "";
    
    if (!fallbackText) {
      console.warn(`[ApexChunkExtractor] No content available for fallback chunks in ${filePath}`);
      return chunks;
    }

    // Strategy 1: Use the entire file as one chunk (original behavior)
    if (fallbackText.length < 5000) { // Only for reasonably sized files
      const lineCount = (fallbackText.match(/\n/g) || []).length;
      const chunkHash = generateHash(fallbackText);
      const chunkId = generateChunkId(filePath, fallbackText);

      chunks.push({
        id: chunkId,
        hash: chunkHash,
        filePath,
        type: "file",
        name: this.getFileName(filePath),
        code: fallbackText,
        text: fallbackText,
        startLine: 0,
        endLine: lineCount,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: lineCount, column: 0 },
        range: { start: { row: 0, column: 0 }, end: { row: lineCount, column: 0 } },
      });

      console.info(
        `[ApexChunkExtractor] Using single fallback chunk for ${filePath}, length=${fallbackText.length}`
      );
    } else {
      // Strategy 2: Line-based chunks for large files
      chunks.push(...this.createLineBasedChunks(filePath, fallbackText));
    }

    return chunks;
  }

  /**
   * Create line-based chunks for large files when AST parsing fails
   */
  private createLineBasedChunks(filePath: string, content: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    const LINES_PER_CHUNK = 10; // Adjust based on your needs

    for (let i = 0; i < lines.length; i += LINES_PER_CHUNK) {
      const chunkLines = lines.slice(i, i + LINES_PER_CHUNK);
      const chunkText = chunkLines.join('\n');
      const chunkHash = generateHash(chunkText);
      const chunkId = generateChunkId(filePath, chunkText);

      chunks.push({
        id: chunkId,
        hash: chunkHash,
        filePath,
        type: "file_segment",
        name: `${this.getFileName(filePath)}_lines_${i + 1}-${i + chunkLines.length}`,
        code: chunkText,
        text: chunkText,
        startLine: i,
        endLine: i + chunkLines.length - 1,
        startPosition: { row: i, column: 0 },
        endPosition: { row: i + chunkLines.length - 1, column: 0 },
        range: { 
          start: { row: i, column: 0 }, 
          end: { row: i + chunkLines.length - 1, column: 0 } 
        },
      });
    }

    console.info(
      `[ApexChunkExtractor] Created ${chunks.length} line-based chunks for large file ${filePath}`
    );

    return chunks;
  }

  /**
   * Extract filename from full path for better chunk naming
   */
  private getFileName(filePath: string): string {
    return filePath.split(/[/\\]/).pop() || filePath;
  }
}