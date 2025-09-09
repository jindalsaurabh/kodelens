// src/extension.ts
import * as vscode from "vscode";
import * as crypto from "crypto";
import { CodeIndexer } from "./CodeIndexer";
import { extractChunks } from "./chunking";
import { ResultsProvider, ResultItem } from "./ResultsProvider";
import { findRelevantChunks } from "./retrieval";
import { initParserForWorkspace, safeParse } from "./services/parserService";
import { LocalCache } from "./database";
import { CodeChunk } from "./types";

// Global singletons for extension-wide state
let codeIndexer: CodeIndexer;
let resultsProvider: ResultsProvider;
let resultsTreeView: vscode.TreeView<ResultItem>;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
  // Output channel for debugging
  outputChannel = vscode.window.createOutputChannel("Kodelens-Debug");
  outputChannel.show(true);
  outputChannel.appendLine("=== Kodelens Initialization ===");

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  if (!workspaceRoot) {
    outputChannel.appendLine("No workspace folder found. Kodelens will not activate.");
    vscode.window.showWarningMessage("Please open a folder or workspace for Kodelens to function.");
    return;
  }

  // Initialize CodeIndexer
  codeIndexer = new CodeIndexer(workspaceRoot, context);

  // Initialize ResultsProvider and TreeView
  resultsProvider = new ResultsProvider();
  resultsTreeView = vscode.window.createTreeView("kodelens-results", {
    treeDataProvider: resultsProvider,
    showCollapseAll: true,
  });

  // Warm up singleton parser
  try {
    await initParserForWorkspace(workspaceRoot, context);
    outputChannel.appendLine("✓ Parser initialized successfully");
  } catch (err) {
    outputChannel.appendLine(`FATAL: Parser initialization failed. Extension will not function correctly. Error: ${err}`);
    return;
  }

  // -------------------------------
  // Command: Parse single Apex file
  // -------------------------------
  const parseApexCommand = vscode.commands.registerCommand("kodelens.parseApex", async () => {
    outputChannel.appendLine("Command invoked: kodelens.parseApex");

    const editor = vscode.window.activeTextEditor;
    if (!editor || !(/\.(cls|trigger)$/i).test(editor.document.fileName)) {
      vscode.window.showWarningMessage("Please open an Apex (.cls or .trigger) file to use this command");
      return;
    }

    const filePath = editor.document.fileName;
    const sourceCode = editor.document.getText();
    const fileHash = crypto.createHash("sha256").update(sourceCode).digest("hex");

    let cache: LocalCache | undefined;
    try {
      const tree = await safeParse(workspaceRoot, context, sourceCode);
      if (!tree) {throw new Error("Failed to parse code");}

      const chunks: CodeChunk[] = extractChunks(filePath, tree.rootNode);
      outputChannel.appendLine(`Found ${chunks.length} chunks in ${filePath}`);

      const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
      cache = new LocalCache(dbPath);
      await cache.init();

      let newChunks = 0, cachedChunks = 0;
      for (const chunk of chunks) {
        const inserted = await cache.insertChunk(chunk, filePath, fileHash).catch(() => false);
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
      if (cache) {cache.close();}
    }
  });

  // -------------------------------
  // Command: Ask question (semantic search)
  // -------------------------------
  const askCommand = vscode.commands.registerCommand("kodelens.askQuestion", async () => {
    outputChannel.appendLine("Command invoked: kodelens.askQuestion");

    const userQuestion = await vscode.window.showInputBox({
      prompt: "Ask a question about your codebase",
      placeHolder: "e.g., How do I create a new customer?",
    });
    if (!userQuestion) {
      outputChannel.appendLine("User cancelled or empty question");
      return;
    }

    const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
    let cache: LocalCache | undefined;
    try {
      cache = new LocalCache(dbPath);
      await cache.init();

      const relevantChunks = await findRelevantChunks(userQuestion, cache);
      outputChannel.appendLine(`Found ${relevantChunks.length} relevant chunks`);

      if (relevantChunks.length > 0) {
        resultsProvider.setResults(relevantChunks);
        const topChunk = relevantChunks[0];
        const preview = topChunk.text.substring(0, 100) + (topChunk.text.length > 100 ? "..." : "");
        vscode.window.showInformationMessage(`Top result: ${preview}`);
        outputChannel.appendLine(`Top chunk: ${topChunk.text}`);
      } else {
        vscode.window.showInformationMessage("No relevant code found for your question.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`Error during question answering: ${msg}`);
      vscode.window.showErrorMessage(`Failed to answer question: ${msg}`);
    } finally {
      if (cache) {cache.close();}
    }
  });

  // -------------------------------
  // Command: Parse entire workspace
  // -------------------------------
  const parseWorkspaceCommand = vscode.commands.registerCommand("kodelens.parseWorkspace", async () => {
    outputChannel.appendLine("Command invoked: kodelens.parseWorkspace");
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showWarningMessage("Please open a workspace folder first.");
      return;
    }

    const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
    let cache: LocalCache | undefined;

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Kodelens: Parsing workspace Apex files...", cancellable: true },
      async (progress, token) => {
        cache = new LocalCache(dbPath);
        await cache.init();

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
            for (const chunk of chunks) {
              await cache.insertChunk(chunk, fileUri.fsPath, fileHash).catch(() => false);
              totalChunks++;
            }

            outputChannel.appendLine(`Processed ${fileUri.fsPath} (${chunks.length} chunks)`);
          } catch (err) {
            outputChannel.appendLine(`Error processing ${fileUri.fsPath}: ${err}`);
          }
        }

        vscode.window.showInformationMessage(`Workspace parsing complete. ${totalChunks} chunks processed.`);
      }
    );

    if (cache) {cache.close();}
  });

  // -------------------------------
  // Command: Find references
  // -------------------------------
  const findReferencesDisposable = vscode.commands.registerCommand("kodelens.findReferences", async () => {
    if (!codeIndexer) {
      vscode.window.showErrorMessage("Code indexer not ready yet.");
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor!");
      return;
    }

    const wordRange = editor.document.getWordRangeAtPosition(editor.selection.start);
    if (!wordRange) {
      vscode.window.showErrorMessage("Place cursor on a word to find references.");
      return;
    }

    const symbolName = editor.document.getText(wordRange);
    outputChannel.appendLine(`Finding references for: ${symbolName}`);

    const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
    let cache: LocalCache | undefined;
    try {
      cache = new LocalCache(dbPath);
      await cache.init();

      const results = await cache.findChunksByKeywords([symbolName]);
      outputChannel.appendLine(`Found ${results.length} references`);

      if (results.length === 0) {
        vscode.window.showInformationMessage(`No references found for: ${symbolName}`);
      } else {
        resultsProvider.setResults(results);
        vscode.window.showInformationMessage(`Found ${results.length} references for: ${symbolName}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`Error finding references: ${msg}`);
      vscode.window.showErrorMessage(`Error finding references: ${msg}`);
    } finally {
      if (cache) {cache.close();}
    }
  });

  // -------------------------------
  // Register all commands and output channel
  // -------------------------------
  context.subscriptions.push(
    parseApexCommand,
    askCommand,
    parseWorkspaceCommand,
    findReferencesDisposable,
    outputChannel
  );

  outputChannel.appendLine("=== Kodelens Ready ===");
}

export function deactivate() {
  outputChannel?.dispose();
  console.log("Kodelens deactivated");
}
