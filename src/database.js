"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalCache = void 0;
var better_sqlite3_1 = __importDefault(require("better-sqlite3"));
var utils_1 = require("./utils");
var LocalCache = /** @class */ (function () {
    function LocalCache(dbPath) {
        if (dbPath === void 0) { dbPath = ':memory:'; }
        this.SCHEMA_VERSION = 2; // bumped for embedding column
        this.db = new better_sqlite3_1.default(dbPath);
    }
    LocalCache.prototype.init = function () {
        this.db.exec("\n      CREATE TABLE IF NOT EXISTS metadata (\n        key TEXT PRIMARY KEY,\n        value TEXT NOT NULL\n      );\n    ");
        var row = this.db.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version');
        var currentVersion = row ? Number(row.value) : 0;
        if (currentVersion < this.SCHEMA_VERSION) {
            // Create or alter code_chunks table
            this.db.exec("\n        CREATE TABLE IF NOT EXISTS code_chunks (\n          id TEXT PRIMARY KEY,\n          file_path TEXT NOT NULL,\n          file_hash TEXT NOT NULL,\n          chunk_hash TEXT NOT NULL,\n          chunk_type TEXT NOT NULL,\n          chunk_text TEXT NOT NULL,\n          start_line INTEGER NOT NULL,\n          start_column INTEGER NOT NULL,\n          end_line INTEGER NOT NULL,\n          end_column INTEGER NOT NULL,\n          embedding BLOB\n        );\n\n        CREATE INDEX IF NOT EXISTS idx_chunk_text ON code_chunks(chunk_text);\n        CREATE INDEX IF NOT EXISTS idx_file_path ON code_chunks(file_path);\n        CREATE UNIQUE INDEX IF NOT EXISTS idx_file_chunk ON code_chunks(file_path, chunk_hash);\n      ");
            this.db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('schema_version', @version)").run({ version: String(this.SCHEMA_VERSION) });
        }
    };
    LocalCache.prototype.insertChunk = function (chunk, filePath, fileHash) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        var stmt = this.db.prepare("\n      INSERT OR IGNORE INTO code_chunks\n      (id, file_path, file_hash, chunk_hash, chunk_type, chunk_text, start_line, start_column, end_line, end_column)\n      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n    ");
        var chunkId = chunk.id || (0, utils_1.generateHash)("".concat(filePath, ":").concat(chunk.hash));
        try {
            var info = stmt.run(chunkId, filePath, fileHash, chunk.hash || (0, utils_1.generateHash)(chunk.code || ''), chunk.type || 'unknown', chunk.text || '', Number((_b = (_a = chunk.startPosition) === null || _a === void 0 ? void 0 : _a.row) !== null && _b !== void 0 ? _b : 0), Number((_d = (_c = chunk.startPosition) === null || _c === void 0 ? void 0 : _c.column) !== null && _d !== void 0 ? _d : 0), Number((_f = (_e = chunk.endPosition) === null || _e === void 0 ? void 0 : _e.row) !== null && _f !== void 0 ? _f : 0), Number((_h = (_g = chunk.endPosition) === null || _g === void 0 ? void 0 : _g.column) !== null && _h !== void 0 ? _h : 0));
            return info.changes > 0;
        }
        catch (err) {
            console.error('❌ Insert error:', err, 'Chunk:', chunk);
            return false;
        }
    };
    LocalCache.prototype.insertChunks = function (chunks, filePath, fileHash) {
        var stmt = this.db.prepare("\n      INSERT OR IGNORE INTO code_chunks\n      (id, file_path, file_hash, chunk_hash, chunk_type, chunk_text, start_line, start_column, end_line, end_column)\n      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n    ");
        var insertMany = this.db.transaction(function (chunks) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            var count = 0;
            for (var _i = 0, chunks_1 = chunks; _i < chunks_1.length; _i++) {
                var chunk = chunks_1[_i];
                var chunkId = chunk.id || (0, utils_1.generateHash)("".concat(filePath, ":").concat(chunk.hash));
                var info = stmt.run(chunkId, filePath, fileHash, chunk.hash || (0, utils_1.generateHash)(chunk.code || ''), chunk.type || 'unknown', chunk.text || '', Number((_b = (_a = chunk.startPosition) === null || _a === void 0 ? void 0 : _a.row) !== null && _b !== void 0 ? _b : 0), Number((_d = (_c = chunk.startPosition) === null || _c === void 0 ? void 0 : _c.column) !== null && _d !== void 0 ? _d : 0), Number((_f = (_e = chunk.endPosition) === null || _e === void 0 ? void 0 : _e.row) !== null && _f !== void 0 ? _f : 0), Number((_h = (_g = chunk.endPosition) === null || _g === void 0 ? void 0 : _g.column) !== null && _h !== void 0 ? _h : 0));
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
    };
    /** ---------------- Semantic Methods ---------------- */
    LocalCache.prototype.insertChunksWithEmbeddings = function (chunks, filePath, fileHash, embeddings) {
        if (chunks.length !== embeddings.length) {
            throw new Error("Chunks and embeddings length mismatch");
        }
        var stmt = this.db.prepare("\n      INSERT OR REPLACE INTO code_chunks\n      (id, file_path, file_hash, chunk_hash, chunk_type, chunk_text, start_line, start_column, end_line, end_column, embedding)\n      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n    ");
        var insertMany = this.db.transaction(function (chunks, embeddings) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            var count = 0;
            for (var i = 0; i < chunks.length; i++) {
                var c = chunks[i];
                var emb = embeddings[i];
                var chunkId = c.id || (0, utils_1.generateHash)("".concat(filePath, ":").concat(c.hash));
                var info = stmt.run(chunkId, filePath, fileHash, c.hash || (0, utils_1.generateHash)(c.code || ''), c.type || 'unknown', c.text || '', Number((_b = (_a = c.startPosition) === null || _a === void 0 ? void 0 : _a.row) !== null && _b !== void 0 ? _b : 0), Number((_d = (_c = c.startPosition) === null || _c === void 0 ? void 0 : _c.column) !== null && _d !== void 0 ? _d : 0), Number((_f = (_e = c.endPosition) === null || _e === void 0 ? void 0 : _e.row) !== null && _f !== void 0 ? _f : 0), Number((_h = (_g = c.endPosition) === null || _g === void 0 ? void 0 : _g.column) !== null && _h !== void 0 ? _h : 0), Buffer.from(emb.buffer) // store Float32Array as BLOB
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
    };
    LocalCache.prototype.getEmbeddingsByIds = function (ids) {
        var _a;
        if (ids.length === 0) {
            return [];
        }
        var placeholders = ids.map(function () { return '?'; }).join(',');
        var sql = "SELECT id, embedding FROM code_chunks WHERE id IN (".concat(placeholders, ")");
        var rows = (_a = this.db.prepare(sql)).all.apply(_a, ids);
        return rows.map(function (r) { return ({ id: r.id, embedding: new Float32Array(r.embedding.buffer) }); });
    };
    LocalCache.prototype.getAllEmbeddings = function () {
        var rows = this.db.prepare("SELECT id, embedding FROM code_chunks WHERE embedding IS NOT NULL").all();
        return rows.map(function (r) { return ({ id: r.id, embedding: new Float32Array(r.embedding.buffer) }); });
    };
    LocalCache.prototype.getChunkById = function (id) {
        var row = this.db.prepare("SELECT * FROM code_chunks WHERE id = ?").get(id);
        return row ? this.mapRowToChunk(row) : null;
    };
    LocalCache.prototype.mapRowToChunk = function (row) {
        var startPosition = { row: row.start_line, column: row.start_column };
        var endPosition = { row: row.end_line, column: row.end_column };
        var range = { start: startPosition, end: endPosition };
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
            startPosition: startPosition,
            endPosition: endPosition,
            range: range
        };
    };
    /** ---------------- Existing methods remain untouched ---------------- */
    LocalCache.prototype.findChunksByKeywords = function (keywords) {
        var _a;
        var _this = this;
        if (keywords.length === 0) {
            return [];
        }
        var conditions = keywords.map(function () { return "chunk_text LIKE '%' || ? || '%'"; }).join(' OR ');
        var sql = "SELECT * FROM code_chunks WHERE ".concat(conditions, " LIMIT 20");
        var rows = (_a = this.db.prepare(sql)).all.apply(_a, keywords);
        return rows.map(function (r) { return _this.mapRowToChunk(r); });
    };
    LocalCache.prototype.close = function () {
        this.db.close();
    };
    return LocalCache;
}());
exports.LocalCache = LocalCache;
