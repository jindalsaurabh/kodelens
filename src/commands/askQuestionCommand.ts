import * as vscode from "vscode";
import { LocalCache } from "../database";
import { findRelevantChunks } from "../retrieval";
import { ResultsProvider } from "../ResultsProvider";

export function registerAskQuestionCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  cache: LocalCache,
  resultsProvider: ResultsProvider
) {
  const disposable = vscode.commands.registerCommand("kodelens.askQuestion", async () => {
    const userQuestion = await vscode.window.showInputBox({ prompt: "Ask a question about your codebase" });
    if (!userQuestion) {return;}

    try {
      const relevantChunks = await findRelevantChunks(userQuestion, cache);
      outputChannel.appendLine(`Found ${relevantChunks.length} relevant chunks`);

      if (relevantChunks.length > 0) {
        resultsProvider.setResults(relevantChunks);
        vscode.window.showInformationMessage(`Found ${relevantChunks.length} references`);
        vscode.window.showInformationMessage(`Top result: ${relevantChunks[0].text.slice(0, 100)}...`);
      } else {
        vscode.window.showInformationMessage("No relevant code found.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`Error: ${msg}`);
      vscode.window.showErrorMessage(`Failed to answer question: ${msg}`);
    }
  });

  context.subscriptions.push(disposable);
}
