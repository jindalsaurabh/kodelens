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
          outputChannel.appendLine(
            `[parseWorkspace] Found ${apexFiles.length} Apex files`
          );

          let processedFiles = 0;

          for (let i = 0; i < apexFiles.length; i++) {
            if (token.isCancellationRequested) {
              outputChannel.appendLine("[parseWorkspace] Cancelled by user");
              break;
            }

            const fileUri = apexFiles[i];
            let totalProgress = 0;
            try {
              /*
              progress.report({
                message: `Processing ${i + 1}/${apexFiles.length}`,
                increment: (1 / apexFiles.length) * 100,
              });
              */
              totalProgress += 1 / apexFiles.length * 100;
              progress.report({ message: `Processing ${i+1}/${apexFiles.length}`, increment: totalProgress });

              const doc = await vscode.workspace.openTextDocument(fileUri);
              const sourceCode = doc.getText();
              const fileHash = crypto
                .createHash("sha256")
                .update(sourceCode)
                .digest("hex");
                
              outputChannel.appendLine(`[parseWorkspace] File hash: ${fileHash}`);  
              outputChannel.appendLine(`[parseWorkspace] Parsing here ${fileUri.fsPath}`);

              // Log before calling indexFile
              console.log(`[parseWorkspace] Indexing ${fileUri.fsPath}`);
              const result = await semanticIndexer.indexFile(fileUri.fsPath, sourceCode);

              if (result) {
                processedFiles++;
                outputChannel.appendLine(
                  `[parseWorkspace] Indexed ${fileUri.fsPath} → ${result.fileHash}`
                );
                console.log(
                  `[parseWorkspace] Indexed ${fileUri.fsPath} → ${result.fileHash}`
                );
              } else {
                outputChannel.appendLine(
                  `[parseWorkspace] Skipped ${fileUri.fsPath}, no chunks or embeddings`
                );
              }
            } catch (err) {
              console.error(`[parseWorkspace] Error processing ${fileUri.fsPath}`, err);
              outputChannel.appendLine(`[parseWorkspace] Error: ${err}`);
            }
          }

          vscode.window.showInformationMessage(
            `Workspace parsing complete. ${processedFiles} files processed.`
          );
          console.log(`[parseWorkspace] Parsing complete. ${processedFiles} files processed`);
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}
