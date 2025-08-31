import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Minimal type definitions for web-tree-sitter
interface TreeSitterLanguage {
    // Language instance methods would go here
}

interface TreeSitterParser {
    setLanguage(language: TreeSitterLanguage): void;
    parse(code: string): TreeSitterTree;
}

interface TreeSitterTree {
    rootNode: TreeSitterNode;
}

interface TreeSitterNode {
    type: string;
    toString(): string;
}

interface TreeSitterModule {
    default: {
        init(options: { locateFile: (fileName: string) => string }): Promise<void>;
        new (): TreeSitterParser;
    };
    Language: {
        load(wasmPath: string): Promise<TreeSitterLanguage>;
    };
}

export async function activate(context: vscode.ExtensionContext) {
    try {
        // Load WASM files from extension distribution
        const runtimeWasmPath = context.asAbsolutePath(
            path.join('media', 'runtime', 'tree-sitter.wasm')
        );
        const apexWasmPath = context.asAbsolutePath(
            path.join('media', 'apex', 'tree-sitter-apex.wasm')
        );

        // Verify WASM files exist
        if (!fs.existsSync(runtimeWasmPath) || !fs.existsSync(apexWasmPath)) {
            throw new Error('WASM files not found. Rebuild extension with proper packaging.');
        }

        // Import web-tree-sitter with proper type casting
        const ParserModule = await import('web-tree-sitter') as unknown as TreeSitterModule;
        
        await ParserModule.default.init({ locateFile: () => runtimeWasmPath });
        
        // Load the Apex language
        const ApexLang = await ParserModule.Language.load(apexWasmPath);
        
        // Create parser instance
        const Parser = ParserModule.default;
        const parser = new Parser();
        parser.setLanguage(ApexLang);

        const outputChannel = vscode.window.createOutputChannel('Kodelens');
        
        const parseCommand = vscode.commands.registerCommand('kodelens.parseApex', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'apex') {
                vscode.window.showWarningMessage('Please open an Apex file to use this command');
                return;
            }

            const sourceCode = editor.document.getText();
            const tree = parser.parse(sourceCode);
            
            outputChannel.clear();
            outputChannel.appendLine(`=== AST Analysis for ${path.basename(editor.document.fileName)} ===`);
            outputChannel.appendLine(tree.rootNode.toString());
            outputChannel.show(true);
        });

        context.subscriptions.push(parseCommand, outputChannel);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Kodelens initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function deactivate() {}