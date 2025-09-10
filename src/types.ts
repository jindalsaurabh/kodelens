// src/types.ts
import * as vscode from "vscode";

export type PositionObject = { row: number; column: number };

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
  startPosition: PositionObject;
  endPosition: PositionObject;
  // Range is UI-specific; make it optional so parsing + DB don't depend on VS Code
  range?: vscode.Range;
}
