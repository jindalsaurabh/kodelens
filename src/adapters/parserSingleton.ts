// src/adapters/parserSingleton.ts
//import * as Parser from "web-tree-sitter";
import * as vscode from "vscode";
import * as path from "path";
// Instead of default import, do:
const Parser = require("web-tree-sitter");



export class ParserSingleton {
  private static instance: ParserSingleton;
  private treeParser: typeof Parser | null = null;
  private language: any = null;

  private constructor() {}

  public static getInstance(): ParserSingleton {
    if (!ParserSingleton.instance) {
      ParserSingleton.instance = new ParserSingleton();
    }
    return ParserSingleton.instance;
  }

  /** Initialize parser runtime + Apex grammar */
  public async init(context: vscode.ExtensionContext): Promise<void> {
    if (this.treeParser) {return;} // already initialized

    const wasmRuntimePath = context.asAbsolutePath(
      path.join("media", "runtime", "tree-sitter.wasm")
    );
    const apexWasmPath = context.asAbsolutePath(
      path.join("media", "apex", "tree-sitter-apex.wasm")
    );

    await Parser.init({ wasmPath: wasmRuntimePath });

    this.language = await Parser.Language.load(apexWasmPath);
    this.treeParser = new Parser();
    //this.treeParser.setLanguage(this.language);
    if (!this.treeParser) {
    this.treeParser = new Parser();
    }
    this.treeParser.setLanguage(this.language!);

  }

  /** Get parser instance (throws if not initialized) */
  public getParser(): typeof Parser {
    if (!this.treeParser) {
      throw new Error("Parser not initialized. Call init() first.");
    }
    return this.treeParser;
  }

  /** Get language */
  public getLanguage() {
    return this.language;
  }
}
