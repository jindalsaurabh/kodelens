// src/commands/explainCodeCommand.ts
// In src/commands/explainCodeCommand.ts - COMPLETE REPLACEMENT

import * as vscode from 'vscode';
import { LocalCache } from '../database';
import { HybridEmbeddingService } from '../services/HybridEmbeddingService';
import { generateCodeExplanation } from '../utils/codeExplainer';
import { ExplanationPanel } from '../webview/explanationPanel';

/**
 * Register the explain code command with VS Code
 */
export function registerExplainCodeCommand(
    context: vscode.ExtensionContext,
    cache: LocalCache,
    embeddingService: HybridEmbeddingService
): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    // Command for explaining pre-provided code (from search results)
    
    // DEBUG VERSION - to see what's happening
const explainCodeDisposable = vscode.commands.registerCommand('kodelens.explainCode', async (code?: any) => {
    console.log('🔍 [ExplainCode] Received parameter:', { 
        type: typeof code, 
        isString: typeof code === 'string',
        isObject: typeof code === 'object',
        value: code
    });
    
    let codeString: string;
    
    if (typeof code === 'string') {
        codeString = code;
        console.log('✅ [ExplainCode] Using string directly');
    } else if (code && typeof code === 'object') {
        console.log('🔍 [ExplainCode] Object properties:', Object.keys(code));
        
        // Try all possible code properties
        codeString = code.text || code.code || code.snippet || code.content || code.value || code.data;
        
        if (codeString) {
            console.log('✅ [ExplainCode] Found code in property:', codeString.substring(0, 50) + '...');
        } else {
            console.log('❌ [ExplainCode] No code found in object properties');
            // Fallback to selection
            await explainSelectedCode(context, cache, embeddingService);
            return;
        }
    } else {
        console.log('🔍 [ExplainCode] No code provided, using selection');
        await explainSelectedCode(context, cache, embeddingService);
        return;
    }

    if (codeString && codeString.trim().length > 0) {
        console.log('🚀 [ExplainCode] Generating explanation for code length:', codeString.length);
        await showExplanationWithProgress(context, codeString.trim(), cache, embeddingService);
    } else {
        vscode.window.showWarningMessage('No code provided to explain.');
    }
});

    // Command for command palette with custom input
    const explainCustomDisposable = vscode.commands.registerCommand('kodelens.explainCodeFromText', async () => {
        await explainCustomCode(context, cache, embeddingService);
    });

    disposables.push(explainCodeDisposable, explainCustomDisposable);
    return disposables;
}


/**
 * Explain code selected in the active editor
 */
async function explainSelectedCode(
    context: vscode.ExtensionContext,
    cache: LocalCache,
    embeddingService: HybridEmbeddingService
): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        // If no active editor, ask for code input
        const code = await vscode.window.showInputBox({
            prompt: 'Enter Apex code to explain',
            placeHolder: 'Paste Apex code here...',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Please enter some Apex code to explain.';
                }
                if (value.trim().length < 10) {
                    return 'Please enter a meaningful code snippet (at least 10 characters).';
                }
                return null;
            }
        });

        if (code) {
            await showExplanationWithProgress(context, code.trim(), cache, embeddingService);
        }
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    
    if (!selectedText.trim()) {
        vscode.window.showWarningMessage('Please select some Apex code to explain.');
        return;
    }

    await showExplanationWithProgress(context, selectedText, cache, embeddingService, editor.document.fileName);
}

/**
 * Explain custom code from user input
 */
async function explainCustomCode(
    context: vscode.ExtensionContext,
    cache: LocalCache,
    embeddingService: HybridEmbeddingService
): Promise<void> {
    const input = await vscode.window.showInputBox({
        prompt: 'Enter Apex code to explain',
        placeHolder: 'Paste Apex code or describe what you want explained...',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Please enter some Apex code to explain.';
            }
            if (value.trim().length < 10) {
                return 'Please enter a meaningful code snippet (at least 10 characters).';
            }
            return null;
        }
    });

    if (input) {
        await showExplanationWithProgress(context, input.trim(), cache, embeddingService);
    }
}

/**
 * Show explanation with progress indicator
 */
async function showExplanationWithProgress(
    context: vscode.ExtensionContext,
    code: string,
    cache: LocalCache,
    embeddingService: HybridEmbeddingService,
    fileName?: string
): Promise<void> {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Kodelens: Analyzing code...",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: "Parsing code structure..." });
            
            // Generate the explanation
            const explanation = await generateCodeExplanation(code, cache, embeddingService, fileName);
            
            progress.report({ message: "Preparing explanation..." });
            
            // Show in webview panel
            ExplanationPanel.createOrShow(context, explanation, code);
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('[ExplainCode] Error generating explanation:', error);
        vscode.window.showErrorMessage(`Failed to generate code explanation: ${errorMessage}`);
    }
}