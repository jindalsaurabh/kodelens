// -----------------------------------------------------------------------------
// FILE: src/adapters/parserSingleton.ts
// Manages a single tree-sitter parser instance per workspace root.

//import * as Parser from 'web-tree-sitter';
import Parser from "web-tree-sitter";
const Parser = require("web-tree-sitter");

import { logError, logInfo } from '../utils/logger';
import * as path from 'path';

/**
 * ParserWrapper: exposes a safe parse(text) API. It encapsulates the real Parser instance
 * and protects callers by catching parse-time exceptions.
 */
export class ParserWrapper {
    private parser: Parser;

    //parser: typeof Parser | null = null; // the web-tree-sitter parser module
  treeParser: Parser | null = null; // actual Parser instance
  languageLoaded: boolean = false;
  languageName: string;
  languageWasmPath?: string;

  constructor(languageName = 'apex', languageWasmPath?: string) {
    this.languageName = languageName;
    this.languageWasmPath = languageWasmPath;
    this.parser = new Parser(); // now valid
  }

  async init() {
    if (this.treeParser && this.languageLoaded) {return;}
    try {
      await Parser.init();
      this.parser = Parser;
      this.treeParser = new Parser();

      // NOTE: loading the language wasm/library is language-specific and may vary depending
      // on how you bundle tree-sitter grammars. We try to support a default path relative
      // to the extension, but adapters can supply their own path if needed.
      const wasmPath = this.languageWasmPath || path.join(__dirname, '..', 'tree-sitter-apex.wasm');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Lang = await (this.parser as any).Language.load(wasmPath);
      this.treeParser.setLanguage(Lang);
      this.languageLoaded = true;
      logInfo(`ParserWrapper: language ${this.languageName} loaded from ${wasmPath}`);
    } catch (err: any) {
      logError(`ParserWrapper.init failed for ${this.languageName}: ${err?.message || err}`);
      this.languageLoaded = false;
      throw err;
    }
  }

  async parse(text: string) {
    if (!this.treeParser) {
      throw new Error('Parser not initialized. Call init() first');
    }

    try {
      // treeParser.parse returns a Tree. We return it directly to let adapters walk.
      return this.treeParser.parse(text);
    } catch (err: any) {
      // Catch and log parse errors to avoid crashing the extension host.
      logError(`ParserWrapper.parse failed: ${err?.message || err}`);
      throw err;
    }
  }
}

// Singleton registry per workspace root
const parsers = new Map<string, ParserWrapper>();

export function getOrCreateParser(workspaceRoot: string, languageName = 'apex', languageWasmPath?: string) {
  const key = workspaceRoot || '__default__';
  if (parsers.has(key)) {return parsers.get(key)!};
  const wrapper = new ParserWrapper(languageName, languageWasmPath);
  parsers.set(key, wrapper);
  return wrapper;
}

export function disposeParser(workspaceRoot: string) {
  const key = workspaceRoot || '__default__';
  const w = parsers.get(key);
  if (!w) {return;}
  // Note: web-tree-sitter does not currently expose an explicit dispose for parser instances,
  // but if you implement worker threads in future, you'll terminate worker processes here.
  parsers.delete(key);
  logInfo(`Parser for ${key} disposed`);
}
