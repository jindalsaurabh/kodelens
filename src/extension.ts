import * as vscode from "vscode";
import type { Language } from "web-tree-sitter";
//import Parser from "web-tree-sitter";
import Apex from "tree-sitter-sfapex";

const Parser = require("web-tree-sitter");


export async function activate(context: vscode.ExtensionContext) {
  await Parser.init();
  const parser = new Parser();
  parser.setLanguage(Apex as unknown as Language); 

  const outputChannel = vscode.window.createOutputChannel("Kodelens");

  let disposable = vscode.commands.registerCommand("kodelens.parseApex", () => {
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
}

export function deactivate() {}
