import * as vscode from "vscode";
import * as path from "path";
import * as crypto from "crypto";
import { ApexAdapter } from "./adapters/ApexAdapter";
import { extractChunksFromAst, ASTChunk, normalizeText, generateHash } from "./adapters/chunker";
import { LocalCache } from "./database";
import { findRelevantChunks } from "./retrieval";
import { CodeIndexer } from "./CodeIndexer";
import { ResultsProvider, ResultItem } from "./ResultsProvider";

let apexAdapter = new ApexAdapter();
let codeIndexer: CodeIndexer;
let resultsProvider: ResultsProvider;
let resultsTreeView: vscode.TreeView<ResultItem>;

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Kodelens-Debug");
  outputChannel.show(true);

  // Initialize CodeIndexer & ResultsProvider
  codeIndexer = new CodeIndexer();
  resultsProvider = new ResultsProvider();
  resultsTreeView = vscode.window.createTreeView("kodelens-results", {
    treeDataProvider: resultsProvider,
    showCollapseAll: true
  });

  outputChannel.appendLine("=== Kodelens Initialization ===");

  try {
    // Initialize Apex parser singleton
    if (!vscode.workspace.workspaceFolders) {
      throw new Error("Open a workspace folder first.");
    }
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    await apexAdapter.init(workspaceRoot);
    outputChannel.appendLine("Parser initialized successfully.");

    /** -------------------- kodelens.parseApex -------------------- */
    const parseCommand = vscode.commands.registerCommand(
      "kodelens.parseApex",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !/\.(cls|trigger)$/i.test(editor.document.fileName)) {
          vscode.window.showWarningMessage("Open an Apex (.cls/.trigger) file to parse.");
          return;
        }

        let cache: LocalCache | undefined;
        try {
          const filePath = editor.document.fileName;
          const sourceCode = editor.document.getText();
          outputChannel.appendLine(`Parsing file: ${filePath}`);

          const tree = apexAdapter.parse(sourceCode);
          const rawChunks: ASTChunk[] = extractChunksFromAst(tree.rootNode, sourceCode);

          const storageUri = context.globalStorageUri;
          await vscode.workspace.fs.createDirectory(storageUri);
          const dbPath = vscode.Uri.joinPath(storageUri, "kodelens-cache.sqlite").fsPath;
          cache = new LocalCache(dbPath);
          await cache.init();

          const fileHash = crypto.createHash("sha256").update(sourceCode).digest("hex");

          let newChunks = 0;
          let cachedChunks = 0;

          for (const rawChunk of rawChunks) {
            const normalizedText = normalizeText(rawChunk.code ?? "");
            const chunkHash = generateHash(normalizedText);

            const processedChunk: ASTChunk & { hash: string; text: string } = {
              ...rawChunk,
              hash: chunkHash,
              text: normalizedText
            };

            const inserted = await cache.insertChunk(processedChunk, filePath, fileHash).catch(err => {
              outputChannel.appendLine(`Failed to insert chunk: ${err}`);
              return false;
            });

            if (inserted) { newChunks++; }
            else { cachedChunks++; }
          }

          const msg = `Processed ${rawChunks.length} chunks. ${newChunks} new, ${cachedChunks} already cached.`;
          outputChannel.appendLine(msg);
          vscode.window.showInformationMessage(msg);

        } catch (err) {
          outputChannel.appendLine(`Error: ${err}`);
          vscode.window.showErrorMessage(`Parsing failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
          cache?.close();
        }
      }
    );

    /** -------------------- kodelens.askQuestion -------------------- */
    const askCommand = vscode.commands.registerCommand(
      "kodelens.askQuestion",
      async () => {
        const userQuestion = await vscode.window.showInputBox({
          prompt: "Ask a question about your codebase",
          placeHolder: "e.g., How do I create a new customer?"
        });
        if (!userQuestion?.trim()) { return; }

        let cache: LocalCache | undefined;
        try {
          const storageUri = context.globalStorageUri;
          const dbPath = vscode.Uri.joinPath(storageUri, "kodelens-cache.sqlite").fsPath;
          cache = new LocalCache(dbPath);

          const relevantChunks = await findRelevantChunks(userQuestion, cache);
          if (relevantChunks.length > 0) {
            const topChunk = relevantChunks[0];
            const preview = topChunk.text.substring(0, 100) + (topChunk.text.length > 100 ? "..." : "");
            vscode.window.showInformationMessage(`Top result: ${preview}`);
            outputChannel.appendLine(`Top chunk: ${topChunk.text}`);
          } else {
            vscode.window.showInformationMessage("No relevant code found.");
          }
        } catch (err) {
          outputChannel.appendLine(`Error: ${err}`);
          vscode.window.showErrorMessage(`Failed to answer question: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
          cache?.close();
        }
      }
    );

    /** -------------------- kodelens.parseWorkspace -------------------- */
    const parseWorkspaceCommand = vscode.commands.registerCommand(
      "kodelens.parseWorkspace",
      async () => {
        if (!vscode.workspace.workspaceFolders) {
          vscode.window.showWarningMessage("Open a workspace folder first.");
          return;
        }

        const storageUri = context.globalStorageUri;
        await vscode.workspace.fs.createDirectory(storageUri);
        const dbPath = vscode.Uri.joinPath(storageUri, "kodelens-cache.sqlite").fsPath;
        let cache: LocalCache | undefined;

        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Kodelens: Parsing workspace Apex files...",
          cancellable: true
        }, async (progress, token) => {
          token.onCancellationRequested(() => outputChannel.appendLine("User cancelled workspace parsing."));
          cache = new LocalCache(dbPath);
          await cache.init();

          const apexFiles = await vscode.workspace.findFiles("**/*.{cls,trigger}", "**/node_modules/**");
          outputChannel.appendLine(`Found ${apexFiles.length} Apex files.`);

          let totalChunks = 0;
          let processedFiles = 0;

          for (const fileUri of apexFiles) {
            if (token.isCancellationRequested) { break; }

            processedFiles++;
            progress.report({ message: `Processing file ${processedFiles}/${apexFiles.length}`, increment: (1 / apexFiles.length) * 100 });

            try {
              const doc = await vscode.workspace.openTextDocument(fileUri);
              const sourceCode = doc.getText();
              const fileHash = crypto.createHash("sha256").update(sourceCode).digest("hex");

              const tree = apexAdapter.parse(sourceCode);
              const rawChunks: ASTChunk[] = extractChunksFromAst(tree.rootNode, sourceCode);

              for (const rawChunk of rawChunks) {
                const normalizedText = normalizeText(rawChunk.code ?? "");
                const chunkHash = generateHash(normalizedText);
                const processedChunk = { ...rawChunk, hash: chunkHash, text: normalizedText };
                await cache.insertChunk(processedChunk, fileUri.fsPath, fileHash);
                totalChunks++;
              }

              outputChannel.appendLine(`Processed ${fileUri.fsPath} (${rawChunks.length} chunks)`);

            } catch (err) {
              outputChannel.appendLine(`Error processing ${fileUri.fsPath}: ${err}`);
            }
          }

          vscode.window.showInformationMessage(`Workspace parsing complete. Processed ${totalChunks} chunks from ${processedFiles} files.`);
          cache?.close();
        });
      }
    );

    /** -------------------- kodelens.findReferences -------------------- */
    const findReferencesDisposable = vscode.commands.registerCommand(
      "kodelens.findReferences",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return vscode.window.showErrorMessage("No active editor found."); }

        const selection = editor.selection;
        const wordRange = editor.document.getWordRangeAtPosition(selection.start);
        if (!wordRange) { return vscode.window.showErrorMessage("Place cursor on a symbol to find references."); }

        const symbolName = editor.document.getText(wordRange);

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Finding references for: ${symbolName}`,
          cancellable: false
        }, async (progress) => {
          progress.report({ increment: 0 });
          await codeIndexer.buildIndex();
          progress.report({ increment: 50 });

          const references = codeIndexer.findReferences(symbolName);
          resultsProvider.refresh(references);

          if (references.length > 0) {
            const firstResultItem = new ResultItem(references[0]);
            resultsTreeView.reveal(firstResultItem, { focus: true, select: false });
          }

          vscode.window.showInformationMessage(
            references.length === 0 ? `No references found for: ${symbolName}` : `Found ${references.length} references for: ${symbolName}`
          );
          progress.report({ increment: 100 });
        });
      }
    );

    // Register all commands
    context.subscriptions.push(parseCommand, askCommand, parseWorkspaceCommand, findReferencesDisposable, outputChannel);
    outputChannel.appendLine("=== Kodelens Ready ===");

  } catch (err) {
    outputChannel.appendLine(`Initialization failed: ${err}`);
    vscode.window.showErrorMessage(`Kodelens initialization failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function deactivate() {
  console.log("Kodelens deactivated");
}

