import * as vscode from "vscode";
import * as crypto from "crypto";
import { extractChunks } from "../chunking";
import { safeParse } from "../services/parserService";
import { LocalCache } from "../database";

export function registerParseWorkspaceCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  cache: LocalCache,
  workspaceRoot: string
) {
  const disposable = vscode.commands.registerCommand("kodelens.parseWorkspace", async () => {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showWarningMessage("Open a workspace folder first.");
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Kodelens: Parsing workspace Apex files...",
        cancellable: true,
      },
      async (progress, token) => {
        const apexFiles = await vscode.workspace.findFiles("**/*.{cls,trigger}", "**/node_modules/**");
        outputChannel.appendLine(`Found ${apexFiles.length} Apex files`);

        let totalChunks = 0;
        for (let i = 0; i < apexFiles.length; i++) {
          if (token.isCancellationRequested) {break;}

          const fileUri = apexFiles[i];
          try {
            progress.report({ message: `Processing ${i + 1}/${apexFiles.length}`, increment: (1 / apexFiles.length) * 100 });

            const doc = await vscode.workspace.openTextDocument(fileUri);
            const sourceCode = doc.getText();
            const fileHash = crypto.createHash("sha256").update(sourceCode).digest("hex");

            const tree = await safeParse(workspaceRoot, context, sourceCode);
            if (!tree) {continue;}

            const chunks = extractChunks(fileUri.fsPath, tree.rootNode);
            cache.insertChunks(chunks, fileUri.fsPath, fileHash);
            totalChunks += chunks.length;

            outputChannel.appendLine(`Processed ${fileUri.fsPath} (${chunks.length} chunks)`);
          } catch (err) {
            outputChannel.appendLine(`Error processing ${fileUri.fsPath}: ${err}`);
          }
        }

        vscode.window.showInformationMessage(`Workspace parsing complete. ${totalChunks} chunks processed.`);
      }
    );
  });

  context.subscriptions.push(disposable);
}
