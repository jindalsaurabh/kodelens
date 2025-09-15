// src/extractors/ApexChunkExtractor.ts
import { CodeChunk } from "../types";
import { generateHash } from "../utils";
import { ApexAdapter } from "../adapters/ApexAdapter";

export class ApexChunkExtractor {
    constructor(private apexAdapter: ApexAdapter) {}
    public extractChunks(filePath: string, content: string): CodeChunk[] {
        if (!this.apexAdapter) {
        throw new Error("ApexAdapter not initialized");
        }

        const tree = this.apexAdapter.parse(content);
        if (!tree || !tree.rootNode) {
        // fallback → whole-file chunk
        return [
            {
            id: generateHash(filePath + content),
            filePath,
            text: content,
            code: content,
            name: "root",
            type: "file",
            hash: generateHash(content),
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

        const chunks: CodeChunk[] = [];
        const sourceLines = content.split("\n");

        const visitNode = (node: any) => {
        let chunkType: string | null = null;

        switch (node.type) {
            case "class_declaration":
            chunkType = "class";
            break;
            case "method_declaration":
            chunkType = "method";
            break;
            case "constructor_declaration":
            chunkType = "constructor";
            break;
            // you can add fields, triggers, or other node types later
        }

        if (chunkType) {
            const startLine = node.startPosition.row + 1;
            const endLine = node.endPosition.row + 1;
            const chunkText = sourceLines.slice(startLine - 1, endLine).join("\n");

            chunks.push({
            id: generateHash(`${filePath}:${startLine}:${endLine}:${chunkType}`),
            filePath,
            text: chunkText,
            code: chunkText,
            name: node.type,
            type: chunkType,
            hash: generateHash(chunkText),
            startLine,
            endLine,
            startPosition: node.startPosition,
            endPosition: node.endPosition,
            range: { start: node.startPosition, end: node.endPosition },
            });
        }

        // recurse into children
        if (node.children) {
            for (const child of node.children) {
            visitNode(child);
            }
        }
        };

        visitNode(tree.rootNode);

        // fallback if nothing extracted
        if (chunks.length === 0) {
        return [
            {
            id: generateHash(filePath + content),
            filePath,
            text: content,
            code: content,
            name: "root",
            type: "file",
            hash: generateHash(content),
            startLine: 1,
            endLine: sourceLines.length,
            startPosition: { row: 1, column: 0 },
            endPosition: { row: sourceLines.length, column: 0 },
            range: {
                start: { row: 1, column: 0 },
                end: { row: sourceLines.length, column: 0 },
            },
            },
        ];
        }

        return chunks;
    }
    }
