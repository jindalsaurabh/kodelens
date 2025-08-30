// Type definitions for web-tree-sitter in VSCode extension context

declare module "web-tree-sitter" {
  interface SyntaxNode {
    type: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    text: string;
    children: SyntaxNode[];
    toString(): string;
  }

  interface Tree {
    rootNode: SyntaxNode;
  }

  class Language {
    static load(source: string): Promise<Language>;
  }

  class Parser {
    static init(options?: { locateFile?: (fileName: string) => string }): Promise<void>;
    static Language: typeof Language;

    constructor();
    setLanguage(language: Language): void;
    parse(input: string): Tree;
  }

  export = Parser;
}