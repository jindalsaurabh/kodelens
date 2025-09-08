import { ParserWrapper, getOrCreateParser, disposeParser } from "../src/adapters/parserSingleton";

describe("ParserSingleton", () => {
  const workspace = "__test_workspace__";
  const invalidWasmPath = "/invalid/path/to/tree-sitter-apex.wasm";

  afterEach(() => {
    disposeParser(workspace);
  });

  it("returns the same instance for the same workspace", () => {
    const a = getOrCreateParser(workspace, "apex", invalidWasmPath);
    const b = getOrCreateParser(workspace, "apex", invalidWasmPath);
    expect(a).toBe(b);
  });

  it("initializes parser and catches invalid WASM path", async () => {
    const parser = new ParserWrapper();
    await expect(parser.init(invalidWasmPath)).rejects.toThrow();
  });

  it("throws error if parse is called before init", () => {
    const parser = new ParserWrapper();
    expect(() => parser.parse("some code")).toThrow("Parser not initialized");
  });

  it("dispose removes the parser from singleton map", () => {
    const parser = getOrCreateParser(workspace, "apex", invalidWasmPath);
    disposeParser(workspace);
    const parserAfterDispose = getOrCreateParser(workspace, "apex", invalidWasmPath);
    expect(parser).not.toBe(parserAfterDispose);
  });
});
