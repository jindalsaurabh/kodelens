// FILE: src/adapters/LanguageAdapter.ts
// Language adapter interface and shared types for adapters.

export type ChunkType = 'class' | 'method' | 'property' | 'trigger' | 'other';

export type Chunk = {
  id: string; // stable hash
  type: ChunkType;
  symbolName?: string;
  filePath: string;
  startLine: number;
  endLine: number;
  normalizedText: string;
  originalText: string;
  dependencies?: Array<{ type: string; name: string }>; // e.g. {type: 'SObject', name: 'Account'}
  createdAt?: number;
};

export type SymbolKind = 'class' | 'method' | 'field' | 'trigger' | 'variable' | 'other';

export type SymbolDescriptor = {
  id: string;
  name: string;
  kind: SymbolKind;
  filePath: string;
  startLine: number;
  endLine: number;
  metadata?: Record<string, any>;
};

export type Edge = {
  fromId: string;
  toId: string;
  type: string; // e.g. 'calls', 'reads', 'writes', 'queries'
  metadata?: Record<string, any>;
};

export type ParseResult = {
  chunks: Chunk[];
  symbols: SymbolDescriptor[];
  edges: Edge[];
  parseError?: boolean;
  errorMessage?: string;
};

export interface LanguageAdapter {
  init(workspaceRoot: string): Promise<void> | void;
  supportedFileGlobs(): string[]; // e.g. ["**/*.cls", "**/*.trigger"]
  parseAndExtract(filePath: string, text: string): Promise<ParseResult> | ParseResult;
  dispose(): Promise<void> | void;
}

