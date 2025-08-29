/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import * as path from "path";

// Use CJS require to avoid ESM interop issues in VS Code's Node/Electron host
const Parser: any = require("web-tree-sitter");

export async function activate(context: vscode.ExtensionContext) {
  // 1) Initialize the Tree-sitter runtime and tell it where the *base* WASM is.
  //    This file lives in node_modules/web-tree-sitter/tree-sitter.wasm
  const runtimeWasm = context.asAbsolutePath(
    path.join("node_modules", "web-tree-sitter", "tree-sitter.wasm")
  );
  await Parser.init({
    locateFile: (_scriptName: string, _scriptDir: string) => runtimeWasm,
  });

  // 2) Load the Apex language WASM that you built and packaged under media/
  const apexWasm = context.asAbsolutePath("media/apex/tree-sitter-apex.wasm");
  const ApexLang = await Parser.Language.load(apexWasm);

  // 3) Create parser and set language
  const parser = new Parser();
  parser.setLanguage(ApexLang);

  const outputChannel = vscode.window.createOutputChannel("Kodelens");

  const disposable = vscode.commands.registerCommand("kodelens.parseApex", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor found");
      return;
    }
    const doc = editor.document;
    if (!doc.fileName.endsWith(".cls") && !doc.fileName.endsWith(".trigger")) {
      vscode.window.showWarningMessage("Not an Apex file (.cls or .trigger)");
      return;
    }

    const source = doc.getText();
    const tree = parser.parse(source);

    outputChannel.clear();
    outputChannel.appendLine("=== AST Dump (Apex) ===");
    outputChannel.appendLine(tree.rootNode.toString());
    outputChannel.show(true);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
