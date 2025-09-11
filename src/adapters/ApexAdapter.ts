// src/adapters/ApexAdapter.ts
import * as vscode from "vscode";
import { ParserSingleton } from "./parserSingleton";

export class ApexAdapter {
  private parser: any;

  constructor(private context: vscode.ExtensionContext) {}

  public async init(): Promise<void> {
    const singleton = ParserSingleton.getInstance();
    await singleton.init(this.context);
    this.parser = singleton.getParser();
  }

  public parse(source: string) {
    if (!this.parser) {throw new Error("ApexAdapter not initialized");}
    return this.parser.parse(source);
  }
}
