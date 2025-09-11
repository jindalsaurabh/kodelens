// src/adapters/parserSingleton.ts
import * as vscode from "vscode";
const Parser = require("web-tree-sitter");

export class ParserSingleton {
  private static instance: ParserSingleton | null = null;
  private treeParser: any | null = null;
  private language: any | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): ParserSingleton {
    if (!ParserSingleton.instance) {
      ParserSingleton.instance = new ParserSingleton();
    }
    return ParserSingleton.instance;
  }

  public async init(context: vscode.ExtensionContext): Promise<void> {
    if (this.initialized) {return;}

    const runtimePath = context.asAbsolutePath("media/runtime/tree-sitter.wasm");
    const apexPath = context.asAbsolutePath("media/apex/tree-sitter-apex.wasm");

    await Parser.init({ wasmPath: runtimePath });
    this.language = await Parser.Language.load(apexPath);

    this.treeParser = new Parser();
    this.treeParser.setLanguage(this.language);

    this.initialized = true;
  }

  public getParser(): any {
    if (!this.initialized || !this.treeParser) {
      throw new Error("ParserSingleton not initialized. Call init() first.");
    }
    return this.treeParser;
  }

  public getLanguage(): any {
    if (!this.initialized || !this.language) {
      throw new Error("Language not initialized. Call init() first.");
    }
    return this.language;
  }
}
