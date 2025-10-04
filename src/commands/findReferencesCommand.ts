// src/commands/findReferencesCommand.ts
import * as vscode from "vscode";
import * as path from "path";
import { LocalCache } from "../database";
import { findRelevantChunks } from "../retrieval";
import { CodeIndexer } from "../CodeIndexer";
import { ResultsProvider } from "../ResultsProvider";
import { HybridEmbeddingService } from "../services/HybridEmbeddingService";
import { ReferencesPanel, ReferenceResult } from "../webview/referencesPanel";

// Store extension context globally
let extensionContext: vscode.ExtensionContext;

export function registerFindReferencesCommand(
  context: vscode.ExtensionContext, // Keep this parameter
  outputChannel: vscode.OutputChannel,
  cache: LocalCache,
  codeIndexer: CodeIndexer | undefined,
  resultsProvider: ResultsProvider,
  embeddingService: HybridEmbeddingService
) {
  // Store the context globally so we can access it later
  extensionContext = context;

  const disposable = vscode.commands.registerCommand("kodelens.findReferences", async () => {
    if (!codeIndexer) {
      return vscode.window.showErrorMessage("Indexer not ready");
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return vscode.window.showErrorMessage("No active editor");
    }

    const wordRange = editor.document.getWordRangeAtPosition(editor.selection.start);
    if (!wordRange) {
      return vscode.window.showErrorMessage("Place cursor on a word");
    }

    const symbolName = editor.document.getText(wordRange);
    
    outputChannel.appendLine(`🔍 Finding semantic references for: "${symbolName}"`);

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `🔍 Finding references for "${symbolName}"`,
        cancellable: false
      }, async (progress) => {
        progress.report({ message: "Searching codebase semantically..." });
        
        // Use semantic search to find references
        const relevantChunks = await findRelevantChunks(symbolName, cache, embeddingService);
        
        if (relevantChunks.length > 0) {
          progress.report({ message: "Preparing reference results..." });
          
          // Convert to modern ReferenceResult format
          const referenceResults: ReferenceResult[] = relevantChunks.map((result, index) => ({
            id: `ref-${index}-${Date.now()}`,
            filePath: result.chunk.filePath,
            fileName: path.basename(result.chunk.filePath),
            type: mapChunkTypeToResultType(result.chunk.type || 'file'),
            name: result.chunk.name || 'Unnamed',
            snippet: truncateSnippet(result.chunk.text),
            score: result.score,
            startLine: result.chunk.startLine || 0,
            endLine: result.chunk.endLine || 0,
            startColumn: result.chunk.startPosition?.column || 0,
            endColumn: result.chunk.endPosition?.column || 0,
            referenceType: determineReferenceType(result.chunk.text, symbolName)
          }));

          // Show in specialized references panel - FIXED: Use the stored context
          ReferencesPanel.createOrShow(
            extensionContext.extensionUri, // ✅ Use the stored context
            referenceResults, 
            symbolName
          );
          
          // Also update legacy results provider for backward compatibility
          const codeChunks = relevantChunks.map(result => result.chunk);
          resultsProvider.setResults(codeChunks);
          
          // Show summary
          const topResult = relevantChunks[0];
          vscode.window.showInformationMessage(
            `🎯 Found ${relevantChunks.length} semantic references for "${symbolName}" • Best match: ${(topResult.score * 100).toFixed(1)}%`
          );
        } else {
          vscode.window.showInformationMessage(
            `No semantic references found for "${symbolName}"`
          );
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to find references: ${msg}`);
    }
  });

  context.subscriptions.push(disposable);
}

// ... keep the helper functions (mapChunkTypeToResultType, determineReferenceType, truncateSnippet) the same ...

/**
 * Map chunk types to result types
 */
function mapChunkTypeToResultType(chunkType: string): ReferenceResult['type'] {
    const typeMap: { [key: string]: ReferenceResult['type'] } = {
        'class_declaration': 'class',
        'method_declaration': 'method',
        'trigger_declaration': 'trigger',
        'property_declaration': 'property',
        'interface_declaration': 'interface',
        'enum_declaration': 'enum',
        'constructor_declaration': 'method',
        'class_signature': 'class',
        'file': 'file',
        'file_segment': 'file'
    };
    
    return typeMap[chunkType] || 'file';
}

/**
 * Determine reference type based on content analysis
 */
function determineReferenceType(chunkText: string, symbolName: string): ReferenceResult['referenceType'] {
    const text = chunkText.toLowerCase();
    const symbol = symbolName.toLowerCase();
    
    // Check for declarations (class, method definitions)
    if (text.includes(`class ${symbol}`) || 
        text.includes(` ${symbol}(`) || 
        text.includes(` ${symbol} {`)) {
        return 'declaration';
    }
    
    // Check for implementations (method bodies, logic)
    if (text.includes(` ${symbol}.`) || 
        text.includes(` ${symbol}(`) ||
        text.includes(`= ${symbol}`)) {
        return 'usage';
    }
    
    // Default to usage
    return 'usage';
}

/**
 * Truncate and clean up code snippets for display
 */
function truncateSnippet(text: string | undefined, maxLength: number = 300): string {
    if (!text || text.length <= maxLength) {
        return text || 'No content available';
    }
    
    const truncated = text.substring(0, maxLength);
    const lastLineBreak = truncated.lastIndexOf('\n');
    
    if (lastLineBreak > maxLength * 0.7) {
        return truncated.substring(0, lastLineBreak).trim() + '\n// ... [truncated]';
    }
    
    return truncated.trim() + '\n// ... [truncated]';
}