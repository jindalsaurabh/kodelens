// src/commands/parseApexCommand.ts
import * as vscode from "vscode";
import * as crypto from "crypto";
import { extractChunks } from "../chunking";
import { safeParse } from "../services/parserService";
import { LocalCache, ILocalCache } from "../database";
import { CodeChunk } from "../types";

export function registerParseApexCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
) {
  const command = vscode.commands.registerCommand(
    "kodelens.parseApex",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !(/\.(cls|trigger)$/i).test(editor.document.fileName)) {
        vscode.window.showWarningMessage("Open an Apex file (.cls or .trigger) first.");
        return;
      }

      const filePath = editor.document.fileName;
      const sourceCode = editor.document.getText();
      const fileHash = crypto.createHash("sha256").update(sourceCode).digest("hex");

      const dbPath = vscode.Uri.joinPath(context.globalStorageUri, "kodelens-cache.sqlite").fsPath;
      let cache: ILocalCache | undefined;

      try {
        const tree = await safeParse(filePath, context, sourceCode);
        if (!tree) {throw new Error("Parse failed");}

        const chunks: CodeChunk[] = extractChunks(filePath, tree.rootNode);
        outputChannel.appendLine(`Found ${chunks.length} chunks`);

        cache = new LocalCache(dbPath);
        cache.init();

        let newChunks = 0, cachedChunks = 0;
        for (const chunk of chunks) {
          const inserted = cache.insertChunk(chunk, filePath, fileHash);
          inserted ? newChunks++ : cachedChunks++;
        }

        const msg = `Processed ${chunks.length} chunks. ${newChunks} new, ${cachedChunks} cached.`;
        outputChannel.appendLine(msg);
        vscode.window.showInformationMessage(msg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Error parsing file: ${msg}`);
        vscode.window.showErrorMessage(`KodeLens: Parsing failed - ${msg}`);
      } finally {
        cache?.close();
      }
    }
  );

  context.subscriptions.push(command);
}
