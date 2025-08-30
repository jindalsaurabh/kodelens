import * as vscode from "vscode";
import * as path from "path";

// Use require to dodge ESM typing friction and ensure esbuild bundles it.
const Parser: any = require("web-tree-sitter");

export async function activate(context: vscode.ExtensionContext) {
  // absolute paths inside the installed extension
  const runtimeWasm = context.asAbsolutePath(
    path.join("dist", "media", "runtime", "tree-sitter.wasm")
  );
  const apexWasm = context.asAbsolutePath(
    path.join("dist", "media", "apex", "tree-sitter-apex.wasm")
  );

  console.log("[Kodelens] Runtime wasm:", runtimeWasm);
  console.log("[Kodelens] Apex wasm:", apexWasm);

  // Ensure the runtime wasm is found even after bundling
  await Parser.init({
    locateFile: (_: string) => runtimeWasm
  });

  const ApexLang = await Parser.Language.load(apexWasm);

  const parser = new Parser();
  parser.setLanguage(ApexLang);

  const out = vscode.window.createOutputChannel("Kodelens");

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
    if (!tree) {
      vscode.window.showErrorMessage("Failed to parse Apex.");
      return;
    }

    out.clear();
    out.appendLine("=== Apex AST (root) ===");
    out.appendLine(tree.rootNode.toString());
    out.show(true);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
