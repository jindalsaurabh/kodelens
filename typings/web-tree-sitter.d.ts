declare module "web-tree-sitter" {
  export default class Parser {
    static init(moduleOptions?: any): Promise<void>;
    constructor();
    setLanguage(lang: any): this;
    parse(input: string): any;
    static Language: {
      load(source: string | ArrayBuffer | Uint8Array): Promise<any>;
    };
  }
}
