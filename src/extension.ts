import * as vscode from "vscode";

// Use CommonJS require for web-tree-sitter (avoids ESM bundling issues)
const Parser = require("web-tree-sitter");

export async function activate(context: vscode.ExtensionContext) {
  try {
    // Init Tree-sitter runtime
    await Parser.init();

    // Load the Apex language from the packaged WASM
    const wasmPath = context.asAbsolutePath("media/apex/tree-sitter-apex.wasm");
    const ApexLang = await Parser.Language.load(wasmPath);

    // Create a parser and set the language
    const parser = new Parser();
    parser.setLanguage(ApexLang);

    const outputChannel = vscode.window.createOutputChannel("Kodelens");

    const disposable = vscode.commands.registerCommand("kodelens.parseApex", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found");
        return;
      }

      const document = editor.document;
      if (!document.fileName.endsWith(".cls") && !document.fileName.endsWith(".trigger")) {
        vscode.window.showWarningMessage("Not an Apex file (.cls or .trigger)");
        return;
      }

      const sourceCode = document.getText();
      const tree = parser.parse(sourceCode);

      outputChannel.clear();
      outputChannel.appendLine("=== AST Dump (Apex) ===");
      outputChannel.appendLine(tree.rootNode.toString());
      outputChannel.show(true);
    });

    context.subscriptions.push(disposable);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Kodelens activation failed: ${err.message}`);
    console.error("Kodelens activation error:", err);
  }
}

export function deactivate() {}
