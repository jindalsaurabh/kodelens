// src/database.ts
import sqlite3 from '@vscode/sqlite3';

export class LocalCache {
    private db: sqlite3.Database;

    constructor(dbPath: string = ':memory:') {
        this.db = new sqlite3.Database(dbPath);
    }

    // Initialize the database schema
    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
            CREATE TABLE IF NOT EXISTS code_chunks (
                id INTEGER PRIMARY KEY,
                file_path TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                chunk_hash TEXT NOT NULL UNIQUE,
                chunk_type TEXT NOT NULL,
                chunk_text TEXT NOT NULL,
                start_line INTEGER,
                start_column INTEGER,
                end_line INTEGER,
                end_column INTEGER
            )
            `;
            this.db.exec(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Insert a chunk and return whether it was inserted or already existed
    async insertChunk(chunk: any, filePath: string, fileHash: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const sql = `
            INSERT INTO code_chunks (file_path, file_hash, chunk_hash, chunk_type, chunk_text, start_line, start_column, end_line, end_column)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            this.db.run(
                sql,
                [
                    filePath,
                    fileHash,
                    chunk.hash,
                    chunk.type,
                    chunk.text,
                    chunk.startPosition.row,
                    chunk.startPosition.column,
                    chunk.endPosition.row,
                    chunk.endPosition.column
                ],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            resolve(false); // Chunk already exists
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve(true); // Chunk was inserted
                    }
                }
            );
        });
    }

    // Close the database connection
    close(): void {
        this.db.close();
    }
}