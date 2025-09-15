// test/ast-traversal.test.ts
import { expect } from 'chai';
import { extractChunksFromAst, RawCodeChunk } from '../src/chunking';

// Mock a simple AST structure for testing
const mockRootNode = {
    type: 'parser_output',
    text: 'public class Test { public void method() {} }',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 1, column: 0 },
    children: [
        {
            type: 'class_declaration',
            text: 'public class Test { public void method() {} }',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 0, column: 35 },
            children: [
                {
                    type: 'method_declaration',
                    text: 'public void method() {}',
                    startPosition: { row: 0, column: 18 },
                    endPosition: { row: 0, column: 38 },
                    children: []
                }
            ]
        }
    ]
};

describe('AST Traversal', () => {
    it('should extract class_declaration and method_declaration chunks from AST', () => {
        // Use the mock node instead of initializing a real parser
        const chunks: RawCodeChunk[] = extractChunksFromAst(mockRootNode, mockRootNode.text);

        // Verify the results
        expect(chunks).to.be.an('array');
        expect(chunks).to.have.lengthOf(2); // Should find 1 class + 1 method

        const classChunk = chunks.find(chunk => chunk.type === 'class_declaration');
        expect(classChunk).to.exist;
        expect(classChunk?.text).to.equal('public class Test { public void method() {} }');

        const methodChunk = chunks.find(chunk => chunk.type === 'method_declaration');
        expect(methodChunk).to.exist;
        expect(methodChunk?.text).to.equal('public void method() {}');
    });
});