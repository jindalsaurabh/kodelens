import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

export async function initializeParser(extensionPath: string) {
    try {
        console.log('Initializing parser...');
        const Parser = require('web-tree-sitter');
        
        const extensionMediaPath = path.join(extensionPath, 'media');
        const apexWasmPath = path.join(extensionMediaPath, 'apex', 'tree-sitter-apex.wasm');

        if (!fs.existsSync(apexWasmPath)) {
            const errorMsg = `Apex WASM not found: ${apexWasmPath}`;
            vscode.window.showErrorMessage(`KodeLens: ${errorMsg}`);
            throw new Error(errorMsg);
        }

        // ✅ CORRECT: For web-tree-sitter, Language is a property of the required module
        const ApexLang = await Parser.Language.load(apexWasmPath);
        const parser = new Parser();
        parser.setLanguage(ApexLang);

        console.log('Parser initialized successfully');
        return parser;

    } catch (error) {
        const errorMsg = `Failed to initialize parser: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        vscode.window.showErrorMessage(`KodeLens: Parser initialization failed. Check console for details.`);
        throw error;
    }
}