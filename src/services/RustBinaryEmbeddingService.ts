// src/services/RustBinaryEmbeddingService.ts
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as vscode from 'vscode';

interface EmbeddingRequest {
    texts: string[];
}

interface EmbeddingResponse {
    embeddings: number[][];
    error?: string;
}

export class RustBinaryEmbeddingService {
    private binaryPath?: string;
    private modelPath?: string;
    private context: vscode.ExtensionContext;    

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        console.log(`[RustBinaryEmbeddingService] constructed with extension context`);
    }

    async init(): Promise<void> {
        this.binaryPath = this.resolveBinary();
        this.modelPath = this.resolveModelPath();
        
        console.log(`[RustBinaryEmbeddingService] Initialized with:`);
        console.log(`  Binary: ${this.binaryPath}`);
        console.log(`  Model: ${this.modelPath}`);
        console.log(`  Binary exists: ${fs.existsSync(this.binaryPath)}`);
        console.log(`  Model exists: ${fs.existsSync(this.modelPath)}`);
        
        if (!fs.existsSync(this.binaryPath)) {
            throw new Error(`Rust binary not found at: ${this.binaryPath}`);
        }
        if (!fs.existsSync(this.modelPath)) {
            throw new Error(`Model directory not found at: ${this.modelPath}`);
        }
        
        console.log(`✅ RustBinaryEmbeddingService initialized successfully`);
    }

    private resolveBinary(): string {
        //const extensionRoot = path.join(__dirname, '..', '..', '..');
        //const extensionPath = this.context.extensionPath;        
        //console.log(`[resolveBinary] Extension root: ${extensionRoot}`);
        console.log(`[resolveBinary] Extension path: ${this.context.extensionPath}`);        
        
        // ONLY use dist folder paths (candle-engine is ignored in .vscodeignore)
        const binaryPath = path.join(this.context.extensionPath, 'dist', 'bin', process.platform, process.arch, 'kodelens-embedder');
        console.log(`[RESresolveBinary] Checking: ${binaryPath}`);
        console.log(`[RESresolveBinary] Exists: ${fs.existsSync(binaryPath)}`);
        
        if (fs.existsSync(binaryPath)) {
            return binaryPath;
        }

        throw new Error(`Rust binary not found at: ${binaryPath}`);
    }

    private resolveModelPath(): string {
        //const extensionRoot = path.join(__dirname, '..', '..', '..');
        //const extensionPath = this.context.extensionPath;        
        console.log(`RES[resolveModelPath] Extension path: ${this.context.extensionPath}`);
        
        // ONLY use dist folder paths
        const modelPath = path.join(this.context.extensionPath, 'dist', 'models', 'shipped', 'all-MiniLM-L6-v2');
        console.log(`RES[resolveModelPath] Checking: ${modelPath}`);
        console.log(`RES[resolveModelPath] Exists: ${fs.existsSync(modelPath)}`);
        
        // Verify critical model files exist
        if (fs.existsSync(modelPath)) {
            const requiredFiles = ['config.json', 'model.safetensors', 'tokenizer.json'];
            const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(modelPath, file)));
            
            if (missingFiles.length === 0) {
                console.log(`✅ All model files found`);
                return modelPath;
            } else {
                console.log(`❌ Missing model files: ${missingFiles.join(', ')}`);
            }
        }

        throw new Error(`Model not found or incomplete at: ${modelPath}`);
    }

    dim(): number {
        return 384; // MiniLM-L6-v2 dimension
    }

    async generateEmbedding(text: string): Promise<Float32Array> {
        const embeddings = await this.generateEmbeddings([text]);
        return embeddings[0];
    }

async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    console.log(`[RustBinaryEmbeddingService] Generating embeddings for ${texts.length} texts`);
    
    const request: EmbeddingRequest = { texts };
    
    return new Promise((resolve, reject) => {
        if (!this.binaryPath || !this.modelPath) {
            reject(new Error('Service not properly initialized'));
            return;
        }

        console.log(`[RustBinaryEmbeddingService] Running from: ${path.join(this.context.extensionPath, 'dist')}`);
        
        const child = spawn(this.binaryPath, [], {
            cwd: path.join(this.context.extensionPath, 'dist'),
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = Buffer.from('');
        let stderr = '';

        child.stdout.on('data', (data: Buffer) => {
            stdout = Buffer.concat([stdout, data]);
        });

        child.stderr.on('data', (data) => {
            const stderrLine = data.toString().trim();
            stderr += stderrLine + '\n';
            console.log(`[RustBinary] stderr: ${stderrLine}`);
        });

        child.on('error', (err) => {
            console.error(`[RustBinaryEmbeddingService] Spawn error: ${err.message}`);
            reject(new Error(`Failed to spawn rust binary: ${err.message}`));
        });

        child.on('close', (code) => {
            console.log(`[RustBinaryEmbeddingService] Process exited with code: ${code}`);
            console.log(`[RustBinaryEmbeddingService] stdout bytes: ${stdout.length}`);
            console.log(`[RustBinaryEmbeddingService] stderr: ${stderr}`);
            
            if (code === 0) {
                try {
                    // Convert buffer to string and clean it
                    let outputString = stdout.toString('utf8');
                    
                    // Log first few characters for debugging
                    console.log(`[RustBinaryEmbeddingService] First 50 chars: ${outputString.substring(0, 50)}`);
                    
                    // Remove any binary characters or BOM
                    outputString = outputString.replace(/^\uFEFF/, ''); // Remove UTF-8 BOM
                    outputString = outputString.replace(/[^\x20-\x7E\n\r\t\{\}\[\],:"]/g, ''); // Remove non-printable chars except JSON syntax
                    
                    // Find JSON content
                    const jsonStart = outputString.indexOf('{');
                    const jsonEnd = outputString.lastIndexOf('}');
                    
                    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
                        throw new Error('No valid JSON structure found');
                    }
                    
                    const jsonString = outputString.substring(jsonStart, jsonEnd + 1);
                    console.log(`[RustBinaryEmbeddingService] JSON to parse: ${jsonString.substring(0, 100)}...`);
                    
                    const response: EmbeddingResponse = JSON.parse(jsonString);
                    
                    if (response.error) {
                        reject(new Error(`Rust binary error: ${response.error}`));
                    } else if (!response.embeddings || response.embeddings.length === 0) {
                        reject(new Error('No embeddings generated'));
                    } else {
                        const floatArrays = response.embeddings.map(arr => new Float32Array(arr));
                        console.log(`✅ Successfully generated ${floatArrays.length} embeddings`);
                        resolve(floatArrays);
                    }
                } catch (e) {
                    console.error(`[RustBinaryEmbeddingService] Parse error: ${e}`);
                    console.error(`[RustBinaryEmbeddingService] Hex dump of first 100 bytes: ${stdout.subarray(0, 100).toString('hex')}`);
                    reject(new Error(`Failed to parse embeddings output: ${e}`));
                }
            } else {
                console.error(`[RustBinaryEmbeddingService] Process failed with code ${code}`);
                console.error(`[RustBinaryEmbeddingService] stderr: ${stderr}`);
                reject(new Error(`Rust binary exited with code ${code}. Stderr: ${stderr}`));
            }
        });

        // Send request
        console.log(`[RustBinaryEmbeddingService] Sending request for ${texts.length} texts`);
        child.stdin.write(JSON.stringify(request));
        child.stdin.end();
    });
}
    async dispose(): Promise<void> {
        console.log("[RustBinaryEmbeddingService] Disposed");
    }
}