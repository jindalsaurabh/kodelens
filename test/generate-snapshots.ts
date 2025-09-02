// test/generate-snapshots.ts
import { initializeParser } from '../src/parser';
import * as fs from 'fs';
import * as path from 'path';

const snapshotsDir = path.join(__dirname, 'snapshots');
const sampleFilesDir = path.join(__dirname, 'snapshots', 'sampleFiles');

console.log('Snapshots directory:', snapshotsDir);
console.log('Sample files directory:', sampleFilesDir);

// Check if directories exist
if (!fs.existsSync(sampleFilesDir)) {
    console.error('ERROR: Sample files directory does not exist:', sampleFilesDir);
    process.exit(1);
}

// Get all .cls and .trigger files from the sample directory
const sampleFiles = fs.readdirSync(sampleFilesDir).filter(file => 
    file.endsWith('.cls') || file.endsWith('.trigger')
);

console.log('Found sample files:', sampleFiles);

async function generateSnapshots() {
    console.log('Initializing parser...');
    const parser = await initializeParser(path.resolve(__dirname, '..')); 

    for (const file of sampleFiles) {
        const filePath = path.join(sampleFilesDir, file);
        console.log('Processing file:', filePath);
        
        const sourceCode = fs.readFileSync(filePath, 'utf8');
        const tree = parser.parse(sourceCode);
        const astString = tree.rootNode.toString();
        
        // Write the snapshot to a .txt file
        const snapshotPath = path.join(snapshotsDir, `${file}.snapshot.txt`);
        console.log('Writing snapshot to:', snapshotPath);
        fs.writeFileSync(snapshotPath, astString);
        console.log(`Generated snapshot for: ${file}`);
    }
    console.log('All snapshots generated.');
}

generateSnapshots().catch(console.error);