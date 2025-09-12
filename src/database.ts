// src/database.ts
import Database from 'better-sqlite3';
import { CodeChunk } from './types';
import { generateHash } from './utils';

export interface ILocalCache {
  init(): void;
  insertChunk(chunk: CodeChunk, filePath: string, fileHash: string): boolean;
  insertChunks(chunks: CodeChunk[], filePath: string, fileHash: string): number;
  findChunksByKeywords(keywords: string[]): CodeChunk[];
  close(): void;
}

type DbRow = {
  id: string;
  file_path: string;
  file_hash: string;
  chunk_hash: string;
  chunk_type: string;
  chunk_text: string;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
};

export class LocalCache implements ILocalCache {
  private db: Database.Database;
  private readonly SCHEMA_VERSION = 1;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
  }

  /** Initialize DB with schema versioning */
  init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const stmt = this.db.prepare('SELECT value FROM metadata WHERE key = ?');
    // `get()` requires exactly 1 argument for the placeholder `?`
    const row = stmt.get('schema_version') as { value: string } | undefined;
    const currentVersion = row ? Number(row.value) : 0;
  
/*
    const row = this.db.prepare<{ value: string }>(
      `SELECT value FROM metadata WHERE key = 'schema_version'`
    ).get({}); // empty object because better-sqlite3 requires an argument

    const currentVersion = row ? Number(row.value) : 0;
*/    

    if (currentVersion < this.SCHEMA_VERSION) {
      // Apply schema changes
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS code_chunks (
          id TEXT PRIMARY KEY,
          file_path TEXT NOT NULL,
          file_hash TEXT NOT NULL,
          chunk_hash TEXT NOT NULL,
          chunk_type TEXT NOT NULL,
          chunk_text TEXT NOT NULL,
          start_line INTEGER NOT NULL,
          start_column INTEGER NOT NULL,
          end_line INTEGER NOT NULL,
          end_column INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_chunk_text ON code_chunks(chunk_text);
        CREATE INDEX IF NOT EXISTS idx_file_path ON code_chunks(file_path);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_file_chunk ON code_chunks(file_path, chunk_hash);
      `);

      this.db.prepare(
        `INSERT OR REPLACE INTO metadata (key, value) VALUES ('schema_version', @version)`
      ).run({ version: String(this.SCHEMA_VERSION) });
    }
  }

  insertChunk(chunk: CodeChunk, filePath: string, fileHash: string): boolean {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO code_chunks
      (id, file_path, file_hash, chunk_hash, chunk_type, chunk_text, start_line, start_column, end_line, end_column)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const chunkId = chunk.id || generateHash(`${filePath}:${chunk.hash}`);
    try {
      const info = stmt.run(
        chunkId,
        filePath,
        fileHash,
        chunk.hash || generateHash(chunk.code || ''),
        chunk.type || 'unknown',
        chunk.text || '',
        Number(chunk.startPosition?.row ?? 0),
        Number(chunk.startPosition?.column ?? 0),
        Number(chunk.endPosition?.row ?? 0),
        Number(chunk.endPosition?.column ?? 0)
      );
      return info.changes > 0;
    } catch (err) {
      console.error('❌ Insert error:', err, 'Chunk:', chunk);
      return false;
    }
  }

  insertChunks(chunks: CodeChunk[], filePath: string, fileHash: string): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO code_chunks
      (id, file_path, file_hash, chunk_hash, chunk_type, chunk_text, start_line, start_column, end_line, end_column)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((chunks: CodeChunk[]) => {
      let count = 0;
      for (const chunk of chunks) {
        const chunkId = chunk.id || generateHash(`${filePath}:${chunk.hash}`);
        const info = stmt.run(
          chunkId,
          filePath,
          fileHash,
          chunk.hash || generateHash(chunk.code || ''),
          chunk.type || 'unknown',
          chunk.text || '',
          Number(chunk.startPosition?.row ?? 0),
          Number(chunk.startPosition?.column ?? 0),
          Number(chunk.endPosition?.row ?? 0),
          Number(chunk.endPosition?.column ?? 0)
        );
        if (info.changes > 0) {count++;}
      }
      return count;
    });

    try {
      return insertMany(chunks);
    } catch (err) {
      console.error('❌ Bulk insert error:', err);
      return 0;
    }
  }

  findChunksByKeywords(keywords: string[]): CodeChunk[] {
    if (keywords.length === 0) {return [];}

    const conditions = keywords.map(() => `chunk_text LIKE '%' || ? || '%'`).join(' OR ');
    const sql = `SELECT * FROM code_chunks WHERE ${conditions} LIMIT 20`;
    const stmt = this.db.prepare(sql);

    try {
      const rows = stmt.all(...keywords) as DbRow[];
      return rows.map((row) => {
        const startPosition = { row: row.start_line, column: row.start_column };
        const endPosition = { row: row.end_line, column: row.end_column };
        const range = { start: startPosition, end: endPosition };

        return {
          id: row.id,
          hash: row.chunk_hash,
          filePath: row.file_path,
          type: row.chunk_type,
          name: row.chunk_type,
          code: row.chunk_text,
          text: row.chunk_text,
          startLine: row.start_line,
          endLine: row.end_line,
          startPosition,
          endPosition,
          range
        } as CodeChunk;
      });
    } catch (err) {
      console.error('❌ Search error:', err);
      return [];
    }
  }

  close(): void {
    this.db.close();
  }
}
