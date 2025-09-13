"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalCache = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const utils_1 = require("./utils");
class LocalCache {
    constructor(dbPath = ':memory:') {
        this.SCHEMA_VERSION = 2; // bumped for embedding column
        this.db = new better_sqlite3_1.default(dbPath);
    }
    init() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
        const row = this.db.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version');
        const currentVersion = row ? Number(row.value) : 0;
        if (currentVersion < this.SCHEMA_VERSION) {
            // Create or alter code_chunks table
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
          end_column INTEGER NOT NULL,
          embedding BLOB
        );

        CREATE INDEX IF NOT EXISTS idx_chunk_text ON code_chunks(chunk_text);
        CREATE INDEX IF NOT EXISTS idx_file_path ON code_chunks(file_path);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_file_chunk ON code_chunks(file_path, chunk_hash);
      `);
            this.db.prepare(`INSERT OR REPLACE INTO metadata (key, value) VALUES ('schema_version', @version)`).run({ version: String(this.SCHEMA_VERSION) });
        }
    }
    insertChunk(chunk, filePath, fileHash) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO code_chunks
      (id, file_path, file_hash, chunk_hash, chunk_type, chunk_text, start_line, start_column, end_line, end_column)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const chunkId = chunk.id || (0, utils_1.generateHash)(`${filePath}:${chunk.hash}`);
        try {
            const info = stmt.run(chunkId, filePath, fileHash, chunk.hash || (0, utils_1.generateHash)(chunk.code || ''), chunk.type || 'unknown', chunk.text || '', Number(chunk.startPosition?.row ?? 0), Number(chunk.startPosition?.column ?? 0), Number(chunk.endPosition?.row ?? 0), Number(chunk.endPosition?.column ?? 0));
            return info.changes > 0;
        }
        catch (err) {
            console.error('❌ Insert error:', err, 'Chunk:', chunk);
            return false;
        }
    }
    insertChunks(chunks, filePath, fileHash) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO code_chunks
      (id, file_path, file_hash, chunk_hash, chunk_type, chunk_text, start_line, start_column, end_line, end_column)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const insertMany = this.db.transaction((chunks) => {
            let count = 0;
            for (const chunk of chunks) {
                const chunkId = chunk.id || (0, utils_1.generateHash)(`${filePath}:${chunk.hash}`);
                const info = stmt.run(chunkId, filePath, fileHash, chunk.hash || (0, utils_1.generateHash)(chunk.code || ''), chunk.type || 'unknown', chunk.text || '', Number(chunk.startPosition?.row ?? 0), Number(chunk.startPosition?.column ?? 0), Number(chunk.endPosition?.row ?? 0), Number(chunk.endPosition?.column ?? 0));
                if (info.changes > 0) {
                    count++;
                }
            }
            return count;
        });
        try {
            return insertMany(chunks);
        }
        catch (err) {
            console.error('❌ Bulk insert error:', err);
            return 0;
        }
    }
    /** ---------------- Semantic Methods ---------------- */
    insertChunksWithEmbeddings(chunks, filePath, fileHash, embeddings) {
        if (chunks.length !== embeddings.length) {
            throw new Error("Chunks and embeddings length mismatch");
        }
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO code_chunks
      (id, file_path, file_hash, chunk_hash, chunk_type, chunk_text, start_line, start_column, end_line, end_column, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const insertMany = this.db.transaction((chunks, embeddings) => {
            let count = 0;
            for (let i = 0; i < chunks.length; i++) {
                const c = chunks[i];
                const emb = embeddings[i];
                const chunkId = c.id || (0, utils_1.generateHash)(`${filePath}:${c.hash}`);
                const info = stmt.run(chunkId, filePath, fileHash, c.hash || (0, utils_1.generateHash)(c.code || ''), c.type || 'unknown', c.text || '', Number(c.startPosition?.row ?? 0), Number(c.startPosition?.column ?? 0), Number(c.endPosition?.row ?? 0), Number(c.endPosition?.column ?? 0), Buffer.from(emb.buffer) // store Float32Array as BLOB
                );
                if (info.changes > 0) {
                    count++;
                }
            }
            return count;
        });
        try {
            return insertMany(chunks, embeddings);
        }
        catch (err) {
            console.error('❌ Bulk insert with embeddings error:', err);
            return 0;
        }
    }
    getEmbeddingsByIds(ids) {
        if (ids.length === 0) {
            return [];
        }
        const placeholders = ids.map(() => '?').join(',');
        const sql = `SELECT id, embedding FROM code_chunks WHERE id IN (${placeholders})`;
        const rows = this.db.prepare(sql).all(...ids);
        return rows.map(r => ({ id: r.id, embedding: new Float32Array(r.embedding.buffer) }));
    }
    getAllEmbeddings() {
        const rows = this.db.prepare(`SELECT id, embedding FROM code_chunks WHERE embedding IS NOT NULL`).all();
        return rows.map(r => ({ id: r.id, embedding: new Float32Array(r.embedding.buffer) }));
    }
    getChunkById(id) {
        const row = this.db.prepare(`SELECT * FROM code_chunks WHERE id = ?`).get(id);
        return row ? this.mapRowToChunk(row) : null;
    }
    mapRowToChunk(row) {
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
        };
    }
    /** ---------------- Existing methods remain untouched ---------------- */
    findChunksByKeywords(keywords) {
        if (keywords.length === 0) {
            return [];
        }
        const conditions = keywords.map(() => `chunk_text LIKE '%' || ? || '%'`).join(' OR ');
        const sql = `SELECT * FROM code_chunks WHERE ${conditions} LIMIT 20`;
        const rows = this.db.prepare(sql).all(...keywords);
        return rows.map(r => this.mapRowToChunk(r));
    }
    close() {
        this.db.close();
    }
}
exports.LocalCache = LocalCache;
