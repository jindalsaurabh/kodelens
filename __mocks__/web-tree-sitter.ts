// src/__mocks__/web-tree-sitter.ts
export default class Parser {
  private language: any;

  setLanguage(lang: any) {
    this.language = lang;
  }

  parse(code: string) {
    // Return a fake tree-sitter AST
    return {
      rootNode: {
        type: "program",
        startIndex: 0,
        endIndex: code.length,
        children: [
          {
            type: "class_declaration",
            startIndex: 0,
            endIndex: code.length / 2,
            childForFieldName: (field: string) => {
              if (field === "name") return { text: "TestClass" };
              return null;
            },
            children: [
              {
                type: "method_declaration",
                startIndex: 10,
                endIndex: 30,
                childForFieldName: (field: string) => {
                  if (field === "name") return { text: "doSomething" };
                  return null;
                },
                children: [],
              },
              {
                type: "method_declaration",
                startIndex: 31,
                endIndex: 50,
                childForFieldName: (field: string) => {
                  if (field === "name") {return { text: "doAnotherThing" };}
                  return null;
                },
                children: [],
              },
            ],
          },
        ],
      },
    };
  }
}

// Add static methods to match web-tree-sitter API
Parser.init = async () => {};
Parser.Language = {
  load: async (path: string) => ({ /* fake language object */ }),
};
