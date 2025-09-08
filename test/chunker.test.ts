// test/chunker.test.ts
import { chunkAST } from "../src/adapters/chunker";
import Parser from "web-tree-sitter";
jest.mock("web-tree-sitter");

describe("chunkAST", () => {
  it("splits a simple Apex class into class + methods", () => {
    const parser = new Parser();
    const fakeTree = parser.parse("class TestClass { void doSomething() {} void doAnotherThing() {} }");
    const chunks = chunkAST(fakeTree);
    expect(chunks.length).toBe(3); // 1 class + 2 methods
    expect(chunks.map(c => c.type)).toEqual(["class", "method", "method"]);
  });
});
