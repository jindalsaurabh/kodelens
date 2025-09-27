//src/extension.ts
import * as vscode from "vscode";
import path from "path";
import { LocalCache } from "./database";
import { SemanticCodeIndexer } from "./SemanticCodeIndexer";
import { ApexAdapter } from "./adapters/ApexAdapter";
import { CodeIndexer } from "./CodeIndexer";
import { ResultsProvider } from "./ResultsProvider";
import { initParserForWorkspace } from "./services/parserService";
import { registerParseApexCommand } from "./commands/parseApexCommand";
import { registerAskQuestionCommand } from "./commands/askQuestionCommand";
import { registerParseWorkspaceCommand } from "./commands/parseWorkspaceCommand";
import { registerFindReferencesCommand } from "./commands/findReferencesCommand";
//import { MockEmbeddingService } from "./services/embeddings";
//import { RustBinaryEmbeddingService } from "./services/RustBinaryEmbeddingService";
import { HybridEmbeddingService } from "./services/HybridEmbeddingService";

let cache: LocalCache;
let codeIndexer: CodeIndexer;
let semanticIndexer: SemanticCodeIndexer;
let resultsProvider: ResultsProvider;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Kodelens-Debug");
  outputChannel.show(true);
  outputChannel.appendLine("== Kodelens MVP Initialization ==");

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {return;}

  // Cache
  const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
  cache = new LocalCache(dbPath);
  await cache.init();

  // Apex Adapter
  const apexAdapter = new ApexAdapter(context);
  await apexAdapter.init();

  // Config
  const config = vscode.workspace.getConfiguration("kodelens");
  const modelChoice = config.get<string>("embeddingModel", "rust");
  outputChannel.appendLine(`[Embedding] Using model: ${modelChoice}`);
  const extensionRoot = context.extensionPath; // this is the absolute path to your extension
  const modelsBasePath = path.join(extensionRoot, "dist", "models"); // or just extensionRoot if HybridEmbeddingService appends .cache/models
  
  // Embedding service
  let embeddingService;
  if (modelChoice === "rust") {
    embeddingService = new HybridEmbeddingService(extensionRoot);
  } else {
    embeddingService = new HybridEmbeddingService(extensionRoot);
  }

  await embeddingService.init?.();
  outputChannel.appendLine(`[Embedding] Initialized model: ${modelChoice}`);

  // Results provider
  resultsProvider = new ResultsProvider();
  vscode.window.createTreeView("kodelens-results", { treeDataProvider: resultsProvider, showCollapseAll: true });

  // Indexers

  codeIndexer = new CodeIndexer(workspaceRoot, context, cache, apexAdapter, embeddingService);
  semanticIndexer = new SemanticCodeIndexer(cache, apexAdapter, modelsBasePath);
  await semanticIndexer.init();

  // Parser
  await initParserForWorkspace(workspaceRoot, context);

  // Commands
  registerParseApexCommand(context, outputChannel, cache, workspaceRoot);
  registerAskQuestionCommand(context, outputChannel, cache, resultsProvider);
  registerParseWorkspaceCommand(context, outputChannel, cache, semanticIndexer, workspaceRoot, apexAdapter);
  registerFindReferencesCommand(context, outputChannel, cache, codeIndexer, resultsProvider);

  // Expose test command
  vscode.commands.registerCommand("kodelens.testWebviewEmbedding", async () => {
    const text = "public class InvoiceProcessor { void processPayment() {} }";
    const embedding = await embeddingService.generateEmbedding(text);
    console.log("Embedding length:", embedding.length);
    console.log("First 10 dims:", Array.from(embedding).slice(0, 10));
    vscode.window.showInformationMessage("Embedding test complete. Check console.");
  });

  context.subscriptions.push(outputChannel);
}

export function deactivate() {
  cache?.close();
}
