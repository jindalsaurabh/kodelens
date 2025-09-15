// test/parser-snapshot.test.ts
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { initializeParser } from '../src/parser';

const snapshotsDir = path.join(__dirname, 'snapshots');
const sampleFilesDir = path.join(snapshotsDir, 'sampleFiles');

// Get all snapshot files
const snapshotFiles = fs.readdirSync(snapshotsDir).filter(file => file.endsWith('.snapshot.txt'));

describe('Parser Snapshot Tests', () => {
    snapshotFiles.forEach(snapshotFile => {
        it(`should produce the same AST for ${snapshotFile}`, async () => {
            const sampleFile = snapshotFile.replace('.snapshot.txt', '');
            const sampleFilePath = path.join(sampleFilesDir, sampleFile);
            const snapshotPath = path.join(snapshotsDir, snapshotFile);

            const sourceCode = fs.readFileSync(sampleFilePath, 'utf8');
            const expectedAst = fs.readFileSync(snapshotPath, 'utf8');

            const parser = await initializeParser(path.resolve(__dirname, '..'));
            const tree = parser.parse(sourceCode);
            const actualAst = tree.rootNode.toString();

            // Critical assertion: Compare the actual AST to the saved snapshot
            expect(actualAst).to.equal(expectedAst);
        });
    });
});