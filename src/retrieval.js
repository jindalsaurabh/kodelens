"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticRetrievalService = void 0;
exports.findRelevantChunks = findRelevantChunks;
//src/retrieval.ts
var database_1 = require("./database");
/**
 * ---------------------------
 * Existing keyword-based retrieval
 * ---------------------------
 */
function findRelevantChunks(question, cache) {
    return __awaiter(this, void 0, void 0, function () {
        var keywords, relevantChunks;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    keywords = extractKeywords(question);
                    console.log('Extracted keywords:', keywords);
                    if (keywords.length === 0) {
                        return [2 /*return*/, []];
                    }
                    return [4 /*yield*/, cache.findChunksByKeywords(keywords)];
                case 1:
                    relevantChunks = _a.sent();
                    console.log('Chunks found from DB:', relevantChunks);
                    relevantChunks.sort(function (a, b) { return calculateScore(b, keywords) - calculateScore(a, keywords); });
                    return [2 /*return*/, relevantChunks.slice(0, 5)];
            }
        });
    });
}
function extractKeywords(question) {
    var stopWords = new Set(['how', 'do', 'i', 'a', 'the', 'is', 'in', 'on', 'with']);
    return question.toLowerCase()
        .split(/\s+/)
        .filter(function (word) { return word.length > 2 && !stopWords.has(word); });
}
function calculateScore(chunk, keywords) {
    var chunkText = chunk.text.toLowerCase();
    return keywords.filter(function (keyword) { return chunkText.includes(keyword); }).length;
}
/**
 * ---------------------------
 * Semantic retrieval (optional, new)
 * ---------------------------
 */
function cosine(a, b) {
    var dot = 0, na = 0, nb = 0;
    var n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    var denom = Math.sqrt(na) * Math.sqrt(nb) || 1e-8;
    return dot / denom;
}
var SemanticRetrievalService = /** @class */ (function () {
    function SemanticRetrievalService(embeddingService, dbPathOrCache) {
        this.embeddingService = embeddingService;
        if (typeof dbPathOrCache === 'string') {
            this.cache = new database_1.LocalCache(dbPathOrCache);
            this.cache.init();
        }
        else {
            this.cache = dbPathOrCache;
        }
    }
    SemanticRetrievalService.prototype.rankCandidatesByQuery = function (query, candidateIds) {
        return __awaiter(this, void 0, void 0, function () {
            var qEmb, rows, scored, _i, rows_1, r, sim;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!candidateIds || candidateIds.length === 0) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.embeddingService.generateEmbedding(query)];
                    case 1:
                        qEmb = _a.sent();
                        rows = this.cache.getEmbeddingsByIds(candidateIds);
                        scored = [];
                        for (_i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                            r = rows_1[_i];
                            if (!r.embedding || r.embedding.length !== qEmb.length) {
                                scored.push({ id: r.id, score: 0 });
                                continue;
                            }
                            sim = cosine(qEmb, r.embedding);
                            scored.push({ id: r.id, score: sim });
                        }
                        scored.sort(function (a, b) { return b.score - a.score; });
                        return [2 /*return*/, scored];
                }
            });
        });
    };
    SemanticRetrievalService.prototype.findRelevantChunks = function (query_1, keywords_1) {
        return __awaiter(this, arguments, void 0, function (query, keywords, maxCandidates, topK) {
            var candidateChunks, candidateIds, allEmb, ranked, top, results, _i, top_1, r, chunk;
            if (maxCandidates === void 0) { maxCandidates = 200; }
            if (topK === void 0) { topK = 20; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        candidateChunks = [];
                        if (keywords && keywords.length > 0) {
                            candidateChunks = this.cache.findChunksByKeywords(keywords).slice(0, maxCandidates);
                        }
                        candidateIds = [];
                        if (candidateChunks.length > 0) {
                            candidateIds = candidateChunks.map(function (c) { return c.id; });
                        }
                        else {
                            allEmb = this.cache.getAllEmbeddings();
                            candidateIds = allEmb.slice(0, maxCandidates).map(function (r) { return r.id; });
                        }
                        return [4 /*yield*/, this.rankCandidatesByQuery(query, candidateIds)];
                    case 1:
                        ranked = _a.sent();
                        top = ranked.slice(0, topK);
                        results = [];
                        for (_i = 0, top_1 = top; _i < top_1.length; _i++) {
                            r = top_1[_i];
                            chunk = this.cache.getChunkById(r.id);
                            if (chunk) {
                                results.push({ chunk: chunk, score: r.score });
                            }
                        }
                        return [2 /*return*/, results];
                }
            });
        });
    };
    return SemanticRetrievalService;
}());
exports.SemanticRetrievalService = SemanticRetrievalService;
