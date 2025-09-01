// src/extension.ts (updated)
import * as vscode from 'vscode';
import { initializeParser } from './parser'; // Import the new function

export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Kodelens-Debug');
    outputChannel.show(true);
    outputChannel.appendLine(`Extension Path: ${context.extensionPath}`);

    try {
        // Use the new function to get a parser
        const parser = await initializeParser(context.extensionPath);
        outputChannel.appendLine(`VSCode context.extensionPath: ${context.extensionPath}`);
        outputChannel.appendLine('✓ Parser initialized successfully');

        // ... rest of your command registration code remains the same ...
        // const parseCommand = vscode.commands.registerCommand('kodelens.parseApex', () => { ... });

    } catch (error) {
        outputChannel.appendLine(`ERROR: ${error}`);
        vscode.window.showErrorMessage(`Kodelens failed: ${error}`);
    }
}