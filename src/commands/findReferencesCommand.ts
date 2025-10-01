//src/commands/findReferencesCommands
// src/commands/findReferencesCommand.ts
import * as vscode from "vscode";
import { LocalCache } from "../database";
import { findRelevantChunks } from "../retrieval";
import { CodeIndexer } from "../CodeIndexer";
import { ResultsProvider } from "../ResultsProvider";
import { HybridEmbeddingService } from "../services/HybridEmbeddingService";

export function registerFindReferencesCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  cache: LocalCache,
  codeIndexer: CodeIndexer | undefined,
  resultsProvider: ResultsProvider,
  embeddingService: HybridEmbeddingService // ✅ Add this parameter
) {
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
    outputChannel.appendLine(`Finding references for: ${symbolName}`);

    try {
      // ✅ Now passing all required parameters
      const relevantChunks = await findRelevantChunks(symbolName, cache, embeddingService);
      
      if (relevantChunks.length > 0) {
        // Convert SearchResult[] to CodeChunk[] for ResultsProvider
        const codeChunks = relevantChunks.map(result => result.chunk);
        resultsProvider.setResults(codeChunks);
        
        const topChunk = relevantChunks[0];
        vscode.window.showInformationMessage(
          `Found ${relevantChunks.length} references • Best match: ${(topChunk.score * 100).toFixed(1)}% ${topChunk.matchType}`
        );
        
        // Enhanced logging
        outputChannel.appendLine(`Reference Search Results:`);
        relevantChunks.forEach((result, index) => {
          const snippet = result.chunk.text.slice(0, 80).replace(/\n/g, ' ');
          outputChannel.appendLine(
            `  ${index + 1}. [${(result.score * 100).toFixed(1)}% ${result.matchType}] ${result.chunk.type} → ${snippet}...`
          );
        });
      } else {
        vscode.window.showInformationMessage("No relevant references found");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`Error finding references: ${msg}`);
      vscode.window.showErrorMessage(`Failed to find references: ${msg}`);
    }
  });

  context.subscriptions.push(disposable);
}