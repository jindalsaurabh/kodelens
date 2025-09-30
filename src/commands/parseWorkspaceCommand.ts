// src/commands/parseWorkspaceCommand.ts
import * as vscode from "vscode";
import * as crypto from "crypto";
import { LocalCache } from "../database";
import { SemanticCodeIndexer } from "../SemanticCodeIndexer";
import { ApexAdapter } from "../adapters/ApexAdapter";
import { logger } from "../utils/logger";

export function registerParseWorkspaceCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  cache: LocalCache,
  semanticIndexer: SemanticCodeIndexer,
  workspaceRoot: string,
  apexAdapter: ApexAdapter
) {
  const disposable = vscode.commands.registerCommand(
    "kodelens.parseWorkspace",
    async () => {
      console.log("[parseWorkspace] Command triggered");
      outputChannel.appendLine("[parseWorkspace] Command triggered");

      if (!vscode.workspace.workspaceFolders) {
        vscode.window.showWarningMessage("Open a workspace folder first.");
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Kodelens: Parsing workspace Apex files...",
          cancellable: true,
        },
        async (progress, token) => {
          const apexFiles = await vscode.workspace.findFiles(
            "**/*.{cls,trigger}",
            "**/node_modules/**"
          );
          console.log(`[parseWorkspace] Found ${apexFiles.length} Apex files`);
          outputChannel.appendLine(`[parseWorkspace] Found ${apexFiles.length} Apex files`);

          let newFilesProcessed = 0;
          let skippedFiles = 0;

          for (let i = 0; i < apexFiles.length; i++) {
            if (token.isCancellationRequested) {
              outputChannel.appendLine("[parseWorkspace] Cancelled by user");
              break;
            }

            const fileUri = apexFiles[i];
            try {
              const doc = await vscode.workspace.openTextDocument(fileUri);
              const sourceCode = doc.getText();
              const fileHash = crypto.createHash("sha256").update(sourceCode).digest("hex");

              const stats = cache.getChunkStatsForFile(fileUri.fsPath);
              if (stats.total > 0 && stats.withEmbeddings > 0) {
                // check existing hash to skip unchanged files
                const row = cache.getChunkById(`${fileUri.fsPath}:${fileHash}`);
                if (row) {
                  skippedFiles++;
                  outputChannel.appendLine(`[parseWorkspace] Skipped (up-to-date): ${fileUri.fsPath}`);
                  continue;
                }
              }

              outputChannel.appendLine(`[parseWorkspace] Parsing: ${fileUri.fsPath}`);

              const result = await semanticIndexer.indexFile(fileUri.fsPath, sourceCode);

              if (result) {
                newFilesProcessed++;
                outputChannel.appendLine(`[parseWorkspace] Indexed: ${fileUri.fsPath} → ${result.fileHash}`);
              } else {
                outputChannel.appendLine(`[parseWorkspace] No chunks or embeddings: ${fileUri.fsPath}`);
              }
            } catch (err) {
              console.error(`[parseWorkspace] Error processing ${fileUri.fsPath}`, err);
              outputChannel.appendLine(`[parseWorkspace] Error: ${err}`);
            }
          }

          vscode.window.showInformationMessage(
            `Workspace parsing complete. ${newFilesProcessed} new files processed, ${skippedFiles} skipped.`
          );
          console.log(`[parseWorkspace] Parsing complete. ${newFilesProcessed} new files, ${skippedFiles} skipped.`);
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}
