// src/database.ts
import sqlite3 from '@vscode/sqlite3';
import * as vscode from 'vscode';
import { CodeChunk } from './types';
import { generateHash } from './utils'; // for id/hash generation

export class LocalCache {
    private db: sqlite3.Database;

    constructor(dbPath: string = ':memory:') {
        this.db = new sqlite3.Database(dbPath);
    }

    /** Initialize the database schema */
    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
            CREATE TABLE IF NOT EXISTS code_chunks (
                        id TEXT PRIMARY KEY,          -- unique identifier (hash + filepath)
                        file_path TEXT NOT NULL,
                        file_hash TEXT NOT NULL,
                        chunk_hash TEXT NOT NULL,     -- content-only hash
                        chunk_type TEXT NOT NULL,
                        chunk_text TEXT NOT NULL,
                        start_line INTEGER NOT NULL,
                        start_column INTEGER NOT NULL,
                        end_line INTEGER NOT NULL,
                        end_column INTEGER NOT NULL
                    );

            -- Speed up keyword searches in chunk_text
            CREATE INDEX IF NOT EXISTS idx_chunk_text ON code_chunks(chunk_text);

            -- Speed up lookups by file
            CREATE INDEX IF NOT EXISTS idx_file_path ON code_chunks(file_path);

            -- Optional: speed up duplicate detection
            CREATE UNIQUE INDEX IF NOT EXISTS idx_file_chunk ON code_chunks(file_path, chunk_hash);
`;
            this.db.exec(sql, (err) => {
                if (err) {reject(err);}
                else {resolve();}
            });
        });
    }

    /** Search database for chunks matching keywords */
    async findChunksByKeywords(keywords: string[]): Promise<CodeChunk[]> {
        if (keywords.length === 0) {return [];}

        const likeConditions = keywords.map(k => `chunk_text LIKE '%${k}%'`).join(' OR ');
        const sql = `SELECT * FROM code_chunks WHERE ${likeConditions} LIMIT 20`;
        console.log('Executing SQL:', sql);

        return new Promise((resolve, reject) => {
            this.db.all(sql, [], (err, rows: any[]) => {
                if (err) {return reject(err);}

                const chunks: CodeChunk[] = rows.map(row => {
                    const text = row.chunk_text;
                    const normalizedCode = text; // can normalize if needed
                    const startPosition = { row: row.start_line ?? 0, column: row.start_column ?? 0 };
                    const endPosition = { row: row.end_line ?? 0, column: row.end_column ?? 0 };
                    const range = new vscode.Range(startPosition.row, startPosition.column, endPosition.row, endPosition.column);

                    return {
                        id: row.id || generateHash(normalizedCode),
                        name: row.chunk_type || 'unknown',
                        type: row.chunk_type,
                        code: normalizedCode,
                        text,
                        hash: row.chunk_hash || generateHash(normalizedCode),
                        filePath: row.file_path || 'unknown',
                        startLine: startPosition.row,
                        endLine: endPosition.row,
                        range,
                        startPosition,
                        endPosition
                    } as CodeChunk;
                });

                resolve(chunks);
            });
        });
    }

    /** Insert a new chunk into the database */
async insertChunk(chunk: CodeChunk, filePath: string, fileHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {

    // Ensure the chunk has a valid ID
    const chunkId = chunk.id || generateHash(`${filePath}:${chunk.hash}`);

    const sql = `
      INSERT INTO code_chunks (
        id, file_path, file_hash, chunk_hash, chunk_type, chunk_text,
        start_line, start_column, end_line, end_column
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.run(
      sql,
      [
        chunk.id,
        filePath,
        fileHash,
        chunk.hash,
        chunk.type,
        chunk.text,
        Number(chunk.startPosition?.row ?? 0),
        Number(chunk.startPosition?.column ?? 0),
        Number(chunk.endPosition?.row ?? 0),
        Number(chunk.endPosition?.column ?? 0),
      ],
      function (err) {
        if (err) {
            //Handle duplicate gracefully    
            if (err.message.includes("UNIQUE constraint failed")) {
            resolve(false);
          } else {
            console.error("Insert error:", err);
            reject(err);
          }
        } else {
          resolve(true);
        }
      }
    );
  });
}


    /** Close DB connection */
    close(): void {
        this.db.close();
    }
}
