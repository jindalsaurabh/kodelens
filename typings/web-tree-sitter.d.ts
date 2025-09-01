declare module "web-tree-sitter" {
  export default class Parser {
    static init(options?: ArrayBuffer | { locateFile?: (file: string) => string }): Promise<void>;
    static Language: {
      load(source: string | ArrayBuffer | Uint8Array): Promise<any>;
    };
    constructor();
    setLanguage(lang: any): void;
    parse(input: string): Tree;
  }
  export interface Tree { rootNode: SyntaxNode; }
  export interface SyntaxNode {
    type: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    text?: string;
    children?: SyntaxNode[];
    toString(): string;
  }
}
