// src/commands/findReferencesCommand.ts
import * as vscode from "vscode";
import { LocalCache } from "../database";
import { findRelevantChunks } from "../retrieval";

export function registerFindReferencesCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
) {
  const command = vscode.commands.registerCommand(
    "kodelens.findReferences",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {return vscode.window.showErrorMessage("No active editor");}

      const wordRange = editor.document.getWordRangeAtPosition(editor.selection.start);
      if (!wordRange) {return vscode.window.showErrorMessage("Place cursor on a word");}

      const symbolName = editor.document.getText(wordRange);
      outputChannel.appendLine(`Finding references for: ${symbolName}`);

      const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
      const cache = new LocalCache(dbPath);
      cache.init();

      try {
        const relevantChunks = await findRelevantChunks(symbolName, cache);
        if (relevantChunks.length) {
          vscode.window.showInformationMessage(`Found ${relevantChunks.length} references`);
        } else {
          vscode.window.showInformationMessage("No references found");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Error: ${msg}`);
        vscode.window.showErrorMessage(`Failed to find references: ${msg}`);
      } finally {
        cache.close();
      }
    }
  );

  context.subscriptions.push(command);
}
