// src/commands/parseWorkspaceCommand.ts
import * as vscode from "vscode";
import { SemanticCodeIndexer } from "../SemanticCodeIndexer";
import { LocalCache } from "../database";

export function registerParseWorkspaceCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  cache: LocalCache,
  workspaceRoot: string
) {
  const disposable = vscode.commands.registerCommand("kodelens.parseWorkspace", async () => {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showWarningMessage("Open a workspace folder first.");
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Kodelens: Parsing & embedding workspace Apex files...",
        cancellable: true,
      },
      async (progress, token) => {
        try {
          // ✅ Use SemanticCodeIndexer
          const indexer = new SemanticCodeIndexer(workspaceRoot, context, cache);
          await indexer.init("mock"); // or "bge" / "openai" / "gemini" depending on user choice

          const apexFiles = await vscode.workspace.findFiles("**/*.{cls,trigger}", "**/node_modules/**");
          outputChannel.appendLine(`Found ${apexFiles.length} Apex files`);

          let totalChunks = 0;
          for (let i = 0; i < apexFiles.length; i++) {
            if (token.isCancellationRequested) {break;}

            const fileUri = apexFiles[i];
            try {
              progress.report({
                message: `Processing ${i + 1}/${apexFiles.length}`,
                increment: (1 / apexFiles.length) * 100,
              });

              const doc = await vscode.workspace.openTextDocument(fileUri);
              const sourceCode = doc.getText();

              // ✅ This will parse, chunk, generate embeddings & cache
              await indexer.indexFileWithEmbeddings(fileUri.fsPath, sourceCode);

              totalChunks++; // we can refine this if we want per-file chunk counts
              outputChannel.appendLine(`Indexed ${fileUri.fsPath}`);
            } catch (err) {
              outputChannel.appendLine(`Error processing ${fileUri.fsPath}: ${err}`);
            }
          }

          vscode.window.showInformationMessage(
            `Workspace parsing complete. Indexed ${totalChunks} files with embeddings.`
          );
        } catch (err) {
          vscode.window.showErrorMessage(`Kodelens: Failed to parse workspace - ${err}`);
          outputChannel.appendLine(`❌ Workspace parse failed: ${err}`);
        }
      }
    );
  });

  context.subscriptions.push(disposable);
}
