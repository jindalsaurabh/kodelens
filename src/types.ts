// src/types.ts
export interface Point {
  row: number;
  column: number;
}

export interface SimpleRange {
  start: Point;
  end: Point;
}

/*
export interface CodeChunk {
  id: string;
  hash: string;
  filePath: string;
  type: string;
  name: string;
  code: string;
  text: string;
  startLine: number;
  endLine: number;
  startPosition: Point;
  endPosition: Point;
  range: SimpleRange;
}
*/

export interface CodeChunk {
  id?: string;
  hash?: string;
  filePath: string;
  type?: string;
  name?: string;
  code?: string;
  text: string;
  startLine?: number;
  endLine?: number;
  startPosition?: { row: number; column: number };
  endPosition?: { row: number; column: number };
  range?: { start: { row: number; column: number }; end: { row: number; column: number } };
  embedding?: Float32Array; // ✅ new
}

