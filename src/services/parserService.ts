// src/services/parserService.ts
import * as vscode from "vscode";
import { ParserSingleton } from "../adapters/parserSingleton";

let initialized = false;

/**
 * Initialize parser for the whole workspace.
 * Should be called once during extension activation.
 */
export async function initParserForWorkspace(
  workspaceRoot: string,
  context: vscode.ExtensionContext
): Promise<void> {
  if (initialized) {return;}

  try {
    const parser = ParserSingleton.getInstance();
    await parser.init(context);
    initialized = true;
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Unknown parser initialization error";
    vscode.window.showErrorMessage(`Parser init failed: ${msg}`);
    throw err;
  }
}

/**
 * Safe parse helper.
 * Returns a tree or null if parsing fails.
 */
export async function safeParse(
  workspaceRoot: string,
  context: vscode.ExtensionContext,
  sourceCode: string
) {
  try {
    if (!initialized) {
      await initParserForWorkspace(workspaceRoot, context);
    }

    const parser = ParserSingleton.getInstance().getParser();
    return parser.parse(sourceCode);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Parse failed: ${msg}`);
    return null;
  }
}
