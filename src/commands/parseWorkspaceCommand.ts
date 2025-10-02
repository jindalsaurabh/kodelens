// src/commands/parseWorkspaceCommand.ts
import * as vscode from "vscode";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { LocalCache } from "../database";
import { SemanticCodeIndexer } from "../SemanticCodeIndexer";
import { ApexAdapter } from "../adapters/ApexAdapter";
import { logger } from "../utils/logger";
import { PowerSaveManager } from "../utils/PowerSaveManager";
import { ProgressTracker, ProgressState } from "../utils/ProgressTracker";

export function registerParseWorkspaceCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  cache: LocalCache,
  semanticIndexer: SemanticCodeIndexer,
  workspaceRoot: string,
  apexAdapter: ApexAdapter
) {
  const powerSaveManager = new PowerSaveManager();
  const progressTracker = new ProgressTracker(context);

  const disposable = vscode.commands.registerCommand(
    "kodelens.parseWorkspace",
    async () => {
      console.log("[parseWorkspace] Command triggered");
      outputChannel.appendLine("[parseWorkspace] Command triggered");

      if (!vscode.workspace.workspaceFolders) {
        vscode.window.showWarningMessage("Open a workspace folder first.");
        return;
      }

      // Prevent system sleep during indexing
      powerSaveManager.preventSleep('Salesforce code indexing');

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Kodelens: Indexing Salesforce Codebase (sleep-resistant)",
          cancellable: true,
        },
        async (progress, token) => {
          try {
            // Check for previous progress
            const previousProgress = await progressTracker.loadProgress();
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

            // Handle resume logic
            if (previousProgress && previousProgress.status === 'running') {
              const choice = await vscode.window.showInformationMessage(
                `Found incomplete indexing (${previousProgress.processedFiles.length}/${apexFiles.length} files). Resume?`,
                'Resume', 'Restart', 'Cancel'
              );
              
              if (choice === 'Resume') {
                await resumeParsing(apexFiles, previousProgress, progressTracker, 
                                  semanticIndexer, cache, outputChannel, progress, token);
                return;
              } else if (choice === 'Cancel') {
                return;
              }
              // If 'Restart', clear progress and continue
              await progressTracker.clearProgress();
            }

            // Start fresh parsing with batch processing
            await startFreshParsingWithBatches(apexFiles, progressTracker, semanticIndexer, 
                                             cache, outputChannel, progress, token);

          } catch (error) {
            // Handle overall progress failure
            const errorMsg = error instanceof Error ? error.message : String(error);
            progress.report({ increment: 100, message: "Indexing failed!" });
            
            outputChannel.appendLine(`[parseWorkspace] ❌ Fatal error: ${errorMsg}`);
            vscode.window.showErrorMessage(`Kodelens: Indexing failed - ${errorMsg}`);
            
            console.error("[parseWorkspace] Progress task error:", error);
          } finally {
            // Always allow sleep when done
            powerSaveManager.allowSleep();
          }
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

/**
 * Resume parsing from previous progress (single file processing)
 */
async function resumeParsing(
  apexFiles: vscode.Uri[],
  previousProgress: ProgressState,
  progressTracker: ProgressTracker,
  semanticIndexer: SemanticCodeIndexer,
  cache: LocalCache,
  outputChannel: vscode.OutputChannel,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken
): Promise<void> {
  outputChannel.appendLine(`[parseWorkspace] Resuming from previous progress: ${previousProgress.processedFiles.length}/${apexFiles.length} files`);
  
  const processedSet = new Set(previousProgress.processedFiles);
  let newFilesProcessed = previousProgress.processedFiles.length;
  let skippedFiles = 0;
  let errorFiles = previousProgress.failedFiles.length;
  let totalChunks = previousProgress.totalChunks;

  // Start from where we left off
  const startIndex = previousProgress.processedFiles.length;
  
  for (let i = startIndex; i < apexFiles.length; i++) {
    if (token.isCancellationRequested) {
      outputChannel.appendLine("[parseWorkspace] Cancelled by user during resume");
      await progressTracker.saveProgress({
        ...previousProgress,
        status: 'paused',
        processedFiles: previousProgress.processedFiles.slice(0, i)
      });
      break;
    }

    const fileUri = apexFiles[i];
    const progressPercent = (i / apexFiles.length) * 100;
    const fileName = fileUri.fsPath.split(/[/\\]/).pop() || fileUri.fsPath;
    
    progress.report({ 
      increment: progressPercent, 
      message: `Resuming: ${fileName} (${i + 1}/${apexFiles.length})...` 
    });

    try {
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const sourceCode = doc.getText();
      const fileHash = crypto.createHash("sha256").update(sourceCode).digest("hex");

      // Check if file needs processing (using cache logic)
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

      if (result && result.chunkCount > 0) {
        newFilesProcessed++;
        totalChunks += result.chunkCount;
        outputChannel.appendLine(
          `[parseWorkspace] ✅ Indexed: ${fileUri.fsPath} → ${result.chunkCount} chunks`
        );
      } else {
        outputChannel.appendLine(`[parseWorkspace] ⚠️ No chunks extracted: ${fileUri.fsPath}`);
      }

      // Update progress state
      previousProgress.processedFiles.push(fileUri.fsPath);
      previousProgress.currentBatch = i;
      previousProgress.totalChunks = totalChunks;

      // Save progress every 10 files
      if (i % 10 === 0 || i === apexFiles.length - 1) {
        await progressTracker.saveProgress(previousProgress);
      }

    } catch (err) {
      errorFiles++;
      console.error(`[parseWorkspace] Error processing ${fileUri.fsPath}`, err);
      outputChannel.appendLine(`[parseWorkspace] ❌ Error: ${fileUri.fsPath} - ${err}`);
      
      previousProgress.failedFiles.push({
        path: fileUri.fsPath,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now()
      });

      // Show warning for first few errors, then log silently
      if (errorFiles <= 3) {
        vscode.window.showWarningMessage(
          `Failed to index ${fileName}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // Mark as completed if we finished
  if (newFilesProcessed === apexFiles.length) {
    previousProgress.status = 'completed';
    await progressTracker.saveProgress(previousProgress);
    await progressTracker.clearProgress(); // Clean up when fully done
  }

  // Final summary
  progress.report({ increment: 100, message: "Generating semantic embeddings..." });

  const summaryMessage = `Kodelens: Indexed ${newFilesProcessed} files, ${totalChunks} chunks` +
    (skippedFiles > 0 ? `, ${skippedFiles} unchanged` : '') +
    (errorFiles > 0 ? `, ${errorFiles} errors` : '') +
    ` (Resumed from ${startIndex} files)`;

  vscode.window.showInformationMessage(summaryMessage);
  
  outputChannel.appendLine(`[parseWorkspace] 🎯 Parsing complete (resumed):`);
  outputChannel.appendLine(`  • New files processed: ${newFilesProcessed}`);
  outputChannel.appendLine(`  • Total chunks created: ${totalChunks}`);
  outputChannel.appendLine(`  • Unchanged files skipped: ${skippedFiles}`);
  outputChannel.appendLine(`  • Files with errors: ${errorFiles}`);
}

/**
 * Start fresh parsing session with batch processing and FIXED progress tracking
 */
async function startFreshParsingWithBatches(
  apexFiles: vscode.Uri[],
  progressTracker: ProgressTracker,
  semanticIndexer: SemanticCodeIndexer,
  cache: LocalCache,
  outputChannel: vscode.OutputChannel,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken
): Promise<void> {
  const initialState: ProgressState = {
    totalFiles: apexFiles.length,
    processedFiles: [],
    failedFiles: [],
    startTime: Date.now(),
    currentBatch: 0,
    totalChunks: 0,
    status: 'running'
  };

  await progressTracker.saveProgress(initialState);

  let filesProcessed = 0;
  let totalChunks = 0;

  progress.report({ increment: 0, message: "Preparing batch indexing..." });
  outputChannel.appendLine("[parseWorkspace] Starting batch indexing...");

  try {
    const BATCH_SIZE = 5;
    const CONCURRENCY = 3;
    const totalBatches = Math.ceil(apexFiles.length / BATCH_SIZE);
    
    outputChannel.appendLine(`[parseWorkspace] Using batch processing: ${BATCH_SIZE} files per batch, ${CONCURRENCY} concurrent batches, ${totalBatches} total batches`);

    // Create batches
    const batches: vscode.Uri[][] = [];
    for (let i = 0; i < apexFiles.length; i += BATCH_SIZE) {
      batches.push(apexFiles.slice(i, i + BATCH_SIZE));
    }

    // ✅ FIXED: Track progress correctly
    let lastReportedProgress = 0;
    const progressPerBatch = 100 / batches.length;

    // Process batches with progress tracking
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += CONCURRENCY) {
      if (token.isCancellationRequested) {
        outputChannel.appendLine("[parseWorkspace] Cancelled by user during batch processing");
        await progressTracker.saveProgress({
          ...initialState,
          status: 'paused',
          processedFiles: initialState.processedFiles
        });
        vscode.window.showInformationMessage("Kodelens: Indexing paused - progress saved");
        break;
      }

      const currentBatches = batches.slice(batchIndex, batchIndex + CONCURRENCY);
      const currentBatchStart = batchIndex + 1;
      const currentBatchEnd = Math.min(batchIndex + CONCURRENCY, batches.length);
      
      // ✅ FIXED: Calculate progress increment correctly
      const batchesCompleted = batchIndex;
      const currentProgress = Math.min(batchesCompleted * progressPerBatch, 100);
      const increment = currentProgress - lastReportedProgress;
      lastReportedProgress = currentProgress;

      // Only report progress if we have meaningful increment
      if (increment > 0) {
        progress.report({ 
          increment: increment,
          message: `Processing batches ${currentBatchStart}-${currentBatchEnd} of ${totalBatches}...` 
        });
      }

      outputChannel.appendLine(`[parseWorkspace] Processing batches ${currentBatchStart}-${currentBatchEnd} of ${totalBatches}`);

      // Process current batch group in parallel
      const batchPromises = currentBatches.map(async (batch, subIndex) => {
        const actualBatchIndex = batchIndex + subIndex;
        
        // Update message for individual batch (no increment here)
        const batchFileNames = batch.map(file => path.basename(file.fsPath)).join(', ');
        
        progress.report({
          message: `Batch ${actualBatchIndex + 1}/${totalBatches}: ${batchFileNames}`
        });

        outputChannel.appendLine(`[parseWorkspace] Processing batch ${actualBatchIndex + 1}: ${batch.length} files`);
        
        try {
          // Process this batch
          await semanticIndexer.indexFilesBatch(batch);
          
          // Update progress
          filesProcessed += batch.length;
          initialState.processedFiles.push(...batch.map(file => file.fsPath));
          initialState.currentBatch = actualBatchIndex;
          
          // Estimate chunks (we can enhance this later with actual counts)
          totalChunks += Math.round(batch.length * 15); // ~15 chunks per file average
          initialState.totalChunks = totalChunks;
          
          outputChannel.appendLine(`[parseWorkspace] ✅ Completed batch ${actualBatchIndex + 1}: ${batch.length} files`);
          
          // Save progress after each batch group
          await progressTracker.saveProgress(initialState);
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          outputChannel.appendLine(`[parseWorkspace] ❌ Batch ${actualBatchIndex + 1} failed: ${errorMsg}`);
          
          initialState.failedFiles.push({
            path: `Batch ${actualBatchIndex + 1}`,
            error: errorMsg,
            timestamp: Date.now()
          });
          
          throw error; // Re-throw to be caught by Promise.allSettled
        }
      });

      // Wait for current batch group to complete
      const results = await Promise.allSettled(batchPromises);
      
      // Check for failures in current batch group
      const failedBatches = results.filter(result => result.status === 'rejected');
      if (failedBatches.length > 0) {
        outputChannel.appendLine(`[parseWorkspace] ${failedBatches.length} batches failed in current group`);
        // Continue with next batches despite failures
      }

      // Small delay to prevent resource exhaustion
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // ✅ FIXED: Report final completion
    if (!token.isCancellationRequested) {
      // Ensure we reach 100%
      const remainingProgress = 100 - lastReportedProgress;
      if (remainingProgress > 0) {
        progress.report({ increment: remainingProgress, message: "Finalizing..." });
      }

      initialState.status = 'completed';
      await progressTracker.saveProgress(initialState);
      await progressTracker.clearProgress();

      // Final summary
      progress.report({ message: "Indexing complete!" });

      const summaryMessage = `Kodelens: Indexed ${filesProcessed} files, ~${totalChunks} chunks`;
      vscode.window.showInformationMessage(summaryMessage);
      
      outputChannel.appendLine(`[parseWorkspace] 🎯 Batch parsing complete:`);
      outputChannel.appendLine(`  • Files processed: ${filesProcessed}`);
      outputChannel.appendLine(`  • Estimated chunks: ${totalChunks}`);
      outputChannel.appendLine(`  • Batch size: ${BATCH_SIZE}, Concurrency: ${CONCURRENCY}`);
      
      console.log(`[parseWorkspace] Batch complete: ${filesProcessed} files processed, ~${totalChunks} chunks`);
    }

  } catch (error) {
    // Handle batch processing failure
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    outputChannel.appendLine(`[parseWorkspace] ❌ Batch processing failed: ${errorMsg}`);
    vscode.window.showErrorMessage(`Kodelens: Batch indexing failed - ${errorMsg}`);
    
    // Fall back to single file processing if batch fails
    outputChannel.appendLine("[parseWorkspace] Falling back to single file processing...");
    await startFreshParsingSingleFile(apexFiles, progressTracker, semanticIndexer, 
                                    cache, outputChannel, progress, token);
  }
}
/**
 * Fallback: Start fresh parsing session with single file processing
 */
async function startFreshParsingSingleFile(
  apexFiles: vscode.Uri[],
  progressTracker: ProgressTracker,
  semanticIndexer: SemanticCodeIndexer,
  cache: LocalCache,
  outputChannel: vscode.OutputChannel,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken
): Promise<void> {
  const initialState: ProgressState = {
    totalFiles: apexFiles.length,
    processedFiles: [],
    failedFiles: [],
    startTime: Date.now(),
    currentBatch: 0,
    totalChunks: 0,
    status: 'running'
  };

  await progressTracker.saveProgress(initialState);

  let newFilesProcessed = 0;
  let skippedFiles = 0;
  let errorFiles = 0;
  let totalChunks = 0;

  progress.report({ increment: 0, message: "Starting single file indexing..." });
  outputChannel.appendLine("[parseWorkspace] Starting single file indexing...");

  for (let i = 0; i < apexFiles.length; i++) {
    if (token.isCancellationRequested) {
      outputChannel.appendLine("[parseWorkspace] Cancelled by user");
      await progressTracker.saveProgress({
        ...initialState,
        status: 'paused',
        processedFiles: initialState.processedFiles
      });
      vscode.window.showInformationMessage("Kodelens: Indexing paused - progress saved");
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

      if (result && result.chunkCount > 0) {
        newFilesProcessed++;
        totalChunks += result.chunkCount;
        outputChannel.appendLine(
          `[parseWorkspace] ✅ Indexed: ${fileUri.fsPath} → ${result.chunkCount} chunks`
        );
      } else {
        outputChannel.appendLine(`[parseWorkspace] ⚠️ No chunks extracted: ${fileUri.fsPath}`);
      }

      // Update progress state
      initialState.processedFiles.push(fileUri.fsPath);
      initialState.currentBatch = i;
      initialState.totalChunks = totalChunks;

      // Save progress every 10 files
      if (i % 10 === 0 || i === apexFiles.length - 1) {
        await progressTracker.saveProgress(initialState);
      }

    } catch (err) {
      errorFiles++;
      console.error(`[parseWorkspace] Error processing ${fileUri.fsPath}`, err);
      outputChannel.appendLine(`[parseWorkspace] ❌ Error: ${fileUri.fsPath} - ${err}`);
      
      initialState.failedFiles.push({
        path: fileUri.fsPath,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now()
      });

      // Show warning for first few errors, then log silently
      if (errorFiles <= 3) {
        vscode.window.showWarningMessage(
          `Failed to index ${fileName}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // Mark as completed
  if (!token.isCancellationRequested) {
    initialState.status = 'completed';
    await progressTracker.saveProgress(initialState);
    await progressTracker.clearProgress(); // Clean up when fully done
  }

  // Final summary
  progress.report({ increment: 100, message: "Generating semantic embeddings..." });

  const summaryMessage = `Kodelens: Indexed ${newFilesProcessed} files, ${totalChunks} chunks` +
    (skippedFiles > 0 ? `, ${skippedFiles} unchanged` : '') +
    (errorFiles > 0 ? `, ${errorFiles} errors` : '');

  vscode.window.showInformationMessage(summaryMessage);
  
  outputChannel.appendLine(`[parseWorkspace] 🎯 Parsing complete:`);
  outputChannel.appendLine(`  • New files processed: ${newFilesProcessed}`);
  outputChannel.appendLine(`  • Total chunks created: ${totalChunks}`);
  outputChannel.appendLine(`  • Unchanged files skipped: ${skippedFiles}`);
  outputChannel.appendLine(`  • Files with errors: ${errorFiles}`);
  
  console.log(`[parseWorkspace] Complete: ${newFilesProcessed} new, ${skippedFiles} skipped, ${errorFiles} errors, ${totalChunks} chunks`);
}