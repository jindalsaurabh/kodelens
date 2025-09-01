// src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { initializeParser } from './parser';

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
        const parseCommand = vscode.commands.registerCommand('kodelens.parseApex', () => {
            outputChannel.appendLine('Command invoked: kodelens.parseApex');

            const editor = vscode.window.activeTextEditor;
            if (!editor || !(/\.(cls|trigger)$/i).test(editor.document.fileName)) {
                vscode.window.showWarningMessage('Please open an Apex (.cls or .trigger) file to use this command');
                return;
            }

            try {
                const sourceCode = editor.document.getText();
                const tree = parser.parse(sourceCode);

                outputChannel.appendLine('✓ Parse successful');
                outputChannel.appendLine(`=== AST for ${path.basename(editor.document.fileName)} ===`);
                outputChannel.appendLine(tree.rootNode.toString());
                outputChannel.show(true);
            } catch (err) {
                outputChannel.appendLine(`✗ Parse failed: ${err}`);
                vscode.window.showErrorMessage(`Parse failed: ${err instanceof Error ? err.message : String(err)}`);
            }
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
