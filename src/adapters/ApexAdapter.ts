// -----------------------------------------------------------------------------
// FILE: src/adapters/ApexAdapter.ts
// ApexAdapter: implements LanguageAdapter by wrapping parserSingleton and providing
// a minimal parseAndExtract that returns ParseResult. This is a skeleton to be
// expanded in subsequent phases (chunking, edge extraction, etc.).

import { LanguageAdapter, ParseResult, Chunk, SymbolDescriptor, Edge } from './LanguageAdapter';
import { getOrCreateParser } from './parserSingleton';
import { logError, logInfo } from '../utils/logger';
import * as vscode from 'vscode';

export class ApexAdapter implements LanguageAdapter {
  workspaceRoot: string;
  parserWrapper: any | null = null;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  supportedFileGlobs(): string[] {
    return ['**/*.cls', '**/*.trigger'];
  }

  async init(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot || this.workspaceRoot;
    this.parserWrapper = getOrCreateParser(this.workspaceRoot, 'apex');
    try {
      await this.parserWrapper.init();
    } catch (err: any) {
      // Initialization failed — surface a user-friendly VS Code message but don't throw.
      const msg = `KodeLens: Failed to initialize Apex parser: ${err?.message || err}`;
      logError(msg);
      vscode.window.showWarningMessage(msg);
    }
  }

  async parseAndExtract(filePath: string, text: string) {
    const result: ParseResult = { chunks: [], symbols: [], edges: [] };
    if (!this.parserWrapper) {
      const msg = 'ApexAdapter: parser not initialized';
      logError(msg);
      result.parseError = true;
      result.errorMessage = msg;
      return result;
    }

    try {
      const tree = await this.parserWrapper.parse(text);
      // Minimal extraction: create a single chunk that is the entire file.
      // Later phases will walk the AST and extract classes/methods/fields/triggers.
      const chunk = this._fileLevelChunk(filePath, text);
      result.chunks.push(chunk);

      // Symbol extraction placeholder: adapters should populate real symbols from AST.
      // We include a file-level symbol as a starter.
      const fileSymbol: SymbolDescriptor = {
        id: `${filePath}::file`,
        name: filePath.split('/').pop() || filePath,
        kind: 'other',
        filePath,
        startLine: 1,
        endLine: Math.max(1, (text.match(/\n/g) || []).length + 1),
        metadata: {},
      };
      result.symbols.push(fileSymbol);

      // No edges yet — later phases will extract call reads/writes/queries from AST.

      return result;
    } catch (err: any) {
      const msg = `ApexAdapter.parseAndExtract: parse error in ${filePath}: ${err?.message || err}`;
      logError(msg);
      // Non-intrusive user notification
      vscode.window.showWarningMessage(`KodeLens: Parse error in ${filePath}. See output for details.`);
      result.parseError = true;
      result.errorMessage = err?.message || String(err);
      return result;
    }
  }

  _fileLevelChunk(filePath: string, text: string): Chunk {
    return {
      id: `${filePath}::1-${Math.max(1, (text.match(/\n/g) || []).length + 1)}`,
      type: 'other',
      filePath,
      startLine: 1,
      endLine: Math.max(1, (text.match(/\n/g) || []).length + 1),
      normalizedText: text,
      originalText: text,
      createdAt: Date.now(),
    };
  }

  async dispose() {
    // adapters can clean up resources here. Parser lifecycle is managed by parserSingleton.
    this.parserWrapper = null;
    logInfo('ApexAdapter disposed');
  }
}

