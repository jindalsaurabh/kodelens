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
  const extractor = new ApexChunkExtractor(apexAdapter);
  // Config
  const config = vscode.workspace.getConfiguration("kodelens");
  const modelChoice = config.get<string>("embeddingModel", "rust");
  outputChannel.appendLine(`[Embedding] Using model: ${modelChoice}`);
  const extensionRoot = context.extensionPath; // this is the absolute path to your extension
  const modelsBasePath = path.join(extensionRoot, "dist", "models"); // or just extensionRoot if HybridEmbeddingService appends .cache/models
  
  /*
  // Embedding service
  let embeddingService;
  if (modelChoice === "rust") {
    embeddingService = new HybridEmbeddingService(extensionRoot);
  } else {
    embeddingService = new HybridEmbeddingService(extensionRoot);
  }

  if (embeddingService.init) {
  await embeddingService.init();
}
*/
// Initialize HybridEmbeddingService with packaged model
//const embeddingService = new HybridEmbeddingService(extensionRoot);
//await embeddingService.init();
const embeddingService = new HybridEmbeddingService(context);
await embeddingService.init();

outputChannel.appendLine(`[Embedding] Initialized HybridEmbeddingService with bundled model`);

  outputChannel.appendLine(`[Embedding] Initialized model: ${modelChoice}`);

  // Results provider
  resultsProvider = new ResultsProvider();
  vscode.window.createTreeView("kodelens-results", { treeDataProvider: resultsProvider, showCollapseAll: true });

  // Indexers

  codeIndexer = new CodeIndexer(workspaceRoot, context, cache, apexAdapter, embeddingService);
/*
  semanticIndexer = new SemanticCodeIndexer(cache, apexAdapter, modelsBasePath);
  await semanticIndexer.init();
*/  
  // after creating embeddingService

semanticIndexer = new SemanticCodeIndexer(cache, apexAdapter, extractor, embeddingService, true);


  // Parser
  await initParserForWorkspace(workspaceRoot, context);

  // Commands
  registerParseApexCommand(context, outputChannel, cache, workspaceRoot);
  registerAskQuestionCommand(context, outputChannel, cache, resultsProvider);
  registerParseWorkspaceCommand(context, outputChannel, cache, semanticIndexer, workspaceRoot, apexAdapter);
  registerFindReferencesCommand(context, outputChannel, cache, codeIndexer, resultsProvider);

  // Add to your activate function
vscode.commands.registerCommand("kodelens.testRustEmbedding", async () => {
    const texts = [
        "public class AccountService { }",
        "public void calculateRevenue() { }", 
        "trigger AccountTrigger on Account (before insert) { }"
    ];
    
    try {
        outputChannel.appendLine("🧪 Testing Rust embedding service...");
        const embeddings = await embeddingService.generateEmbeddings(texts);
        outputChannel.appendLine(`✅ Generated ${embeddings.length} embeddings`);
        outputChannel.appendLine(`📊 Each embedding has ${embeddings[0].length} dimensions`);
        
        // Show first few values for verification
        const firstEmbedding = Array.from(embeddings[0]).slice(0, 5);
        outputChannel.appendLine(`🔢 Sample values: [${firstEmbedding.join(', ')}]`);
        
        vscode.window.showInformationMessage(
            `✅ Rust embedding test: Generated ${embeddings.length} embeddings`
        );
    } catch (error) {
        outputChannel.appendLine(`❌ Rust embedding test failed: ${error}`);
        vscode.window.showErrorMessage(`Rust embedding test failed: ${error}`);
    }
});

  context.subscriptions.push(outputChannel);
}

export function deactivate() {
  cache?.close();
}