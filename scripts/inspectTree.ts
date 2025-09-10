import Parser from "web-tree-sitter";
import * as path from "path";

// Sample Apex code (you can replace this with a real file content)
const apexCode = `
public class SampleClass {
    public SampleClass() {}    // constructor
    public void foo() {}       // method
    private Integer bar;       // field
}
`;

async function main() {
    await Parser.init();

    // Load Apex language
    const lang = await Parser.Language.load(
        path.join(__dirname, "../media/apex/tree-sitter-apex.wasm")
    );

    const parser = new Parser();
    parser.setLanguage(lang);

    // Parse the code
    const tree = parser.parse(apexCode);

    // Print root node type
    console.log("Root node type:", tree.rootNode.type);

    // Print all named children recursively
    function traverse(node: Parser.SyntaxNode, depth = 0) {
        const indent = " ".repeat(depth * 2);
        console.log(`${indent}- ${node.type} (${node.startPosition.row}:${node.startPosition.column} -> ${node.endPosition.row}:${node.endPosition.column})`);
        node.namedChildren.forEach(child => traverse(child, depth + 1));
    }

    traverse(tree.rootNode);
}

main().catch(console.error);
