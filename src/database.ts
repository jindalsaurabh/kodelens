// src/database.ts
import sqlite3 from "@vscode/sqlite3";
import * as vscode from "vscode";
import { CodeChunk } from "./types";
import { generateHash } from "./utils";

export class LocalCache {
    private db: sqlite3.Database;

    constructor(dbPath: string = ":memory:") {
        this.db = new sqlite3.Database(dbPath);
    }

    /** Initialize database schema */
    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
            CREATE TABLE IF NOT EXISTS code_chunks (
                id TEXT PRIMARY KEY,
                file_path TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                chunk_hash TEXT NOT NULL UNIQUE,
                chunk_type TEXT NOT NULL,
                chunk_text TEXT NOT NULL,
                start_line INTEGER,
                start_column INTEGER,
                end_line INTEGER,
                end_column INTEGER
            )`;
            this.db.exec(sql, err => (err ? reject(err) : resolve()));
        });
    }

    /** Batch insert chunks */
    async insertChunks(chunks: CodeChunk[], filePath: string, fileHash: string): Promise<number> {
        return new Promise((resolve, reject) => {
            let inserted = 0;
            const stmt = this.db.prepare(`
                INSERT INTO code_chunks 
                (id, file_path, file_hash, chunk_hash, chunk_type, chunk_text, start_line, start_column, end_line, end_column)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            this.db.serialize(() => {
                for (const chunk of chunks) {
                    const id = chunk.id || generateHash(chunk.code);
                    const chunkHash = chunk.hash || generateHash(chunk.code);

                    try {
                        stmt.run(
                            id,
                            filePath,
                            fileHash,
                            chunkHash,
                            chunk.type,
                            chunk.text,
                            chunk.startPosition.row,
                            chunk.startPosition.column,
                            chunk.endPosition.row,
                            chunk.endPosition.column,
                            (err: any) => {
                                if (err) {
                                    if (err.message.includes("UNIQUE constraint failed")) {return;}
                                    console.error("Insert chunk error:", err);
                                } else {
                                    inserted++;
                                }
                            }
                        );
                    } catch (err) {
                        console.error("Insert chunk exception:", err);
                    }
                }
            });

            stmt.finalize(err => (err ? reject(err) : resolve(inserted)));
        });
    }

    /** Search chunks by keywords */
    async findChunksByKeywords(keywords: string[]): Promise<CodeChunk[]> {
        if (!keywords.length) {return [];}

        const likeConditions = keywords.map(k => `chunk_text LIKE ?`).join(" OR ");
        const params = keywords.map(k => `%${k}%`);
        const sql = `SELECT * FROM code_chunks WHERE ${likeConditions} LIMIT 100`;

        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows: any[]) => {
                if (err) {return reject(err);}

                const chunks: CodeChunk[] = rows.map(row => {
                    const startPosition = { row: row.start_line ?? 0, column: row.start_column ?? 0 };
                    const endPosition = { row: row.end_line ?? 0, column: row.end_column ?? 0 };
                    const range = new vscode.Range(startPosition.row, startPosition.column, endPosition.row, endPosition.column);

                    return {
                        id: row.id || generateHash(row.chunk_text),
                        name: row.chunk_type || "unknown",
                        type: row.chunk_type,
                        code: row.chunk_text,
                        text: row.chunk_text,
                        hash: row.chunk_hash || generateHash(row.chunk_text),
                        filePath: row.file_path || "unknown",
                        startLine: startPosition.row,
                        endLine: endPosition.row,
                        startPosition,
                        endPosition,
                        range,
                    } as CodeChunk;
                });

                resolve(chunks);
            });
        });
    }

    /** Close DB connection */
    close(): void {
        this.db.close();
    }
}
