// src/types.ts
export interface Point {
  row: number;
  column: number;
}

export interface SimpleRange {
  start: Point;
  end: Point;
}

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
