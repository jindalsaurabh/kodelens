// Minimal type declarations for web-tree-sitter in a VSCode extension context
declare module "web-tree-sitter" {
  export class Language {
    static load(source: string | ArrayBuffer | Uint8Array): Promise<Language>;
  }

  export class Parser {
    static init(options?: { locateFile?: (fileName: string) => string }): Promise<void>;
    static Language: typeof Language;

    constructor();
    setLanguage(language: Language): void;
    parse(input: string): Tree;
  }

  export interface Tree {
    rootNode: SyntaxNode;
  }

  export interface SyntaxNode {
    type: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    toString(): string;
    text?: string;
    children?: SyntaxNode[];
  }

  export = Parser; // CommonJS export (so `require` works)
}
