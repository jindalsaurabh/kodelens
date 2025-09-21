import * as vscode from "vscode";
import { LocalCache } from "./database";
import { SemanticCodeIndexer } from "./SemanticCodeIndexer";
import { createEmbeddingService } from "./services/embeddingFactory";
import { ApexAdapter } from "./adapters/ApexAdapter";
import { CodeIndexer } from "./CodeIndexer";
import { ResultsProvider } from "./ResultsProvider";
import { initParserForWorkspace } from "./services/parserService";

import { registerParseApexCommand } from "./commands/parseApexCommand";
import { registerAskQuestionCommand } from "./commands/askQuestionCommand";
import { registerParseWorkspaceCommand } from "./commands/parseWorkspaceCommand";
import { registerFindReferencesCommand } from "./commands/findReferencesCommand";

let cache: LocalCache | undefined;
let codeIndexer: CodeIndexer | undefined;
let resultsProvider: ResultsProvider | undefined;
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

  // config
  const config = vscode.workspace.getConfiguration("kodelens");
  const embeddingModel = config.get<string>("embeddingModel") || "mock";
  const openAiApiKey = config.get<string>("openAiApiKey");
  const googleApiKey = config.get<string>("googleApiKey");
  const apiKey = embeddingModel === "openai" ? openAiApiKey : googleApiKey;

  // single cache instance (globalStorage)
  const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
  outputChannel.appendLine(`Using DB Path: ${dbPath}`);
  cache = new LocalCache(dbPath);
  cache.init();

  // embedding service, indexer, results provider
  const embeddingService = await createEmbeddingService(embeddingModel, apiKey);
  resultsProvider = new ResultsProvider();
  const indexer = new SemanticCodeIndexer(workspaceRoot, context, cache, embeddingModel);
  const apexAdapter = new ApexAdapter(context);
  codeIndexer = new CodeIndexer(workspaceRoot, context, cache, apexAdapter, embeddingService);

  // initialize parser
  try {
    await initParserForWorkspace(workspaceRoot, context);
    outputChannel.appendLine("✓ Parser initialized successfully");
  } catch (err) {
    outputChannel.appendLine(`FATAL: Parser init failed. Error: ${err}`);
    return;
  }

  // register commands (pass shared cache + other deps)
  registerParseApexCommand(context, outputChannel, cache, workspaceRoot);
  registerAskQuestionCommand(context, outputChannel, cache, resultsProvider);
  registerParseWorkspaceCommand(context, outputChannel, cache, workspaceRoot);
  registerFindReferencesCommand(context, outputChannel, cache, codeIndexer, resultsProvider);

  context.subscriptions.push(outputChannel);
}

export function deactivate() {
  try { cache?.close(); } catch {}
}
