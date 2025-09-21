// src/extension.ts
import * as vscode from "vscode";
import { registerParseApexCommand } from "./commands/parseApexCommand";
import { registerAskQuestionCommand } from "./commands/askQuestionCommand";
import { registerParseWorkspaceCommand } from "./commands/parseWorkspaceCommand";
import { registerFindReferencesCommand } from "./commands/findReferencesCommand";

export async function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showWarningMessage("Open a folder/workspace for Kodelens to function.");
    return;
  }

  const outputChannel = vscode.window.createOutputChannel("Kodelens-Debug");
  outputChannel.show(true);
  outputChannel.appendLine("=== Kodelens Initialization ===");

  // Register all commands
  registerParseApexCommand(context, outputChannel);
  registerAskQuestionCommand(context, outputChannel);
  registerParseWorkspaceCommand(context, outputChannel, workspaceRoot);
  registerFindReferencesCommand(context, outputChannel);

  vscode.window.showInformationMessage("KodeLens is ready!");
}
