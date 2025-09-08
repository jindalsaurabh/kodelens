// src/adapters/parserSingleton.ts
import Parser from "tree-sitter";

type ParserWrapperConfig = {
  lang: string;
  wasmPath: string;
};

class ParserWrapper {
  parser: Parser;
  language: any;

  constructor(config: ParserWrapperConfig) {
    this.parser = new Parser();

    try {
      // Dynamically require the compiled WASM
      this.language = require(config.wasmPath);
      this.parser.setLanguage(this.language);
    } catch (err) {
      throw new Error(`Failed to load WASM at ${config.wasmPath}: ${err}`);
    }
  }

  parse(sourceCode: string) {
    return this.parser.parse(sourceCode);
  }
}

// Singleton map: workspaceRoot -> ParserWrapper
const instances: Map<string, ParserWrapper> = new Map();

/**
 * Get or create a ParserWrapper for a given workspace.
 */
export function getOrCreateParser(
  workspaceRoot: string,
  lang: string,
  wasmPath: string
): ParserWrapper {
  if (!instances.has(workspaceRoot)) {
    const wrapper = new ParserWrapper({ lang, wasmPath });
    instances.set(workspaceRoot, wrapper);
  }
  return instances.get(workspaceRoot)!;
}
