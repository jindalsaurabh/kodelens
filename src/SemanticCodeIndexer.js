"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticCodeIndexer = void 0;
const CodeIndexer_1 = require("./CodeIndexer");
const embeddingFactory_1 = require("./services/embeddingFactory");
/**
 * SemanticCodeIndexer
 * Extends CodeIndexer to generate embeddings for each chunk
 */
class SemanticCodeIndexer extends CodeIndexer_1.CodeIndexer {
    constructor(workspaceRoot, context, cache, embeddingChoice = "mock", apiKey) {
        super(workspaceRoot, context);
        this.cache = cache;
        this.embeddingService = (0, embeddingFactory_1.createEmbeddingService)(embeddingChoice, apiKey);
    }
    /**
     * Index a file and also generate embeddings for each chunk
     */
    async indexFileWithEmbeddings(filePath, content) {
        const result = await this.indexFile(filePath, content);
        if (!result) {
            return;
        }
        // Extract chunks using CodeIndexer logic
        // TODO: replace with real AST-based chunk extraction
        const chunks = this.extractChunks(filePath, result.ast, content);
        // Generate embeddings for each chunk
        const embeddings = await this.embeddingService.generateEmbeddings(chunks.map(c => c.text));
        // Insert into DB with embeddings
        this.cache.insertChunksWithEmbeddings(chunks, filePath, result.hash, embeddings);
    }
}
exports.SemanticCodeIndexer = SemanticCodeIndexer;
