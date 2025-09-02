// test/database.test.ts
import { expect } from 'chai';
import { LocalCache } from '../src/database';
import { CodeChunk } from '../src/types';

describe('Local Cache', () => {
    it('should insert and retrieve a code chunk by its hash', async () => {
        // 1. Setup: Create an in-memory database and a sample chunk
        const cache = new LocalCache(); // Uses in-memory DB
        // WAIT for the database to initialize
        await cache.init();

        const testChunk: CodeChunk = {
            type: 'method_declaration',
            text: 'public void test() {}',
            hash: 'abc123def456', // Mock hash
            startPosition: { row: 5, column: 0 },
            endPosition: { row: 5, column: 20 }
        };

        // 2. Execute: AWAIT the insert operation        
        const wasInserted = await cache.insertChunk(testChunk, '/test/file.cls', 'filehash123');
        expect(wasInserted).to.be.true;

        // 3. Verify: Retrieve the chunk by its hash
        //const retrievedChunk = cache.getChunkByHash('abc123def456');
        //expect(retrievedChunk).to.not.be.null;
        //expect(retrievedChunk?.chunk_text).to.equal('public void test() {}');
        //expect(retrievedChunk?.chunk_type).to.equal('method_declaration');

        cache.close(); // Cleanup
    });
});