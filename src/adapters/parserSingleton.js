"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserSingleton = void 0;
const Parser = require("web-tree-sitter");
class ParserSingleton {
    constructor() {
        this.treeParser = null;
        this.language = null;
        this.initialized = false;
    }
    static getInstance() {
        if (!ParserSingleton.instance) {
            ParserSingleton.instance = new ParserSingleton();
        }
        return ParserSingleton.instance;
    }
    async init(context) {
        if (this.initialized) {
            return;
        }
        const runtimePath = context.asAbsolutePath("media/runtime/tree-sitter.wasm");
        const apexPath = context.asAbsolutePath("media/apex/tree-sitter-apex.wasm");
        await Parser.init({ wasmPath: runtimePath });
        this.language = await Parser.Language.load(apexPath);
        this.treeParser = new Parser();
        this.treeParser.setLanguage(this.language);
        this.initialized = true;
    }
    getParser() {
        if (!this.initialized || !this.treeParser) {
            throw new Error("ParserSingleton not initialized. Call init() first.");
        }
        return this.treeParser;
    }
    getLanguage() {
        if (!this.initialized || !this.language) {
            throw new Error("Language not initialized. Call init() first.");
        }
        return this.language;
    }
}
exports.ParserSingleton = ParserSingleton;
ParserSingleton.instance = null;
