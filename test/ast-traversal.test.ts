// test/ast-traversal.test.ts
import { expect } from 'chai';
import { extractChunksFromAst } from '../src/chunking';
import { initializeParser } from '../src/parser';
import * as path from 'path';

// This is a simple Apex class source code to use for testing
const TEST_APEX_CODE = `
public with sharing class SampleClass {
    public static void myMethod(String input) {
        System.debug('Hello, ' + input);
    }
}
`;

describe('AST Traversal', () => {
    it('should extract class_declaration and method_declaration chunks from AST', async () => {
        // 1. Initialize the parser using the same method the extension uses
        // __dirname gives the path of the current test file. We need to get the project root.
        const projectRoot = path.resolve(__dirname, '..'); // Go up one level from 'test/' to project root
        const parser = await initializeParser(projectRoot);

        // 2. Parse the test code to get an AST
        const ast = parser.parse(TEST_APEX_CODE);
        
        // 3. Extract chunks from the AST
        const chunks = extractChunksFromAst(ast.rootNode, TEST_APEX_CODE);

        // 4. Verify the results
        expect(chunks).to.be.an('array');
        expect(chunks).to.have.lengthOf(2); // Should find 1 class + 1 method

        // Find the class chunk
        const classChunk = chunks.find(chunk => chunk.type === 'class_declaration');
        expect(classChunk).to.exist;
        expect(classChunk?.text).to.include('public with sharing class SampleClass');

        // Find the method chunk
        const methodChunk = chunks.find(chunk => chunk.type === 'method_declaration');
        expect(methodChunk).to.exist;
        expect(methodChunk?.text).to.include('public static void myMethod(String input)');
    });
});