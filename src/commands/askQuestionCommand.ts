//src/commands/askQuestionCommand
import * as vscode from "vscode";
import { LocalCache } from "../database";
import { findRelevantChunks, hybridSearch, SearchResult } from "../retrieval";
import { ResultsProvider } from "../ResultsProvider";
import { HybridEmbeddingService } from "../services/HybridEmbeddingService";

export function registerAskQuestionCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  cache: LocalCache,
  resultsProvider: ResultsProvider,
  embeddingService: HybridEmbeddingService
) {
  const disposable = vscode.commands.registerCommand("kodelens.askQuestion", async () => {
    const userQuestion = await vscode.window.showInputBox({ 
        prompt: "Ask a question about your codebase",
        placeHolder: "e.g., 'payment processing methods' or 'account related triggers'"
    });
    
    if (!userQuestion) { return; }

    try {
        outputChannel.appendLine(`🔍 Searching for: "${userQuestion}"`);
        
        // Use the new unified retrieval function
        const relevantChunks = await findRelevantChunks(userQuestion, cache, embeddingService);
        outputChannel.appendLine(`✅ Found ${relevantChunks.length} relevant chunks`);
        
        // Or use hybrid search for better results:
        // const relevantChunks = await hybridSearch(userQuestion, cache, embeddingService);

        if (relevantChunks.length > 0) {
            // Convert to CodeChunk[] for ResultsProvider
            const codeChunks = relevantChunks.map(result => result.chunk);
            resultsProvider.setResults(codeChunks);
            
            // Show detailed summary
            const topResult = relevantChunks[0];
            vscode.window.showInformationMessage(
                `Found ${relevantChunks.length} results • Best match: ${(topResult.score * 100).toFixed(1)}% ${topResult.matchType}`
            );
            
            // Log details to output channel
            outputChannel.appendLine(`Search Results:`);
            relevantChunks.forEach((result, index) => {
                const snippet = result.chunk.text.slice(0, 80).replace(/\n/g, ' ');
                outputChannel.appendLine(
                    `  ${index + 1}. [${(result.score * 100).toFixed(1)}% ${result.matchType}] ${result.chunk.type} → ${snippet}...`
                );
            });
        } else {
            vscode.window.showInformationMessage("No relevant code found for your query.");
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`❌ Search error: ${msg}`);
        vscode.window.showErrorMessage(`Search failed: ${msg}`);
    }
  });

  context.subscriptions.push(disposable);
}