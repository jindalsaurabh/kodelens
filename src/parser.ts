// src/parser.ts
import * as path from 'path';
import * as fs from 'fs';


// Initialize and return a parser instance
export async function initializeParser(extensionPath: string) {
    // Dynamically import web-tree-sitter
    const webTreeSitterModule = await import('web-tree-sitter');
    const Parser = webTreeSitterModule.default;

    // Always resolve paths relative to extensionPath
    const extensionMediaPath = path.join(extensionPath, 'media');
    const runtimeWasmPath = path.join(extensionMediaPath , 'runtime', 'tree-sitter.wasm');
    const apexWasmPath = path.join(extensionMediaPath, 'apex', 'tree-sitter-apex.wasm');

    // Check files exist (better error messages)
    if (!fs.existsSync(runtimeWasmPath)) {
        throw new Error(`Runtime WASM not found: ${runtimeWasmPath}`);
    }
    if (!fs.existsSync(apexWasmPath)) {
        throw new Error(`Apex WASM not found: ${apexWasmPath}`);
    }

    // Init runtime
    await Parser.init({ locateFile: () => runtimeWasmPath });

    // Load Apex language
    const ApexLang = await Parser.Language.load(apexWasmPath);

    // Create parser instance
    const parser = new Parser();
    parser.setLanguage(ApexLang);

    return parser;
}
