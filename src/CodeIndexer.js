"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeIndexer = void 0;
// src/CodeIndexer.ts
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const parserService_1 = require("./services/parserService");
const normalize_1 = require("./services/normalize");
const crypto_1 = require("./services/crypto");
/**
 * CodeIndexer indexes files in a workspace:
 *  - normalizes code
 *  - computes hashes
 *  - parses code into AST
 *  - prepares metadata for chunking
 */
class CodeIndexer {
    constructor(workspaceRoot, context) {
        this.workspaceRoot = workspaceRoot;
        this.context = context;
    }
    /**
     * Index a single file.
     * Returns normalized code hash and AST root node.
     */
    async indexFile(filePath, content) {
        try {
            const normalized = (0, normalize_1.normalizeCode)(content);
            const hash = (0, crypto_1.sha256Hex)(normalized);
            const tree = await (0, parserService_1.safeParse)(this.workspaceRoot, this.context, normalized);
            if (!tree) {
                console.warn(`Skipping ${filePath}, parse failed`);
                return null;
            }
            return {
                filePath,
                hash,
                ast: tree.rootNode,
            };
        }
        catch (err) {
            console.error(`Indexing failed for ${filePath}`, err);
            vscode.window.showErrorMessage(`KodeLens: Indexing failed for ${path.basename(filePath)}`);
            return null;
        }
    }
    /**
     * Extract semantic chunks from an AST.
     * Default implementation: single chunk (whole file).
     * Subclasses can override for finer-grained chunking.
     */
    extractChunks(filePath, ast, content) {
        return [
            {
                id: (0, crypto_1.sha256Hex)(filePath + content),
                filePath,
                text: content,
                code: content,
                name: "root",
                type: "file",
                hash: (0, crypto_1.sha256Hex)(content),
                startLine: 1,
                endLine: content.split("\n").length,
                startPosition: { row: 1, column: 0 },
                endPosition: { row: content.split("\n").length, column: 0 },
                range: {
                    start: { row: 1, column: 0 },
                    end: { row: content.split("\n").length, column: 0 },
                },
            },
        ];
    }
}
exports.CodeIndexer = CodeIndexer;
