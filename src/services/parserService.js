"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initParserForWorkspace = initParserForWorkspace;
exports.safeParse = safeParse;
// src/services/parserService.ts
const vscode = __importStar(require("vscode"));
const parserSingleton_1 = require("../adapters/parserSingleton");
let initialized = false;
/**
 * Initialize parser for the whole workspace.
 * Should be called once during extension activation.
 */
async function initParserForWorkspace(workspaceRoot, context) {
    if (initialized) {
        return;
    }
    try {
        const parser = parserSingleton_1.ParserSingleton.getInstance();
        await parser.init(context);
        initialized = true;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown parser initialization error";
        vscode.window.showErrorMessage(`Parser init failed: ${msg}`);
        throw err;
    }
}
/**
 * Safe parse helper.
 * Returns a tree or null if parsing fails.
 */
async function safeParse(workspaceRoot, context, sourceCode) {
    try {
        if (!initialized) {
            await initParserForWorkspace(workspaceRoot, context);
        }
        const parser = parserSingleton_1.ParserSingleton.getInstance().getParser();
        return parser.parse(sourceCode);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Parse failed: ${msg}`);
        return null;
    }
}
