import * as vscode from "vscode";
import * as crypto from "crypto";
import { extractChunks } from "../chunking";
import { safeParse } from "../services/parserService";
import { LocalCache } from "../database";
import * as path from "path";

export function registerParseApexCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  cache: LocalCache,
  workspaceRoot: string
) {
  const disposable = vscode.commands.registerCommand("kodelens.parseApex", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !(/\.(cls|trigger)$/i).test(editor.document.fileName)) {
      vscode.window.showWarningMessage("Open an Apex file (.cls or .trigger) first.");
      return;
    }

    const sourceCode = editor.document.getText();
    const fileHash = crypto.createHash("sha256").update(sourceCode).digest("hex");

    try {
      const tree = await safeParse(workspaceRoot, context, sourceCode);
      if (!tree) {throw new Error("Parse failed");}

      // Make path relative to workspace root
      const relativePath = path.relative(workspaceRoot, editor.document.fileName);

      const chunks = extractChunks(relativePath, tree.rootNode);
      chunks.forEach(chunk => chunk.filePath = relativePath);
      //cache.insertChunks(chunks, relativePath, fileHash);

      outputChannel.appendLine(`Processed ${chunks.length} chunks for ${editor.document.fileName}`);
      vscode.window.showInformationMessage(`Processed ${chunks.length} chunks for ${editor.document.fileName}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`Error parsing file: ${msg}`);
      vscode.window.showErrorMessage(`KodeLens: Parsing failed - ${msg}`);
    }
  });

  context.subscriptions.push(disposable);
}
