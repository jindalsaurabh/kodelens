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

  // Safety limits
  private readonly MAX_FILE_SIZE = 100000; // 100KB
  private readonly MAX_CHUNK_SIZE = 5000;  // 5KB per chunk
  private readonly MAX_CLASS_SIZE_FOR_SPLITTING = 10000; // 10KB

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
        
        // Handle large classes by splitting them
        if (node.type === 'class_declaration' && this.shouldSplitLargeClass(node, chunkText)) {
          const splitChunks = this.splitLargeClass(filePath, node);
          chunks.push(...splitChunks);
        } else {
          const chunk = this.createCodeChunk(filePath, node, node.type, chunkText);
          chunks.push(chunk);
        }
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
        `  [chunk ${i}] type=${c.type}, name=${c.name}, lines=${c.startLine}-${c.endLine}, size=${c.text?.length} chars`
      )
    );
    if (chunks.length > 3) {
      console.info(`  ... and ${chunks.length - 3} more chunks`);
    }

    return chunks;
  }

  /**
   * Check if a class should be split into smaller chunks
   */
  private shouldSplitLargeClass(node: Parser.SyntaxNode, chunkText: string): boolean {
    return chunkText.length > this.MAX_CLASS_SIZE_FOR_SPLITTING;
  }

  /**
   * Split large classes into method-level chunks for better performance
   */
  private splitLargeClass(filePath: string, classNode: Parser.SyntaxNode): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const className = this.findParentClassName(classNode);
    
    console.log(`[ApexChunkExtractor] Splitting large class: ${className} (${classNode.text?.length} chars)`);

    // Extract class signature separately (without method bodies)
    const classSignature = this.extractClassSignature(classNode);
    if (classSignature) {
      const signatureChunk = this.createCodeChunk(filePath, classNode, 'class_signature', classSignature);
      chunks.push(signatureChunk);
    }

    // Extract methods as individual chunks
    this.extractMethodsFromClass(filePath, classNode, className, chunks);
    
    // Extract properties separately
    this.extractPropertiesFromClass(filePath, classNode, className, chunks);

    console.log(`[ApexChunkExtractor] Split ${className} into ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * Extract just the class signature (without method bodies)
   */
  private extractClassSignature(classNode: Parser.SyntaxNode): string {
    let signature = classNode.text || "";
    
    // Simple truncation for now - in future, parse and reconstruct signature properly
    if (signature.length > 1000) {
      signature = signature.substring(0, 1000) + "\n// ... [class signature truncated]";
    }
    
    return signature;
  }

  /**
   * Extract all methods from a class as individual chunks
   */
  private extractMethodsFromClass(
    filePath: string, 
    classNode: Parser.SyntaxNode, 
    className: string, 
    chunks: CodeChunk[]
  ): void {
    const methodNodes = this.findChildNodes(classNode, ['method_declaration', 'constructor_declaration']);
    
    for (const methodNode of methodNodes) {
      const methodText = methodNode.text || "";
      const chunk = this.createCodeChunk(filePath, methodNode, methodNode.type, methodText);
      chunks.push(chunk);
    }
  }

  /**
   * Extract properties from a class
   */
  private extractPropertiesFromClass(
    filePath: string,
    classNode: Parser.SyntaxNode,
    className: string,
    chunks: CodeChunk[]
  ): void {
    const propertyNodes = this.findChildNodes(classNode, ['property_declaration']);
    
    for (const propertyNode of propertyNodes) {
      const propertyText = propertyNode.text || "";
      const chunk = this.createCodeChunk(filePath, propertyNode, 'property_declaration', propertyText);
      chunks.push(chunk);
    }
  }

  /**
   * Find child nodes of specific types
   */
  private findChildNodes(node: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];
    
    const visit = (currentNode: Parser.SyntaxNode) => {
        if (types.includes(currentNode.type)) {
            nodes.push(currentNode);
        }
        
        for (let i = 0; i < currentNode.childCount; i++) {
            const child = currentNode.child(i);
            if (child) {  // ✅ Add null check
                visit(child);
            }
        }
    };
    
    visit(node);
    return nodes;
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
    // Apply size limits to chunk text
    //let processedText = chunkText;
    let processedText = this.smartTruncate(chunkText, this.MAX_CHUNK_SIZE);
    /*
    if (processedText.length > this.MAX_CHUNK_SIZE) {
      console.warn(`[ApexChunkExtractor] Truncating large ${type} chunk from ${processedText.length} to ${this.MAX_CHUNK_SIZE} chars`);
      processedText = processedText.substring(0, this.MAX_CHUNK_SIZE) + "\n// ... [truncated]";
    }
*/
    if (processedText.length < chunkText.length) {
    console.log(`[ApexChunkExtractor] Smart truncated ${type} from ${chunkText.length} to ${processedText.length} chars`);
  }

    const chunkHash = generateHash(processedText);
    const chunkId = generateChunkId(filePath, processedText);
    const chunkName = this.extractChunkName(node, type);
    
    // Add context for methods and properties
    let contextualText = processedText;
    if (type === 'method_declaration' || type === 'property_declaration' || type === 'constructor_declaration') {
      const className = this.findParentClassName(node);
      contextualText = `// ${className}.${chunkName}\n${processedText}`;
    }

    return {
      id: chunkId,
      hash: chunkHash,
      filePath,
      type,
      name: chunkName,
      code: processedText,
      text: contextualText,
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
   * Find parent class name for context
   */
  private findParentClassName(node: Parser.SyntaxNode): string {
    let currentNode = node.parent;
    
    while (currentNode) {
      if (currentNode.type === 'class_declaration') {
        const classNameNode = currentNode.childForFieldName('name');
        return classNameNode?.text || 'UnknownClass';
      }
      currentNode = currentNode.parent;
    }
    
    return 'UnknownClass';
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

    // For large files, use line-based chunks
    if (fallbackText.length > 5000) {
      chunks.push(...this.createLineBasedChunks(filePath, fallbackText));
    } else {
      // For reasonably sized files, use single chunk
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
    }

    return chunks;
  }

  /**
   * Create line-based chunks for large files when AST parsing fails
   */
  private createLineBasedChunks(filePath: string, content: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    const LINES_PER_CHUNK = 10;

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

  // In ApexChunkExtractor.ts - merge small related methods
private shouldMergeWithPrevious(chunk: CodeChunk, previousChunk: CodeChunk): boolean {
    return chunk.type === previousChunk.type && 
           chunk.filePath === previousChunk.filePath &&
           (chunk.endLine ?? 0) - (chunk.startLine ?? 0) < 10; // Merge short methods
}

/**
 * Smart truncation that preserves important code structure
 */
private smartTruncate(chunkText: string, maxLength: number = 5000): string {
  // If already under limit, return as-is
  if (chunkText.length <= maxLength) {
    return chunkText;
  }

  const lines = chunkText.split('\n');
  const importantLines: string[] = [];
  let currentLength = 0;
  let implementationLinesCount = 0;

  // Priority 1: Always keep method/class signatures and key annotations
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Always keep these important lines
    const isImportant = 
      trimmedLine.startsWith('//') || // Comments
      trimmedLine.includes('@') || // Annotations like @AuraEnabled, @isTest
      trimmedLine.startsWith('public') || 
      trimmedLine.startsWith('private') ||
      trimmedLine.startsWith('protected') ||
      trimmedLine.startsWith('global') ||
      trimmedLine.startsWith('static') ||
      trimmedLine.startsWith('override') ||
      trimmedLine.startsWith('virtual') ||
      trimmedLine.startsWith('abstract') ||
      trimmedLine.includes(' class ') || // Class declarations
      trimmedLine.includes(' interface ') || // Interface declarations
      trimmedLine.includes(' enum ') || // Enum declarations
      trimmedLine.startsWith('{') || // Opening braces
      trimmedLine.startsWith('}') || // Closing braces
      trimmedLine.length < 100; // Short lines (likely signatures)

    if (isImportant) {
      if (currentLength + line.length + 1 <= maxLength - 200) { // Leave room for truncation notice
        importantLines.push(line);
        currentLength += line.length + 1; // +1 for newline
      }
    } else {
      implementationLinesCount++;
    }
  }

  // If we have room, add some implementation context
  if (currentLength < maxLength - 300 && implementationLinesCount > 0) {
    const remainingSpace = maxLength - currentLength - 100; // Leave space for truncation notice
    const implementationContext = `\n// ... [${implementationLinesCount} implementation lines truncated] ...\n`;
    
    if (currentLength + implementationContext.length <= maxLength) {
      importantLines.push(implementationContext);
    }
  }

  const result = importantLines.join('\n');
  
  // Final safety check - ensure we don't exceed maxLength
  if (result.length > maxLength) {
    return result.substring(0, maxLength - 50) + '\n// ... [truncated]';
  }
  
  return result;
}

  /**
   * Extract filename from full path for better chunk naming
   */
  private getFileName(filePath: string): string {
    return filePath.split(/[/\\]/).pop() || filePath;
  }
}