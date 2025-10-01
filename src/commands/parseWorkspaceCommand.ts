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
          title: "Kodelens: Indexing Salesforce Codebase",
          cancellable: true,
        },
        async (progress, token) => {
          try {
            // Phase 1: Discover Apex files
            progress.report({ increment: 0, message: "Scanning for Apex files..." });
            outputChannel.appendLine("[parseWorkspace] Scanning for Apex files...");
            
            const apexFiles = await vscode.workspace.findFiles(
              "**/*.{cls,trigger}",
              "**/node_modules/**"
            );
            
            console.log(`[parseWorkspace] Found ${apexFiles.length} Apex files`);
            outputChannel.appendLine(`[parseWorkspace] Found ${apexFiles.length} Apex files`);
            
            if (apexFiles.length === 0) {
              progress.report({ increment: 100, message: "No Apex files found" });
              vscode.window.showInformationMessage("Kodelens: No Apex files found in workspace");
              return;
            }

            let newFilesProcessed = 0;
            let skippedFiles = 0;
            let errorFiles = 0;
            let totalChunks = 0;

            // Phase 2: Process each file with progress updates
            for (let i = 0; i < apexFiles.length; i++) {
              if (token.isCancellationRequested) {
                outputChannel.appendLine("[parseWorkspace] Cancelled by user");
                vscode.window.showInformationMessage("Kodelens: Indexing cancelled");
                break;
              }

              const fileUri = apexFiles[i];
              const progressPercent = (i / apexFiles.length) * 100;
              const fileName = fileUri.fsPath.split(/[/\\]/).pop() || fileUri.fsPath;
              
              progress.report({ 
                increment: progressPercent, 
                message: `Processing ${fileName} (${i + 1}/${apexFiles.length})...` 
              });

              try {
                const doc = await vscode.workspace.openTextDocument(fileUri);
                const sourceCode = doc.getText();
                const fileHash = crypto.createHash("sha256").update(sourceCode).digest("hex");

                // Check if file needs processing
                const stats = cache.getChunkStatsForFile(fileUri.fsPath);
                if (stats.total > 0 && stats.withEmbeddings > 0) {
                  const existingChunk = cache.getChunkByHash(fileHash);
                  if (existingChunk) {
                    skippedFiles++;
                    outputChannel.appendLine(`[parseWorkspace] Skipped (unchanged): ${fileUri.fsPath}`);
                    continue;
                  }
                }

                outputChannel.appendLine(`[parseWorkspace] Indexing: ${fileUri.fsPath}`);
                
                // Process the file
                const result = await semanticIndexer.indexFile(fileUri.fsPath, sourceCode);

                if (result && result.chunkCount > 0) {  // ✅ Fixed: chunkCount (singular)
                  newFilesProcessed++;
                  totalChunks += result.chunkCount;     // ✅ Fixed: chunkCount (singular)
                  outputChannel.appendLine(
                    `[parseWorkspace] ✅ Indexed: ${fileUri.fsPath} → ${result.chunkCount} chunks`  // ✅ Fixed
                  );
                } else {
                  outputChannel.appendLine(`[parseWorkspace] ⚠️ No chunks extracted: ${fileUri.fsPath}`);
                }

              } catch (err) {
                errorFiles++;
                console.error(`[parseWorkspace] Error processing ${fileUri.fsPath}`, err);
                outputChannel.appendLine(`[parseWorkspace] ❌ Error: ${fileUri.fsPath} - ${err}`);
                
                // Show warning for first few errors, then log silently
                if (errorFiles <= 3) {
                  vscode.window.showWarningMessage(
                    `Failed to index ${fileName}: ${err instanceof Error ? err.message : String(err)}`
                  );
                }
              }
            }

            // Phase 3: Completion
            progress.report({ increment: 100, message: "Generating semantic embeddings..." });

            // Final summary
            const summaryMessage = `Kodelens: Indexed ${newFilesProcessed} files, ${totalChunks} chunks` +
              (skippedFiles > 0 ? `, ${skippedFiles} unchanged` : '') +
              (errorFiles > 0 ? `, ${errorFiles} errors` : '');

            vscode.window.showInformationMessage(summaryMessage);
            
            // Detailed output to channel
            outputChannel.appendLine(`[parseWorkspace] 🎯 Parsing complete:`);
            outputChannel.appendLine(`  • New files processed: ${newFilesProcessed}`);
            outputChannel.appendLine(`  • Total chunks created: ${totalChunks}`);
            outputChannel.appendLine(`  • Unchanged files skipped: ${skippedFiles}`);
            outputChannel.appendLine(`  • Files with errors: ${errorFiles}`);
            
            console.log(`[parseWorkspace] Complete: ${newFilesProcessed} new, ${skippedFiles} skipped, ${errorFiles} errors, ${totalChunks} chunks`);

          } catch (error) {
            // Handle overall progress failure
            const errorMsg = error instanceof Error ? error.message : String(error);
            progress.report({ increment: 100, message: "Indexing failed!" });
            
            outputChannel.appendLine(`[parseWorkspace] ❌ Fatal error: ${errorMsg}`);
            vscode.window.showErrorMessage(`Kodelens: Indexing failed - ${errorMsg}`);
            
            console.error("[parseWorkspace] Progress task error:", error);
          }
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}