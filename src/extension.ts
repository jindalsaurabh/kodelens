import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Kodelens-Debug');
    outputChannel.show(true);
    outputChannel.appendLine('=== Kodelens Debug Initialization ===');

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
        
        const webTreeSitterModule = await import('web-tree-sitter');
        outputChannel.appendLine(`Module keys: ${Object.keys(webTreeSitterModule).join(', ')}`);

        // v0.25.8: The default export is the Parser constructor
        const Parser = webTreeSitterModule.default;
        outputChannel.appendLine(`Parser type: ${typeof Parser}`);
        outputChannel.appendLine(`Parser available: ${!!Parser}`);

        if (!Parser) {
            outputChannel.appendLine('✗ Parser is null/undefined');
            vscode.window.showErrorMessage('web-tree-sitter Parser is null');
            return;
        }

        outputChannel.appendLine('4. Checking Parser methods...');
        const hasInit = typeof Parser.init === 'function';
        outputChannel.appendLine(`Has init(): ${hasInit}`);

        if (!hasInit) {
            outputChannel.appendLine('✗ Parser.init is not a function');
            vscode.window.showErrorMessage('web-tree-sitter module is not properly loaded - missing init()');
            return;
        }

        outputChannel.appendLine('5. Initializing parser with WASM buffer...');
try {
    // Use WASM buffer approach for Node.js compatibility
    //const wasmBuffer = fs.readFileSync(runtimeWasmPath);
    //outputChannel.appendLine(`WASM buffer size: ${wasmBuffer.length} bytes`);
    
    //await Parser.init({ wasm: wasmBuffer });
    await Parser.init({ locateFile: () => runtimeWasmPath });
    outputChannel.appendLine('✓ Parser initialized successfully with WASM buffer');
    
    // NOW access Language after successful initialization
    outputChannel.appendLine('6. Accessing Language after initialization...');
    const Language = (Parser as any).Language;
    outputChannel.appendLine(`Parser.Language: ${typeof Language}`);
    outputChannel.appendLine(`Parser.Language available: ${!!Language}`);
    
    if (!Language) {
        outputChannel.appendLine('✗ Language not found on Parser after initialization');
        vscode.window.showErrorMessage('Language not found on Parser after initialization');
        return;
    }
    
    // Continue with language loading...
    
} catch (initError) {
    outputChannel.appendLine(`✗ WASM buffer initialization failed: ${initError}`);
    vscode.window.showErrorMessage(`Parser initialization failed: ${initError}`);
    return;
}

        outputChannel.appendLine('6. Accessing Language after initialization...');
        // After init(), Language becomes available as a static property
        const Language = (Parser as any).Language;
        outputChannel.appendLine(`Parser.Language: ${typeof Language}`);
        outputChannel.appendLine(`Parser.Language available: ${!!Language}`);

        if (!Language) {
            outputChannel.appendLine('✗ Language not found on Parser after initialization');
            vscode.window.showErrorMessage('Language not found on Parser after initialization');
            return;
        }

        outputChannel.appendLine('7. Loading Apex language...');
        let ApexLang;
        try {
            ApexLang = await Language.load(apexWasmPath);
            outputChannel.appendLine('✓ Apex language loaded successfully');
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
            if (!editor || !(/\.(cls|trigger)$/i).test(editor.document.fileName)) {
                vscode.window.showWarningMessage('Please open an Apex (.cls or .trigger) file to use this command');
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