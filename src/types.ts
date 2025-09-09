// src/types.ts
// Represents a raw, unprocessed code chunk directly from the AST
import * as vscode from "vscode";
export interface RawCodeChunk {
    type: string; // e.g., 'class_declaration', 'method_declaration'
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
}

// Represents a processed chunk, ready for caching and embedding
export interface CodeChunk extends RawCodeChunk {
    hash: string; // SHA-256 hash of the normalized .text
    id: string;            // unique id
    name: string;          // class/method/property name
    type: string;          // 'class' | 'method' | etc
    code: string;          // normalized code
    filePath: string;      // full path of the file
    startLine: number;     // start line in the file
    endLine: number;       // end line in the file
    range: vscode.Range;   // VSCode Range object for selection
}