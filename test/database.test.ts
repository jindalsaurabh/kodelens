// test/database.test.ts

// ------------------- Mock vscode -------------------
jest.mock("vscode", () => {
  return {
    Range: class {
      constructor(public start: any, public end: any) {}
    },
    Position: class {
      constructor(public row: number, public column: number) {}
    },
  };
});

// ------------------- Imports -------------------
import Parser from "web-tree-sitter";
import * as path from "path";
import { LocalCache } from "../src/database";
import { extractChunks } from "../src/chunking";

// ------------------- Test Suite -------------------
describe("Database insertion - fresh test", () => {
  let parser: Parser;

  beforeAll(async () => {
    await Parser.init();
    const lang = await Parser.Language.load(
      path.join(__dirname, "../media/apex/tree-sitter-apex.wasm")
    );

    parser = new Parser();
    parser.setLanguage(lang);
  });

  it("should parse a sample Apex class and insert chunks into in-memory DB", () => {
    // Sample Apex class aligned with Tree-sitter grammar
    const apexCode = `
      public class SampleClass {
        public SampleClass() {}             // constructor_definition
        public void foo() {}                // method_definition
        private Integer bar;                // field_declaration
        }

    `;

    // Parse and extract chunks (do not create vscode.Range in test)
    const tree = parser.parse(apexCode);
    const chunks = extractChunks("SampleClass.cls", tree.rootNode);

    // Log chunks for debugging
    console.log("Extracted chunks:", chunks.map(c => ({ type: c.type, name: c.name })));
    expect(chunks.length).toBeGreaterThan(0);

    // Insert into in-memory DB
    const db = new LocalCache(":memory:");
    db.insertChunks(chunks);

    // Verify rows inserted
    const stmt = db.db.prepare("SELECT COUNT(*) as count FROM code_chunks");
    const result = stmt.get() as unknown as { count?: number };
    const rowCount = result?.count ?? 0;

    console.log("DB row count:", rowCount);
    expect(rowCount).toBeGreaterThan(0);

    // Optional: check first chunk's column/line
    const firstRow = db.db.prepare("SELECT * FROM code_chunks LIMIT 1").get() as any;
    console.log("First DB row:", firstRow);
    expect(firstRow.start_line).toBeGreaterThanOrEqual(0);
    expect(firstRow.start_column).toBeGreaterThanOrEqual(0);
  });
});
