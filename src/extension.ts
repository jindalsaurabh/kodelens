// src/extension.ts
import * as vscode from "vscode";
import { CodeIndexer } from "./CodeIndexer";
import { ResultsProvider, ResultItem } from "./ResultsProvider";
import { findRelevantChunks } from "./retrieval";
import { safeParse } from "./services/parserService";

let codeIndexer: CodeIndexer;
let resultsProvider: ResultsProvider;
let resultsTreeView: vscode.TreeView<ResultItem>;

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Kodelens-Debug");
  context.subscriptions.push(outputChannel);
  outputChannel.show(true);
  outputChannel.appendLine("=== Kodelens Initialization ===");

  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  if (!workspaceRoot) {
    outputChannel.appendLine("No workspace folder found. Kodelens will not activate.");
    vscode.window.showWarningMessage("Please open a folder or workspace for Kodelens to function.");
    return;
  }

  // 1️⃣ Initialize CodeIndexer
  codeIndexer = new CodeIndexer(workspaceRoot, context);

  // 2️⃣ Initialize ResultsProvider and TreeView
  resultsProvider = new ResultsProvider();
  resultsTreeView = vscode.window.createTreeView("kodelens-results", {
    treeDataProvider: resultsProvider,
    showCollapseAll: true,
  });

  // 3️⃣ Warm up parser once (optional, avoids lazy delay later)
  try {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      await safeParse(workspaceRoot, context, editor.document.getText());
    }
    outputChannel.appendLine("✓ Parser warmed up successfully");
  } catch (err) {
    outputChannel.appendLine(`Parser warmup failed: ${err}`);
  }

  // 4️⃣ Command: Parse single file
  const parseCommand = vscode.commands.registerCommand("kodelens.parseApex", async () => {
    outputChannel.appendLine("Command invoked: kodelens.parseApex");
    const editor = vscode.window.activeTextEditor;
    if (!editor || !/\.(cls|trigger)$/i.test(editor.document.fileName)) {
      vscode.window.showWarningMessage("Please open an Apex (.cls or .trigger) file");
      return;
    }

    try {
      const inserted = await codeIndexer.indexFile(editor.document.uri);
      vscode.window.showInformationMessage(`Indexed ${inserted} new chunks from ${editor.document.fileName}`);
    } catch (err) {
      outputChannel.appendLine(`Error indexing file: ${err}`);
      vscode.window.showErrorMessage(`Failed to parse file: ${err}`);
    }
  });

  // 5️⃣ Command: Parse workspace
  const parseWorkspaceCommand = vscode.commands.registerCommand("kodelens.parseWorkspace", async () => {
    outputChannel.appendLine("Command invoked: kodelens.parseWorkspace");
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showWarningMessage("Please open a workspace folder first.");
      return;
    }

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Kodelens: Parsing workspace...", cancellable: true },
      async (progress, token) => {
        try {
          const totalInserted = await codeIndexer.indexWorkspace(progress, token);
          vscode.window.showInformationMessage(`Workspace parsing complete. ${totalInserted} new chunks indexed.`);
        } catch (err) {
          outputChannel.appendLine(`Workspace parse failed: ${err}`);
          vscode.window.showErrorMessage(`Workspace parsing failed: ${err}`);
        }
      }
    );
  });

  // 6️⃣ Command: Ask question
  const askCommand = vscode.commands.registerCommand("kodelens.askQuestion", async () => {
    outputChannel.appendLine("Command invoked: kodelens.askQuestion");
    const userQuestion = await vscode.window.showInputBox({
      prompt: "Ask a question about your codebase",
      placeHolder: "e.g., How do I create a new customer?",
    });

    if (!userQuestion) {return;}

    try {
      const relevantChunks = await codeIndexer.searchByKeywords(userQuestion.split(/\s+/));
      outputChannel.appendLine(`Found ${relevantChunks.length} relevant chunks`);

      if (relevantChunks.length > 0) {
        const topChunk = relevantChunks[0];
        const preview = topChunk.text.substring(0, 100) + (topChunk.text.length > 100 ? "..." : "");
        vscode.window.showInformationMessage(`Top result: ${preview}`);
        resultsProvider.setResults(relevantChunks);
      } else {
        vscode.window.showInformationMessage("No relevant code found.");
      }
    } catch (err) {
      outputChannel.appendLine(`Error answering question: ${err}`);
      vscode.window.showErrorMessage(`Failed to answer question: ${err}`);
    }
  });

  // 7️⃣ Command: Find references
  const findReferencesCommand = vscode.commands.registerCommand("kodelens.findReferences", async () => {
    if (!codeIndexer) {
      vscode.window.showErrorMessage("Code indexer not ready yet.");
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor.");
      return;
    }

    const wordRange = editor.document.getWordRangeAtPosition(editor.selection.start);
    if (!wordRange) {
      vscode.window.showErrorMessage("Place cursor on a symbol to find references.");
      return;
    }

    const symbolName = editor.document.getText(wordRange);
    vscode.window.showInformationMessage(`Finding references for: ${symbolName}`);

    try {
      const results = await codeIndexer.searchByKeywords([symbolName]);
      resultsProvider.setResults(results);
      outputChannel.appendLine(`Found ${results.length} references for ${symbolName}`);
    } catch (err) {
      outputChannel.appendLine(`Error finding references: ${err}`);
      vscode.window.showErrorMessage(`Failed to find references: ${err}`);
    }
  });

  // Clear Results
const clearResultsDisposable = vscode.commands.registerCommand(
  "kodelens.clearResults",
  () => {
    resultsProvider.clear();
    vscode.window.showInformationMessage("Results cleared.");
  }
);

  // 8️⃣ Register commands
  context.subscriptions.push(
    parseCommand,
    parseWorkspaceCommand,
    askCommand,
    findReferencesCommand,
    clearResultsDisposable,
    resultsTreeView
  );

  outputChannel.appendLine("=== Kodelens Ready ===");
}

export function deactivate() {
  if (codeIndexer) {
    codeIndexer.dispose();
  }
  console.log("Kodelens deactivated");
}
