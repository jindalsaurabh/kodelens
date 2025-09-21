// src/commands/semanticSearchCommand.ts
import * as vscode from "vscode";
import { SemanticRetrievalService } from "../retrieval";
import { LocalBgeEmbeddingService } from "../services/LocalBgeEmbeddingService";
import { LocalCache } from "../database";

export function registerSemanticSearchCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  cache: LocalCache
) {
  const disposable = vscode.commands.registerCommand("kodelens.semanticSearchTest", async () => {
    const query = await vscode.window.showInputBox({
      prompt: "Enter a query to test semantic search",
    });
    if (!query) {return;}

    // toggle to false later if you want only top-level messages
    const DEBUG = true;

    try {
      outputChannel.appendLine("\n=== Semantic Search Diagnostic ===");

      // [STEP 1] Init embedding + retrieval
      outputChannel.appendLine("[STEP 1] Initializing embedding service...");
      const embeddingService = new LocalBgeEmbeddingService();
      const retrieval = new SemanticRetrievalService(embeddingService, cache);

      // [STEP 2] Query embedding
      outputChannel.appendLine("[STEP 2] Generating query embedding...");
      const qEmb = await embeddingService.generateEmbedding(query);
      outputChannel.appendLine(`   Query="${query}"`);
      outputChannel.appendLine(`   Embedding length=${qEmb.length}`);
      if (DEBUG) {
        outputChannel.appendLine(`   First values: ${Array.from(qEmb.slice(0, 6)).map(v => v.toFixed(4)).join(", ")}`);
      }

      // [STEP 3] Retrieve candidates
      outputChannel.appendLine("[STEP 3] Fetching candidate chunks from cache...");
      const results = await retrieval.findRelevantChunks(query, undefined, 100, 5);

      if (results.length === 0) {
        vscode.window.showInformationMessage("No semantic results found.");
        outputChannel.appendLine("❌ No results returned.");
        return;
      }

      // [STEP 4] Log results with scores
      outputChannel.appendLine(`[STEP 4] Got ${results.length} results. Displaying top-k:`);
      let scores: number[] = [];
      results.forEach((r, idx) => {
        scores.push(r.score);
        outputChannel.appendLine(
          `#${idx + 1} | Score=${r.score.toFixed(4)} | File=${r.chunk.filePath}`
        );
        outputChannel.appendLine(
          `   Snippet: ${r.chunk.text.slice(0, 100).replace(/\s+/g, " ")}...`
        );
        if (DEBUG && r.chunk.embedding) {
          outputChannel.appendLine(
            `   Emb first values: ${Array.from(r.chunk.embedding.slice(0, 6))
              .map(v => v.toFixed(4))
              .join(", ")}`
          );
        }
      });

      // [STEP 5] Stats on scores
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      outputChannel.appendLine(
        `[STEP 5] Score stats: min=${minScore.toFixed(4)}, max=${maxScore.toFixed(4)}, avg=${avgScore.toFixed(4)}`
      );

      vscode.window.showInformationMessage(`Semantic search test complete (${results.length} matches).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`❌ Semantic search error: ${msg}`);
      vscode.window.showErrorMessage(`Semantic search failed: ${msg}`);
    }
  });

  context.subscriptions.push(disposable);
}
