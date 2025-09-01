import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Kodelens-Debug');
    outputChannel.show(true);
    outputChannel.appendLine('=== Kodelens Debug Initialization ===');
    
    try {
        // Safe debug info inside activate function
        const webTreeSitterPkg = require('web-tree-sitter/package.json');
        outputChannel.appendLine(`web-tree-sitter version: ${webTreeSitterPkg.version}`);
        outputChannel.appendLine(`Node.js: ${process.version}, Platform: ${process.platform}/${process.arch}`);
        
    } catch (error) {
        outputChannel.appendLine(`Debug info unavailable: ${error}`);
    }

    try {
        outputChannel.appendLine('1. Getting extension paths...');
        const extensionMediaPath = path.join(context.extensionPath, 'media');
        const runtimeWasmPath = path.join(extensionMediaPath, 'runtime', 'tree-sitter.wasm');
        const apexWasmPath = path.join(extensionMediaPath, 'apex', 'tree-sitter-apex.wasm');

        outputChannel.appendLine(`Extension path: ${context.extensionPath}`);
        outputChannel.appendLine(`Runtime WASM path: ${runtimeWasmPath}`);
        outputChannel.appendLine(`Apex WASM path: ${apexWasmPath}`);

        // Verify WASM files exist
        outputChannel.appendLine('2. Checking WASM files...');
        const runtimeExists = fs.existsSync(runtimeWasmPath);
        const apexExists = fs.existsSync(apexWasmPath);
        
        outputChannel.appendLine(`Runtime WASM exists: ${runtimeExists}`);
        outputChannel.appendLine(`Apex WASM exists: ${apexExists}`);

        if (!runtimeExists || !apexExists) {
            outputChannel.appendLine('ERROR: WASM files missing');
            vscode.window.showErrorMessage(`WASM files not found. Check: ${extensionMediaPath}`);
            return;
        }

        outputChannel.appendLine('3. Importing web-tree-sitter...');
        
        const webTreeSitter = await import('web-tree-sitter') as unknown as {
            Parser: {
                init(options: { locateFile: (fileName: string, scriptDirectory?: string) => string }): Promise<void>;
                new (): any;
            };
            Language: {
                load(wasmPath: string): Promise<any>;
            };
        };

        outputChannel.appendLine('✓ web-tree-sitter imported successfully');
        outputChannel.appendLine(`Module keys: ${Object.keys(webTreeSitter).join(', ')}`);

        outputChannel.appendLine('4. Accessing Parser and Language...');
        const Parser = webTreeSitter.Parser;
        const Language = webTreeSitter.Language;

        outputChannel.appendLine(`Parser type: ${typeof Parser}`);
        outputChannel.appendLine(`Language type: ${typeof Language}`);

        if (!Parser || !Language) {
            outputChannel.appendLine(`✗ Parser: ${!!Parser}, Language: ${!!Language}`);
            vscode.window.showErrorMessage('web-tree-sitter Parser or Language is null');
            return;
        }

        outputChannel.appendLine('5. Checking Parser methods...');
        const hasInit = typeof Parser.init === 'function';
        const hasLanguageLoad = typeof Language.load === 'function';

        outputChannel.appendLine(`Has init(): ${hasInit}`);
        outputChannel.appendLine(`Has Language.load(): ${hasLanguageLoad}`);

        if (!hasInit) {
            outputChannel.appendLine('✗ Parser.init is not a function');
            vscode.window.showErrorMessage('web-tree-sitter module is not properly loaded - missing init()');
            return;
        }

        outputChannel.appendLine('6. Initializing parser with file:// URLs...');
        try {
            // Convert file paths to file:// URLs - this is the key fix
            const runtimeWasmUrl = `file://${runtimeWasmPath}`;
            const apexWasmUrl = `file://${apexWasmPath}`;
            
            outputChannel.appendLine(`Runtime WASM URL: ${runtimeWasmUrl}`);
            outputChannel.appendLine(`Apex WASM URL: ${apexWasmUrl}`);

            await Parser.init({
                locateFile: (fileName: string, scriptDirectory?: string) => {
                    outputChannel.appendLine(`locateFile request: "${fileName}" in "${scriptDirectory || 'no directory'}"`);
                    //outputChannel.appendLine(`locateFile request: "${fileName}" in "${scriptDirectory}"`);
                    
                    if (fileName === 'tree-sitter.wasm') {
                        return runtimeWasmUrl;
                    }
                    
                    // For any other files (including language WASM files), use file:// URLs
                    if (fileName.endsWith('.wasm')) {
                        const baseDir = scriptDirectory ? path.dirname(scriptDirectory) : path.dirname(runtimeWasmPath);
                        //const requestedPath = path.join(path.dirname(runtimeWasmPath), fileName);
                        const requestedPath = path.join(baseDir, fileName);
                        if (fs.existsSync(requestedPath)) {
                            return `file://${requestedPath}`;
                        }
                    }
                    
                    // Fallback - return the filename as-is
                    return fileName;
                }
            });
            outputChannel.appendLine('✓ Parser initialized successfully with file:// URLs');
        } catch (initError) {
            outputChannel.appendLine(`✗ Parser.init failed: ${initError}`);
            if (initError instanceof Error && initError.stack) {
                outputChannel.appendLine(`Full stack trace: ${initError.stack}`);
            }
            vscode.window.showErrorMessage(`Parser initialization failed: ${initError}`);
            return;
        }

        outputChannel.appendLine('7. Loading Apex language with file:// URL...');
        let ApexLang;
        try {
            // Use file:// URL for language loading too
            const apexWasmUrl = `file://${apexWasmPath}`;
            ApexLang = await Language.load(apexWasmUrl);
            outputChannel.appendLine('✓ Apex language loaded successfully with file:// URL');
        } catch (loadError) {
            outputChannel.appendLine(`✗ Apex language load failed: ${loadError}`);
            vscode.window.showErrorMessage(`Failed to load Apex language: ${loadError}`);
            return;
        }

        outputChannel.appendLine('8. Creating parser instance...');
        const parser = new Parser();
        parser.setLanguage(ApexLang);
        outputChannel.appendLine('✓ Parser instance created');

        outputChannel.appendLine('9. Registering command...');
        const parseCommand = vscode.commands.registerCommand('kodelens.parseApex', () => {
            outputChannel.appendLine('Command invoked: kodelens.parseApex');
            const editor = vscode.window.activeTextEditor;
            if (!editor || !editor.document.fileName.endsWith('.cls')) {
                vscode.window.showWarningMessage('Please open an Apex (.cls) file to use this command');
                return;
            }

            try {
                const sourceCode = editor.document.getText();
                outputChannel.appendLine(`Parsing file: ${editor.document.fileName}`);
                const tree = parser.parse(sourceCode);
                
                if (!tree) {
                    vscode.window.showErrorMessage('Failed to parse code: returned null tree');
                    return;
                }
                
                outputChannel.appendLine('✓ Parse successful');
                outputChannel.appendLine(`=== AST Analysis for ${path.basename(editor.document.fileName)} ===`);
                outputChannel.appendLine(tree.rootNode.toString());
                outputChannel.show(true);
            } catch (error) {
                outputChannel.appendLine(`Parse failed: ${error}`);
                vscode.window.showErrorMessage(`Parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });

        context.subscriptions.push(parseCommand, outputChannel);
        outputChannel.appendLine('=== Kodelens Initialization Complete ===');
        
    } catch (error) {
        outputChannel.appendLine(`UNEXPECTED ERROR: ${error}`);
        vscode.window.showErrorMessage(`Kodelens initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function deactivate() {
    console.log('Kodelens deactivated');
}