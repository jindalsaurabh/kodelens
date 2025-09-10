// src/database.ts
import sqlite3 from "@vscode/sqlite3";
import { open, Database } from "sqlite";
import { CodeChunk } from "./types";
import * as vscode from "vscode"; // used only when converting db rows back to CodeChunk
import { createHash } from "crypto";

/**
 * Helper to create a deterministic hash for fallback ids
 */
function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export class LocalCache {
  private db!: Database<sqlite3.Database, sqlite3.Statement>;

  constructor(private dbPath: string = ":memory:") {}

  /** Initialize DB connection and tables */
  async init(): Promise<void> {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    // create table (id primary; unique constraint on chunk_hash to dedupe)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_chunks (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        file_hash TEXT,
        chunk_hash TEXT NOT NULL UNIQUE,
        chunk_type TEXT,
        chunk_text TEXT,
        start_line INTEGER,
        start_column INTEGER,
        end_line INTEGER,
        end_column INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_chunk_text ON code_chunks(chunk_text);
    `);
  }

  /** Normalize chunk to primitives that match DB columns */
  private normalizeForInsert(c: CodeChunk, filePath: string, fileHash: string) {
    const startRow = (c.startPosition && typeof c.startPosition.row === "number") ? c.startPosition.row : (c.startLine ?? 0);
    const startCol = (c.startPosition && typeof c.startPosition.column === "number") ? c.startPosition.column : 0;
    const endRow = (c.endPosition && typeof c.endPosition.row === "number") ? c.endPosition.row : (c.endLine ?? 0);
    const endCol = (c.endPosition && typeof c.endPosition.column === "number") ? c.endPosition.column : 0;

    return {
      id: String(c.id ?? sha256Hex(String(c.code ?? ""))),
      file_path: String(filePath ?? ""),
      file_hash: String(fileHash ?? ""),
      chunk_hash: String(c.hash ?? sha256Hex(String(c.code ?? ""))),
      chunk_type: String(c.type ?? ""),
      chunk_text: String(c.text ?? ""),
      start_line: Number.isFinite(startRow) ? startRow : 0,
      start_column: Number.isFinite(startCol) ? startCol : 0,
      end_line: Number.isFinite(endRow) ? endRow : 0,
      end_column: Number.isFinite(endCol) ? endCol : 0,
    };
  }

  /**
   * Insert chunks in a single transaction using prepared statement.
   * Returns number of rows successfully inserted.
   */
  async insertChunks(chunks: CodeChunk[], filePath: string, fileHash: string): Promise<number> {
    if (!this.db) {throw new Error("Database not initialized; call init() first.");}
    if (!chunks || chunks.length === 0) {return 0;}

    const insertSQL = `
      INSERT OR IGNORE INTO code_chunks
      (id, file_path, file_hash, chunk_hash, chunk_type, chunk_text, start_line, start_column, end_line, end_column)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let inserted = 0;
    const stmt = await this.db.prepare(insertSQL);

    try {
      await this.db.run("BEGIN TRANSACTION");
      for (const chunk of chunks) {
        const r = this.normalizeForInsert(chunk, filePath, fileHash);
        try {
          await stmt.run([
            r.id,
            r.file_path,
            r.file_hash,
            r.chunk_hash,
            r.chunk_type,
            r.chunk_text,
            r.start_line,
            r.start_column,
            r.end_line,
            r.end_column,
          ]);
          // NOTE: INSERT OR IGNORE: if ignored, rowcount may be 0; but we count attempts where no error
          inserted++;
        } catch (err: any) {
          // Log the exact values and continue (helps diagnose DATATYPE issues)
          console.error("DB insert failed for params:", [
            r.id, r.file_path, r.file_hash, r.chunk_hash, r.chunk_type, r.chunk_text,
            r.start_line, r.start_column, r.end_line, r.end_column
          ], "err:", err && err.message ? err.message : err);
          // continue with next chunk
        }
      }
      await this.db.run("COMMIT");
    } catch (outerErr) {
      await this.db.run("ROLLBACK");
      console.error("DB transaction failed:", outerErr);
      throw outerErr;
    } finally {
      await stmt.finalize();
    }

    return inserted;
  }

  /**
   * Find chunks by keywords (simple LIKE search). Returns CodeChunk[].
   * This is intentionally simple and safe for MVP.
   */
  async findChunksByKeywords(keywords: string[], limit = 100): Promise<CodeChunk[]> {
    if (!this.db) {throw new Error("Database not initialized; call init() first.");}
    if (!keywords || keywords.length === 0) {return [];}

    const likeConds = keywords.map(() => "chunk_text LIKE ?").join(" OR ");
//    const params = keywords.map(k => `%${k}%`);
    const params = [...keywords.map(k => `%${k}%`), limit];
    const sql = `SELECT * FROM code_chunks WHERE ${likeConds} LIMIT ?`;
    params.push(limit);

    const rows: any[] = await this.db.all(sql, params);
    return rows.map((row) => {
      const startPosition = { row: row.start_line ?? 0, column: row.start_column ?? 0 };
      const endPosition = { row: row.end_line ?? 0, column: row.end_column ?? 0 };
      const chunk: CodeChunk = {
        id: row.id ?? sha256Hex(row.chunk_text ?? ""),
        hash: row.chunk_hash ?? sha256Hex(row.chunk_text ?? ""),
        filePath: row.file_path ?? "",
        type: row.chunk_type ?? "",
        name: row.chunk_type ?? "",
        code: row.chunk_text ?? "",
        text: row.chunk_text ?? "",
        startLine: startPosition.row,
        endLine: endPosition.row,
        startPosition,
        endPosition,
        range: new vscode.Range(startPosition.row, startPosition.column, endPosition.row, endPosition.column),
      };
      return chunk;
    });
  }

  async close(): Promise<void> {
    if (!this.db) {return;}
    await this.db.close();
  }
}
