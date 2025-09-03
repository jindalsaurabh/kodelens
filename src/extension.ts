// src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { initializeParser } from './parser';
import { LocalCache } from './database';
import { extractChunksFromAst, normalizeText, generateHash } from './chunking';
import { findRelevantChunks } from './retrieval';
import { CodeIndexer } from './CodeIndexer';
import { ResultsProvider, ResultItem } from './ResultsProvider'; // Fixed import



let codeIndexer: CodeIndexer;
let resultsProvider: ResultsProvider;
let resultsTreeView: vscode.TreeView<ResultItem>;

export async function activate(context: vscode.ExtensionContext) {
    
    const outputChannel = vscode.window.createOutputChannel('Kodelens-Debug');
    outputChannel.show(true);

    // Initialize the indexer and parser
    codeIndexer = new CodeIndexer();
    
    // Initialize the results provider
    resultsProvider = new ResultsProvider();
    
    // Create the tree view
    resultsTreeView = vscode.window.createTreeView('kodelens-results', {
        treeDataProvider: resultsProvider,
        showCollapseAll: true
    });

    // Initialize the parser with the extension path
    codeIndexer.initialize(context.extensionPath).then(() => {
        console.log('Parser initialized successfully');
    }).catch(error => {
        vscode.window.showErrorMessage(`Failed to initialize parser: ${error}`);
    });

    outputChannel.appendLine('=== Kodelens Initialization ===');
    outputChannel.appendLine(`Extension installed at: ${context.extensionPath}`);

    try {
        // Initialize parser
        const parser = await initializeParser(context.extensionPath);
        outputChannel.appendLine('✓ Parser initialized successfully');

        // Register PARSE command
        const parseCommand = vscode.commands.registerCommand('kodelens.parseApex', async () => {
            outputChannel.appendLine('Command invoked: kodelens.parseApex');

            const editor = vscode.window.activeTextEditor;
            if (!editor || !(/\.(cls|trigger)$/i).test(editor.document.fileName)) {
                vscode.window.showWarningMessage('Please open an Apex (.cls or .trigger) file to use this command');
                return;
            }

            let cache: LocalCache | undefined;

            try {
                const filePath = editor.document.fileName;
                const sourceCode = editor.document.getText();
                outputChannel.appendLine(`Parsing and chunking file: ${filePath}`);

                // 1. Parse the file to get AST
                const tree = parser.parse(sourceCode);
                if (!tree) {
                    throw new Error('Failed to parse code: returned null tree');
                }
                outputChannel.appendLine('✓ Parse successful');

                // 2. Extract chunks from the AST
                const rawChunks = extractChunksFromAst(tree.rootNode, sourceCode);
                outputChannel.appendLine(`Found ${rawChunks.length} raw chunks in AST`);

                // 3. Initialize the local cache
                const storageUri = context.globalStorageUri;
                await vscode.workspace.fs.createDirectory(storageUri);
                const dbPath = vscode.Uri.joinPath(storageUri, 'kodelens-cache.sqlite').fsPath;
                
                outputChannel.appendLine(`Database path: ${dbPath}`);
                
                const fileExists = require('fs').existsSync(dbPath);
                outputChannel.appendLine(`Database file exists before init: ${fileExists}`);
                cache = new LocalCache(dbPath);
                await cache.init();

                const fileExistsAfterInit = require('fs').existsSync(dbPath);
                outputChannel.appendLine(`Database file exists after init: ${fileExistsAfterInit}`);

                await cache.init().catch(err => {
                     outputChannel.appendLine(`Cache init failed: ${err}`);
                throw err;
                });

                // 4. Generate a hash of the entire file for cache invalidation
                const fileHash = crypto.createHash('sha256').update(sourceCode).digest('hex');

                let cachedChunkCount = 0;
                let newChunkCount = 0;

                // 5. Process each chunk: normalize, hash, and cache
                for (const rawChunk of rawChunks) {
                    const normalizedText = normalizeText(rawChunk.text);
                    const chunkHash = generateHash(normalizedText);

                    const processedChunk = {
                        ...rawChunk,
                        hash: chunkHash,
                        text: normalizedText
                    };

                    //const wasInserted = await cache.insertChunk(processedChunk, filePath, fileHash);
                    const wasInserted = await cache.insertChunk(processedChunk, filePath, fileHash).catch(err => {
                         outputChannel.appendLine(`Insert failed for chunk ${chunkHash}: ${err}`);
                            return false;
                    });
                    if (wasInserted) {
                        newChunkCount++;
                    } else {
                        cachedChunkCount++;
                    }
                }

                // 6. Report results to the user
                const message = `Processed ${rawChunks.length} chunks. ${newChunkCount} new, ${cachedChunkCount} already cached.`;
                outputChannel.appendLine(message);
                vscode.window.showInformationMessage(message);

            } catch (error) {
                outputChannel.appendLine(`Error: ${error}`);
                vscode.window.showErrorMessage(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                if (cache) {
                    cache.close();
                }
            }
        });

        // Register ASK command
        const askCommand = vscode.commands.registerCommand('kodelens.askQuestion', async () => {
            outputChannel.appendLine('Command invoked: kodelens.askQuestion');

            // 1. Get the user's question from an input box
            const userQuestion = await vscode.window.showInputBox({
                prompt: 'Ask a question about your codebase',
                placeHolder: 'e.g., How do I create a new customer?'
            });

            // If user cancels the input box, exit
            if (userQuestion === undefined) {
                outputChannel.appendLine('User cancelled the question input.');
                return;
            }

            // If user submits an empty question, show a warning
            if (!userQuestion.trim()) {
                vscode.window.showWarningMessage('Please enter a question.');
                return;
            }

            outputChannel.appendLine(`User asked: "${userQuestion}"`);

            let cache: LocalCache | undefined;

            try {
                // 2. Initialize the cache (using the same database)
                const storageUri = context.globalStorageUri;
                const dbPath = vscode.Uri.joinPath(storageUri, 'kodelens-cache.sqlite').fsPath;
                cache = new LocalCache(dbPath);
                // Note: We don't need to call init() here if we're only querying
                // and we're sure the schema already exists from parsing.

                // 3. Find relevant chunks using our retrieval system
                outputChannel.appendLine('Searching for relevant code chunks...');
                const relevantChunks = await findRelevantChunks(userQuestion, cache);
                outputChannel.appendLine(`Found ${relevantChunks.length} relevant chunks.`);

                // 4. Display the results to the user
                if (relevantChunks.length > 0) {
                    // For MVP: show the top result in a message
                    const topChunk = relevantChunks[0];
                    // Show a preview of the code (first 100 chars)
                    //const preview = topChunk.chunk_text.substring(0, 100) + (topChunk.chunk_text.length > 100 ? '...' : '');
                    const preview = topChunk.text.substring(0, 100) + (topChunk.text.length > 100 ? '...' : '');
                    vscode.window.showInformationMessage(`Top result: ${preview}`);
                    
                    // Also log the full result to the output channel for debugging
                    outputChannel.appendLine(`Top chunk: ${topChunk.text}`);
                    outputChannel.show(true);
                } else {
                    vscode.window.showInformationMessage('No relevant code found for your question.');
                }

            } catch (error) {
                outputChannel.appendLine(`Error during question answering: ${error}`);
                vscode.window.showErrorMessage(`Failed to answer question: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                if (cache) {
                    cache.close();
                }
            }
        });

        // Register the parseWorkspaceCommand command

const parseWorkspaceCommand = vscode.commands.registerCommand('kodelens.parseWorkspace', async () => {
    outputChannel.appendLine('Command invoked: kodelens.parseWorkspace');
    
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showWarningMessage('Please open a workspace folder first.');
        return;
    }

    // 1. Get the database path (same as parse command)
    const storageUri = context.globalStorageUri;
    await vscode.workspace.fs.createDirectory(storageUri);
    const dbPath = vscode.Uri.joinPath(storageUri, 'kodelens-cache.sqlite').fsPath;

    let cache: LocalCache | undefined;
    
    // 2. Add progress reporting
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Kodelens: Parsing workspace Apex files...",
        cancellable: true
    }, async (progress, token) => {
        token.onCancellationRequested(() => {
            outputChannel.appendLine("User cancelled workspace parsing.");
        });

        cache = new LocalCache(dbPath);
        await cache.init();

        try {
            // Find all Apex files in the workspace
            const apexFiles = await vscode.workspace.findFiles(
                '**/*.{cls,trigger}', // Glob pattern for Apex files
                '**/node_modules/**'   // Exclude node_modules
            );

            outputChannel.appendLine(`Found ${apexFiles.length} Apex files in workspace.`);
            progress.report({ message: `Found ${apexFiles.length} files to process...` });

            let totalChunks = 0;
            let processedFiles = 0;

            // Process each file
            for (const fileUri of apexFiles) {
                // Check if user cancelled
                if (token.isCancellationRequested) {
                    break;
                }

                try {
                    processedFiles++;
                    progress.report({ 
                        message: `Processing file ${processedFiles}/${apexFiles.length}`,
                        increment: (1 / apexFiles.length) * 100 
                    });

                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const sourceCode = document.getText();
                    const fileHash = crypto.createHash('sha256').update(sourceCode).digest('hex');
                    
                    // Parse and chunk
                    const tree = parser.parse(sourceCode);
                    if (!tree) {
                        outputChannel.appendLine(`Failed to parse: ${fileUri.fsPath}`);
                        continue;
                    }
                    
                    const rawChunks = extractChunksFromAst(tree.rootNode, sourceCode);
                    
                    // Store chunks
                    for (const rawChunk of rawChunks) {
                        const normalizedText = normalizeText(rawChunk.text);
                        const chunkHash = generateHash(normalizedText);
                        const processedChunk = {
                            ...rawChunk,
                            hash: chunkHash,
                            text: normalizedText
                        };
                        await cache.insertChunk(processedChunk, fileUri.fsPath, fileHash);
                        totalChunks++;
                    }
                    
                    outputChannel.appendLine(`Processed ${fileUri.fsPath} (${rawChunks.length} chunks)`);
                    
                } catch (error) {
                    outputChannel.appendLine(`Error processing ${fileUri.fsPath}: ${error}`);
                }
            }

            vscode.window.showInformationMessage(`Workspace parsing complete. Processed ${totalChunks} chunks from ${processedFiles} files.`);
            
        } catch (error) {
            outputChannel.appendLine(`Workspace parsing failed: ${error}`);
            vscode.window.showErrorMessage(`Workspace parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            if (cache) {
                cache.close();
            }
        }
    });
});


// Register the findReferences command

  const findReferencesDisposable = vscode.commands.registerCommand('kodelens.findReferences', async () => {
    // New logic will go here.
    vscode.window.showInformationMessage('Find All References command triggered!');

// Get the active text editor

        if (!codeIndexer) {
            vscode.window.showErrorMessage('Code indexer not ready yet. Please try again.');
            return;
        }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found!');
      return;
    }

    // Get the user's selection (the word they want to find references for)
    const selection = editor.selection;
    const wordRange = editor.document.getWordRangeAtPosition(selection.start);
    if (!wordRange) {
      vscode.window.showErrorMessage('Please place your cursor on a word to find its references.');
      return;
    }

    // Get the exact word/symbol from the document
    const symbolName = editor.document.getText(wordRange);

    // Show progress
    vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Finding references for: ${symbolName}`,
    cancellable: false 
    }, async (progress) => {
    progress.report({ increment: 0 });

    // First, build the index if needed
    await codeIndexer.buildIndex();
    
    progress.report({ increment: 50 });

    const stats = codeIndexer.getIndexStats();
    console.log('Indexing complete');
    console.log('Index stats:', stats);

    // Then find references
    const references = codeIndexer.findReferences(symbolName);
    progress.report({ increment: 100 });
        
    // Update the results view
    resultsProvider.refresh(references);        
    // Show the results view
    //resultsTreeView.reveal(references[0], { focus: true, select: false });

    // Show the results view - Convert CodeSymbol to ResultItem first
    if (references.length > 0) {
        const firstResultItem = new ResultItem(references[0]);
        resultsTreeView.reveal(firstResultItem, { focus: true, select: false });
    }

    if (references.length === 0) {
        vscode.window.showInformationMessage(`No references found for: ${symbolName}`);
    } else {
        vscode.window.showInformationMessage(`Found ${references.length} references for: ${symbolName}`);

    // TODO: Show the results in a panel (next step)
    console.log('References found:', references);
    }

    // Show a message with the symbol we're going to search for
    vscode.window.showInformationMessage(`Finding references for: ${symbolName}`);

    // TODO: Phase 1 - Build the code index for the entire workspace
    // This will be our next major task
    const files = await vscode.workspace.findFiles('**/*.cls', '**/node_modules/**');
    vscode.window.showInformationMessage(`Found ${files.length} Apex files to index.`);

    // TODO: Phase 2 - Parse each file with tree-sitter and find references to ${symbolName}
    // This will be our core logic

    // TODO: Phase 3 - Display the results in a panel
    // This will be our UI work

});

  });

        // Add the commands to subscriptions
        context.subscriptions.push(parseCommand, askCommand, parseWorkspaceCommand, findReferencesDisposable, outputChannel);
        outputChannel.appendLine('=== Kodelens Ready ===');

    } catch (error) {
        outputChannel.appendLine(`✗ Initialization failed: ${error}`);
        vscode.window.showErrorMessage(`Kodelens initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function deactivate() {
    console.log('Kodelens deactivated');
}