import * as vscode from "vscode";
import { LocalCache } from "../database";
import { findRelevantChunks } from "../retrieval";
import { CodeIndexer } from "../CodeIndexer";
import { ResultsProvider } from "../ResultsProvider";

export function registerFindReferencesCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  cache: LocalCache,
  codeIndexer: CodeIndexer | undefined,
  resultsProvider: ResultsProvider
) {
  const disposable = vscode.commands.registerCommand("kodelens.findReferences", async () => {
    if (!codeIndexer) {return vscode.window.showErrorMessage("Indexer not ready");}

    const editor = vscode.window.activeTextEditor;
    if (!editor) {return vscode.window.showErrorMessage("No active editor");}

    const wordRange = editor.document.getWordRangeAtPosition(editor.selection.start);
    if (!wordRange) {return vscode.window.showErrorMessage("Place cursor on a word");}

    const symbolName = editor.document.getText(wordRange);
    outputChannel.appendLine(`Finding references for: ${symbolName}`);

    try {
      const relevantChunks = await findRelevantChunks(symbolName, cache);
      if (relevantChunks.length) {
        resultsProvider.setResults(relevantChunks);
        vscode.window.showInformationMessage(`Found ${relevantChunks.length} references`);
      } else {
        vscode.window.showInformationMessage("No references found");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`Error finding references: ${msg}`);
      vscode.window.showErrorMessage(`Failed to find references: ${msg}`);
    }
  });

  context.subscriptions.push(disposable);
}
