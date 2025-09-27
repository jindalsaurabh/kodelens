//src/adapters/ApexAdapter.ts
import * as vscode from "vscode";
import { ParserSingleton } from "./parserSingleton";
import Parser from "web-tree-sitter";

export class ApexAdapter {
  private parser: Parser | null = null;

  constructor(private context: vscode.ExtensionContext) {}

  /** Initialize parser singleton */
  public async init(): Promise<void> {
    const singleton = ParserSingleton.getInstance();
    await singleton.init(this.context);
    this.parser = singleton.getParser();
    if (!this.parser) {
      throw new Error("Failed to initialize Apex parser");
    }
    console.info("ApexAdapter: parser initialized successfully");
  }

  /** Parse raw source code string */
  public parse(source: string): Parser.Tree {
    if (!this.parser) {throw new Error("ApexAdapter not initialized");}
    if (typeof source !== "string") {throw new Error("Argument must be a string");}
    try {
      return this.parser.parse(source);
    } catch (err) {
      console.error("ApexAdapter.parse failed:", err);
      throw err;
    }
  }
}
