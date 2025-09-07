// test/chunking.test.ts
import { expect } from 'chai';
import { normalizeText, generateHash } from '../src/chunking';

// We will import our functions later as we write them

describe('Chunking Engine', () => {
    describe('Text Normalization', () => {
        it('should trim leading and trailing whitespace', () => {
            const input = "   public class MyClass   ";
            const result = normalizeText(input);
            expect(result).to.equal("public class MyClass");
        });
        // Add tests for other normalization rules if needed
    });

    describe('Hash Generation', () => {
        it('should generate the same hash for identical normalized text', () => {
            const text1 = "public void method() {}";
            const text2 = "   public void method() {}   "; // Different whitespace
            const hash1 = generateHash(normalizeText(text1));
            const hash2 = generateHash(normalizeText(text2));
            expect(hash1).to.equal(hash2); // This MUST pass
        });

        it('should generate different hashes for different text', () => {
            const text1 = "public void method1() {}";
            const text2 = "public void method2() {}";
            const hash1 = generateHash(text1);
            const hash2 = generateHash(text2);
            expect(hash1).to.not.equal(hash2);
        });
    });
    // Tests for AST traversal will be added once we write the function
});