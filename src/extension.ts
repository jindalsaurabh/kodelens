// src/extension.ts
import * as vscode from "vscode";
import * as crypto from "crypto";
import { CodeIndexer } from "./CodeIndexer";
import { extractChunks } from "./chunking";
import { ResultsProvider, ResultItem } from "./ResultsProvider";
import { findRelevantChunks } from "./retrieval";
import { initParserForWorkspace, safeParse } from "./services/parserService";
import { LocalCache, ILocalCache } from "./database";
import { CodeChunk } from "./types";
import { SemanticCodeIndexer } from "./SemanticCodeIndexer";
import { createEmbeddingService } from "./services/embeddingFactory";


let codeIndexer: CodeIndexer;
let resultsProvider: ResultsProvider;
let resultsTreeView: vscode.TreeView<ResultItem>;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Kodelens-Debug");
  outputChannel.show(true);
  outputChannel.appendLine("=== Kodelens Initialization ===");

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showWarningMessage("Open a folder/workspace for Kodelens to function.");
    return;
  }
  // Read user settings
  const config = vscode.workspace.getConfiguration("kodelens");
  const embeddingModel = config.get<string>("embeddingModel") || "mock";
  const openAiApiKey = config.get<string>("openAiApiKey");
  const googleApiKey = config.get<string>("googleApiKey");
  let apiKey: string | undefined;
  if (embeddingModel === "openai") {
    apiKey = openAiApiKey;
  } else if (embeddingModel === "google") {
    apiKey = googleApiKey;
  }
    // Create DB/cache
  const cache = new LocalCache(workspaceRoot);

  const embeddingService = createEmbeddingService(embeddingModel, apiKey);
  // Create semantic indexer
  const indexer = new SemanticCodeIndexer(
    workspaceRoot,
    context,
    cache,
    embeddingModel,
    embeddingModel === "openai" ? openAiApiKey : googleApiKey
  );

  
  

  // Example: index all files when extension activates
  // (Later we can hook this to commands/events)
  vscode.window.showInformationMessage(`KodeLens using ${embeddingModel} embeddings`);
  
  codeIndexer = new CodeIndexer(workspaceRoot, context);

  resultsProvider = new ResultsProvider();
  resultsTreeView = vscode.window.createTreeView("kodelens-results", {
    treeDataProvider: resultsProvider,
    showCollapseAll: true,
  });

  try {
    await initParserForWorkspace(workspaceRoot, context);
    outputChannel.appendLine("✓ Parser initialized successfully");
  } catch (err) {
    outputChannel.appendLine(`FATAL: Parser init failed. Error: ${err}`);
    return;
  }

  // -------------------------------
  // Command: Parse single Apex file
  // -------------------------------
  const parseApexCommand = vscode.commands.registerCommand(
    "kodelens.parseApex",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !(/\.(cls|trigger)$/i).test(editor.document.fileName)) {
        vscode.window.showWarningMessage("Open an Apex file (.cls or .trigger) first.");
        return;
      }

      const filePath = editor.document.fileName;
      const sourceCode = editor.document.getText();
      const fileHash = crypto.createHash("sha256").update(sourceCode).digest("hex");

      const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
      let cache: ILocalCache | undefined;
      try {
        const tree = await safeParse(workspaceRoot, context, sourceCode);
        if (!tree) {throw new Error("Parse failed");}

        const chunks: CodeChunk[] = extractChunks(filePath, tree.rootNode);
        outputChannel.appendLine(`Found ${chunks.length} chunks`);

        cache = new LocalCache(dbPath);
        cache.init();

        let newChunks = 0, cachedChunks = 0;
        for (const chunk of chunks) {
          const inserted = cache.insertChunk(chunk, filePath, fileHash);
          inserted ? newChunks++ : cachedChunks++;
        }

        const msg = `Processed ${chunks.length} chunks. ${newChunks} new, ${cachedChunks} cached.`;
        outputChannel.appendLine(msg);
        vscode.window.showInformationMessage(msg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Error parsing file: ${msg}`);
        vscode.window.showErrorMessage(`KodeLens: Parsing failed - ${msg}`);
      } finally {
        cache?.close();
      }
    }
  );

  // -------------------------------
  // Command: Ask question
  // -------------------------------
  const askCommand = vscode.commands.registerCommand(
    "kodelens.askQuestion",
    async () => {
      const userQuestion = await vscode.window.showInputBox({
        prompt: "Ask a question about your codebase",
      });
      if (!userQuestion) {return;}

      const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
      let cache: ILocalCache | undefined;
      try {
        const cache = new LocalCache(dbPath);
        cache.init();
        const relevantChunks = await findRelevantChunks(userQuestion, cache);
        outputChannel.appendLine(`Found ${relevantChunks.length} relevant chunks`);

        if (relevantChunks.length > 0) {
          resultsProvider.setResults(relevantChunks);
          const topChunk = relevantChunks[0];
          vscode.window.showInformationMessage(`Top result: ${topChunk.text.slice(0, 100)}...`);
        } else {
          vscode.window.showInformationMessage("No relevant code found.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Error: ${msg}`);
        vscode.window.showErrorMessage(`Failed to answer question: ${msg}`);
      } finally {
        cache?.close();
      }
    }
  );

  // -------------------------------
  // Command: Parse workspace
  // -------------------------------
  const parseWorkspaceCommand = vscode.commands.registerCommand(
    "kodelens.parseWorkspace",
    async () => {
      if (!vscode.workspace.workspaceFolders) {
        vscode.window.showWarningMessage("Open a workspace folder first.");
        return;
      }

      const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
      let cache: ILocalCache | undefined;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Kodelens: Parsing workspace Apex files...",
          cancellable: true,
        },
        async (progress, token) => {
          cache = new LocalCache(dbPath);
          cache.init();

          const apexFiles = await vscode.workspace.findFiles("**/*.{cls,trigger}", "**/node_modules/**");
          outputChannel.appendLine(`Found ${apexFiles.length} Apex files`);

          let totalChunks = 0;
          for (let i = 0; i < apexFiles.length; i++) {
            if (token.isCancellationRequested) {break;}

            const fileUri = apexFiles[i];
            try {
              progress.report({ message: `Processing ${i + 1}/${apexFiles.length}`, increment: (1 / apexFiles.length) * 100 });

              const doc = await vscode.workspace.openTextDocument(fileUri);
              const sourceCode = doc.getText();
              const fileHash = crypto.createHash("sha256").update(sourceCode).digest("hex");

              const tree = await safeParse(workspaceRoot, context, sourceCode);
              if (!tree) {continue;}

              const chunks = extractChunks(fileUri.fsPath, tree.rootNode);
              cache.insertChunks(chunks, fileUri.fsPath, fileHash);
              totalChunks += chunks.length;

              outputChannel.appendLine(`Processed ${fileUri.fsPath} (${chunks.length} chunks)`);
            } catch (err) {
              outputChannel.appendLine(`Error processing ${fileUri.fsPath}: ${err}`);
            }
          }

          vscode.window.showInformationMessage(`Workspace parsing complete. ${totalChunks} chunks processed.`);
        }
      );

      cache?.close();
    }
  );

  // -------------------------------
  // Command: Find references
  // -------------------------------
  const findReferencesDisposable = vscode.commands.registerCommand(
    "kodelens.findReferences",
    async () => {
      if (!codeIndexer) {return vscode.window.showErrorMessage("Indexer not ready");}

      const editor = vscode.window.activeTextEditor;
      if (!editor) {return vscode.window.showErrorMessage("No active editor");}

      const wordRange = editor.document.getWordRangeAtPosition(editor.selection.start);
      if (!wordRange) {return vscode.window.showErrorMessage("Place cursor on a word");}

      const symbolName = editor.document.getText(wordRange);
      outputChannel.appendLine(`Finding references for: ${symbolName}`);

      const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
      const cache = new LocalCache(dbPath);
      cache.init();

      const relevantChunks = await findRelevantChunks(symbolName, cache);
      if (relevantChunks.length) {resultsProvider.setResults(relevantChunks);}

      cache.close();
    }
  );

  context.subscriptions.push(parseApexCommand, askCommand, parseWorkspaceCommand, findReferencesDisposable, outputChannel);
}
