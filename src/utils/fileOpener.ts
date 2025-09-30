//src/utils/fileOpener.ts
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Safely opens a file in VS Code.
 * - Verifies path exists
 * - Converts to correct vscode.Uri
 * - Shows error if file not found
 */
export async function openFileSafely(filePath: string) {
  try {
    // Normalize to absolute path
    const absolutePath = path.resolve(filePath);

    // Check existence
    if (!fs.existsSync(absolutePath)) {
      vscode.window.showErrorMessage(`File not found: ${absolutePath}`);
      return;
    }

    // Convert to proper VS Code file URI
    const uri = vscode.Uri.file(absolutePath);

    // Open in editor
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to open file: ${err.message}`);
  }
}
