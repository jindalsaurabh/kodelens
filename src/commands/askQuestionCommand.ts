// src/commands/askQuestionCommand.ts
import * as vscode from "vscode";
import { LocalCache } from "../database";
import { findRelevantChunks } from "../retrieval";

export function registerAskQuestionCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
) {
  const command = vscode.commands.registerCommand(
    "kodelens.askQuestion",
    async () => {
      const userQuestion = await vscode.window.showInputBox({
        prompt: "Ask a question about your codebase",
      });
      if (!userQuestion) return;

      const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
      const cache = new LocalCache(dbPath);
      cache.init();

      try {
        const relevantChunks = await findRelevantChunks(userQuestion, cache);
        outputChannel.appendLine(`Found ${relevantChunks.length} relevant chunks`);

        if (relevantChunks.length > 0) {
          vscode.window.showInformationMessage(`Top result: ${relevantChunks[0].text.slice(0, 100)}...`);
        } else {
          vscode.window.showInformationMessage("No relevant code found.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Error: ${msg}`);
        vscode.window.showErrorMessage(`Failed to answer question: ${msg}`);
      } finally {
        cache.close();
      }
    }
  );

  context.subscriptions.push(command);
}
