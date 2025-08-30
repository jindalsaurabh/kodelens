import * as vscode from 'vscode';
import * as path from 'path';

let Parser: any;
let parser: any;

async function initializeParser(): Promise<void> {
  if (parser) return;
  
  try {
    const extensionPath = vscode.extensions.getExtension('your-publisher.kodelens')?.extensionPath;
    if (!extensionPath) throw new Error('Extension path not found');
    
    // Require from copied module location
    const modulePath = path.join(extensionPath, 'dist', 'node_modules', 'web-tree-sitter');
    Parser = require(modulePath);
    
    // Initialize with WASM from extension directory
    const wasmPath = path.join(extensionPath, 'dist', 'tree-sitter.wasm');
    await Parser.init({ locateFile: () => wasmPath });
    
    parser = new Parser();
    
    // Load Apex language
    const apexWasmPath = path.join(extensionPath, 'dist', 'tree-sitter-sfapex.wasm');
    const Apex = await Parser.Language.load(apexWasmPath);
    parser.setLanguage(Apex);
    
    console.log('✓ Parser initialized successfully');
  } catch (error) {
    console.error('Failed to initialize parser:', error);
    throw error;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand('kodelens.analyzeCode', async () => {
    try {
      await initializeParser();
      
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }
      
      const code = editor.document.getText();
      const tree = parser.parse(code);
      
      vscode.window.showInformationMessage(`Parsed ${tree.rootNode.namedChildCount} top-level nodes`);
    } catch (error) {
      vscode.window.showErrorMessage(`Parser error: ${error}`);
    }
  });
  
  context.subscriptions.push(command);
}

export function deactivate() {}