// -----------------------------------------------------------------------------
// FILE: src/adapters/ApexAdapter.ts
// ApexAdapter: implements LanguageAdapter by wrapping parserSingleton and providing
// a minimal parseAndExtract that returns ParseResult. This is a skeleton to be
// expanded in subsequent phases (chunking, edge extraction, etc.).

// src/adapters/ApexAdapter.ts
import path from "path";
import { getOrCreateParser } from "./parserSingleton";

export class ApexAdapter {
  parserWrapper?: ReturnType<typeof getOrCreateParser>;
  workspaceRoot?: string;

  async init(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;

    // Path to compiled Tree-sitter WASM
    const wasmPath = path.join(__dirname, "../tree-sitter-apex.wasm");

    // Get or create the parser singleton
    this.parserWrapper = getOrCreateParser(workspaceRoot, "apex", wasmPath);
  }

  parse(sourceCode: string) {
    if (!this.parserWrapper) {
      throw new Error("Parser not initialized. Call init() first.");
    }
    return this.parserWrapper.parse(sourceCode);
  }
}
