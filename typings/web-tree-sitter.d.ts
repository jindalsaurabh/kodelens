// typings/web-tree-sitter.d.ts

declare module "web-tree-sitter" {
  // Augment the default export to include constructor + init
  export default class Parser {
    static init(): Promise<void>;   // add missing static
    constructor();                  // allow `new Parser()`

    setLanguage(language: any): void;
    parse(input: string): any;
  }
}
