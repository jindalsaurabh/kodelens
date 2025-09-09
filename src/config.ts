// src/config.ts
import * as vscode from "vscode";

export const DB_FILE_NAME = "kodelens-cache.sqlite";

/** Absolute URI for DB file */
export function getDatabasePath(context: vscode.ExtensionContext): string {
    return vscode.Uri.joinPath(context.globalStorageUri, DB_FILE_NAME).fsPath;
}

/** File glob patterns */
export const FILE_GLOBS = {
    apex: "**/*.{cls,trigger}",
    ignore: "**/node_modules/**"
};
