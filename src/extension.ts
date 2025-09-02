// src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { initializeParser } from './parser';
import { LocalCache } from './database';
import { extractChunksFromAst, normalizeText, generateHash } from './chunking';
// Import the new retrieval function
import { findRelevantChunks } from './retrieval';

export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Kodelens-Debug');
    outputChannel.show(true);

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

        // Add both commands to subscriptions
        context.subscriptions.push(parseCommand, askCommand, outputChannel);
        outputChannel.appendLine('=== Kodelens Ready ===');

    } catch (error) {
        outputChannel.appendLine(`✗ Initialization failed: ${error}`);
        vscode.window.showErrorMessage(`Kodelens initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function deactivate() {
    console.log('Kodelens deactivated');
}