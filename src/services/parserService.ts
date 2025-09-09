import * as vscode from "vscode";
import * as path from "path";
const Parser = require("web-tree-sitter");

export type ParserState = {
  parser: typeof Parser;
  language: any;
};

// Map to keep one parser per workspace
const workspaceParsers = new Map<string, Promise<ParserState>>();

/**
 * Initialize and return the ParserState (parser + language) for a workspace.
 * Ensures only one parser per workspace root.
 */
export async function initParserForWorkspace(
  workspaceRoot: string,
  context: vscode.ExtensionContext
): Promise<ParserState> {
  if (workspaceParsers.has(workspaceRoot)) {
    return workspaceParsers.get(workspaceRoot)!;
  }

  const initPromise = (async (): Promise<ParserState> => {
    try {
      // Absolute paths to WASM runtime + Apex grammar
      const wasmRuntimePath = context.asAbsolutePath(
        path.join("media", "runtime", "tree-sitter.wasm")
      );
      const apexWasmPath = context.asAbsolutePath(
        path.join("media", "apex", "tree-sitter-apex.wasm")
      );

      console.log("WASM runtime path:", wasmRuntimePath);
      console.log("Apex grammar path:", apexWasmPath);

      // Initialize Tree-sitter runtime with FS path
      await Parser.init({ wasmPath: wasmRuntimePath });

      // Load Apex language
      const ApexLang = await Parser.Language.load(apexWasmPath);

      const parser = new Parser();
      parser.setLanguage(ApexLang);

      return { parser, language: ApexLang };
    } catch (err) {
      console.error("KodeLens Parser init error", err);
      vscode.window.showErrorMessage(
        `KodeLens: failed to initialize parser — ${String(err)}`
      );
      throw err;
    }
  })();

  workspaceParsers.set(workspaceRoot, initPromise);
  return initPromise;
}

/**
 * Safely parse text with workspace parser.
 */
export async function safeParse(
  workspaceRoot: string,
  context: vscode.ExtensionContext,
  text: string
) {
  try {
    const { parser } = await initParserForWorkspace(workspaceRoot, context);
    return parser.parse(text);
  } catch (err) {
    console.error("KodeLens parse error", err);
    vscode.window.showErrorMessage(`KodeLens: parse error — ${String(err)}`);
    return null;
  }
}
