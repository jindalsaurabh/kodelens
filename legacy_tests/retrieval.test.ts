// test/retrieval.test.ts
import { expect } from 'chai';
import { LocalCache } from '../src/database';
import { findRelevantChunks } from '../src/retrieval';

describe('Retrieval System', () => {
    
    let cache: LocalCache;

    beforeEach(async () => {
        // Set up a test database in memory before each test
        cache = new LocalCache();
        await cache.init();
    });

    afterEach(() => {
        // Close the database after each test
        cache.close();
    });
    
    it('should find relevant chunks using keywords', async () => {
        // 1. The 'cache' is already set up by beforeEach()

        // 2. Insert test chunks into the database
        const testChunks = [
            {
                type: 'method_declaration',
                text: 'public void mergeAccounts(Account a, Account b) { /* logic */ }',
                hash: 'hash1',
                startPosition: { row: 0, column: 0 },
                endPosition: { row: 0, column: 0 }
            },
            {
                type: 'method_declaration',
                text: 'public void createNewCustomer(String name) { /* logic */ }',
                hash: 'hash2',
                startPosition: { row: 0, column: 0 },
                endPosition: { row: 0, column: 0 }
            }
        ];

        for (const chunk of testChunks) {
            // Use the already-defined 'cache' from the describe block
            await cache.insertChunk(chunk, 'test.cls', 'filehash123');
        }

        // 3. Execute the function under test
        console.log('Inserted test chunks');
        const question = "How do I merge accounts?";
        console.log(`Searching for: ${question}`);
        // Use the already-defined 'cache'
        const relevantChunks = await findRelevantChunks(question, cache);
        console.log('Relevant chunks found:', relevantChunks); 

        // 4. Verify the results
        expect(relevantChunks).to.be.an('array');
        console.log('Number of chunks found:', relevantChunks.length); 
        expect(relevantChunks.length).to.be.greaterThan(0);
        
        // The chunk about merging accounts should be the most relevant
        const topChunk = relevantChunks[0];
        console.log('Top chunk:', topChunk);
        console.log('Top chunk structure:', JSON.stringify(topChunk, null, 2));
        expect(topChunk && topChunk.chunk_text.includes('mergeAccounts')).to.be.true;

        // 5. REMOVE THIS LINE: cache.close(); 
        // The afterEach() hook will handle closing the database
    });
});