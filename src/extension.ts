// src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { initializeParser } from './parser';
import { LocalCache } from './database';
import { extractChunksFromAst, normalizeText, generateHash } from './chunking';

export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Kodelens-Debug');
    outputChannel.show(true);

    outputChannel.appendLine('=== Kodelens Initialization ===');
    outputChannel.appendLine(`Extension installed at: ${context.extensionPath}`);

    try {
        // Initialize parser
        const parser = await initializeParser(context.extensionPath);
        outputChannel.appendLine('✓ Parser initialized successfully');

        // Register command
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
                // Ensure the storage directory exists
                const storageUri = context.globalStorageUri;
                await vscode.workspace.fs.createDirectory(storageUri);
                const dbPath = vscode.Uri.joinPath(storageUri, 'kodelens-cache.sqlite').fsPath;
                // Now we assign the initialized object to the outer variable
                cache = new LocalCache(dbPath);
                await cache.init(); // Initialize the database schema
                
                // 4. Generate a hash of the entire file for cache invalidation
                const fileHash = crypto.createHash('sha256').update(sourceCode).digest('hex');

                let cachedChunkCount = 0;
                let newChunkCount = 0;

                // 5. Process each chunk: normalize, hash, and cache
                for (const rawChunk of rawChunks) {
                    const normalizedText = normalizeText(rawChunk.text);
                    const chunkHash = generateHash(normalizedText);

                    // Create a processed chunk object for the cache
                    const processedChunk = {
                        ...rawChunk,
                        hash: chunkHash,
                        text: normalizedText
                    };

                    // Insert into cache. insertChunk returns true if inserted, false if it already existed.
                    const wasInserted = await cache.insertChunk(processedChunk, filePath, fileHash);
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
            } finally{
                    if (cache) {
                cache.close(); // Ensure the database is always closed
            }}
        });

        context.subscriptions.push(parseCommand, outputChannel);
        outputChannel.appendLine('=== Kodelens Ready ===');

    } catch (error) {
        outputChannel.appendLine(`✗ Initialization failed: ${error}`);
        vscode.window.showErrorMessage(`Kodelens initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function deactivate() {
    console.log('Kodelens deactivated');
}