// src/commands/askQuestionCommand.ts
import * as vscode from "vscode";
import * as path from "path";
import { LocalCache } from "../database";
import { findRelevantChunks, hybridSearch, SearchResult as RetrievalResult } from "../retrieval";
import { ResultsProvider } from "../ResultsProvider";
import { HybridEmbeddingService } from "../services/HybridEmbeddingService";
import { SearchResultsPanel } from "../webview/searchResultsPanel";

// Interface for the modern search results
interface SearchResult {
    id: string;
    filePath: string;
    fileName: string;
    type: 'class' | 'method' | 'trigger' | 'property' | 'interface' | 'enum' | 'file';
    name: string;
    snippet: string;
    score: number;
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
}

export function registerAskQuestionCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  cache: LocalCache,
  resultsProvider: ResultsProvider,
  embeddingService: HybridEmbeddingService
) {
  const disposable = vscode.commands.registerCommand("kodelens.askQuestion", async (prefilledQuery?: string) => {
    const userQuestion = await vscode.window.showInputBox({ 
        prompt: "Ask a question about your codebase",
        placeHolder: "e.g., 'payment processing methods' or 'account related triggers'",
        value: prefilledQuery || '' // Pre-fill if provided
    });
    
    if (!userQuestion) { return; }

    // Rest of your existing search code remains the same...
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `🔍 Searching for: "${userQuestion}"`,
            cancellable: false
        }, async (progress) => {
            progress.report({ message: "Finding relevant code..." });
            
            const relevantChunks = await findRelevantChunks(userQuestion, cache, embeddingService);
            
            if (relevantChunks.length > 0) {
                progress.report({ message: "Preparing results..." });
                
                const modernResults: SearchResult[] = relevantChunks.map((result, index) => ({
                    id: `result-${index}-${Date.now()}`,
                    filePath: result.chunk.filePath,
                    fileName: path.basename(result.chunk.filePath),
                    type: mapChunkTypeToResultType(result.chunk.type || 'file'),
                    name: result.chunk.name || 'Unnamed',
                    snippet: truncateSnippet(result.chunk.text),
                    score: result.score,
                    startLine: result.chunk.startLine || 0,
                    endLine: result.chunk.endLine || 0,
                    startColumn: result.chunk.startPosition?.column || 0,
                    endColumn: result.chunk.endPosition?.column || 0
                }));

                SearchResultsPanel.createOrShow(context.extensionUri, modernResults, userQuestion);
                
                const codeChunks = relevantChunks.map(result => result.chunk);
                resultsProvider.setResults(codeChunks);
                
                const topResult = relevantChunks[0];
                vscode.window.showInformationMessage(
                    `🎯 Found ${relevantChunks.length} results • Best match: ${(topResult.score * 100).toFixed(1)}% ${topResult.matchType}`
                );
                
                // Logging code...
            } else {
                vscode.window.showInformationMessage(`No relevant code found for "${userQuestion}"`);
            }
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Search failed: ${msg}`);
    }
  });

  context.subscriptions.push(disposable);
}

/**
 * Map chunk types to result types for the modern panel
 */
function mapChunkTypeToResultType(chunkType: string): SearchResult['type'] {
    const typeMap: { [key: string]: SearchResult['type'] } = {
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
 * Truncate and clean up code snippets for display
 */
function truncateSnippet(text: string | undefined, maxLength: number = 300): string {
    if (!text || text.length <= maxLength) {
        return text || 'No content available';
    }
    
    // Try to truncate at a line break or natural boundary
    const truncated = text.substring(0, maxLength);
    
    // Find the last line break in the truncated text
    const lastLineBreak = truncated.lastIndexOf('\n');
    if (lastLineBreak > maxLength * 0.7) {
        return truncated.substring(0, lastLineBreak).trim() + '\n// ... [truncated]';
    }
    
    return truncated.trim() + '\n// ... [truncated]';
}
