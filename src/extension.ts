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
import { HybridEmbeddingService } from "./services/HybridEmbeddingService";
import { ApexChunkExtractor } from "./extractors/ApexChunkExtractor";
import { ProgressTracker } from './utils/ProgressTracker';

let cache: LocalCache;
let codeIndexer: CodeIndexer;
let semanticIndexer: SemanticCodeIndexer;
let resultsProvider: ResultsProvider;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Kodelens-Debug");
  outputChannel.show(true);
  outputChannel.appendLine("== Kodelens MVP Initialization123 ==");

// In your extension.ts activate function
    const progressTracker = new ProgressTracker(context);
    const incompleteProgress = await progressTracker.loadProgress();
    
    if (incompleteProgress && incompleteProgress.status === 'paused') {
        setTimeout(() => { // Wait a bit for VS Code to fully load
            vscode.window.showInformationMessage(
                `Kodelens: Previous indexing was interrupted (${incompleteProgress.processedFiles.length}/${incompleteProgress.totalFiles} files). Would you like to resume?`,
                'Resume Now', 'Resume Later', 'Cancel'
            ).then(choice => {
                if (choice === 'Resume Now') {
                    vscode.commands.executeCommand('kodelens.parseWorkspace');
                }
            });
        }, 3000);
    }
  
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {return;}

  // Cache
  const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
  cache = new LocalCache(dbPath);
  await cache.init();
  // Apex Adapter
  const apexAdapter = new ApexAdapter(context);
  await apexAdapter.init();
  const extractor = new ApexChunkExtractor(apexAdapter);
  // Config
  const config = vscode.workspace.getConfiguration("kodelens");
  const modelChoice = config.get<string>("embeddingModel", "rust");
  outputChannel.appendLine(`[Embedding] Using model: ${modelChoice}`);
  const extensionRoot = context.extensionPath; // this is the absolute path to your extension
  const modelsBasePath = path.join(extensionRoot, "dist", "models"); // or just extensionRoot if HybridEmbeddingService appends .cache/models

  const embeddingService = new HybridEmbeddingService(context);
  await embeddingService.init();
  outputChannel.appendLine(`[Embedding] Initialized model: ${modelChoice}`);

  // Results provider
  resultsProvider = new ResultsProvider();
  vscode.window.createTreeView("kodelens-results", { treeDataProvider: resultsProvider, showCollapseAll: true });

  // Indexers
  codeIndexer = new CodeIndexer(workspaceRoot, context, cache, apexAdapter, embeddingService);
  // after creating embeddingService
  semanticIndexer = new SemanticCodeIndexer(cache, apexAdapter, extractor, embeddingService, true);

  // Parser
  await initParserForWorkspace(workspaceRoot, context);

  // Commands
  registerParseApexCommand(context, outputChannel, cache, workspaceRoot);
  registerAskQuestionCommand(context, outputChannel, cache, resultsProvider, embeddingService);
  registerParseWorkspaceCommand(context, outputChannel, cache, semanticIndexer, workspaceRoot, apexAdapter);
  registerFindReferencesCommand(context, outputChannel, cache, codeIndexer, resultsProvider, embeddingService);
  context.subscriptions.push(outputChannel);
}

export function deactivate() {
  cache?.close();
}
