// src/services/normalize.ts
import { CodeChunk, Point, SimpleRange } from "../types";

const toStr = (v: any): string => {
  if (typeof v === "string") {return v;}
  if (v === null || v === undefined) {return "";}
  return String(v);
};

const toInt = (v: any): number => {
  if (typeof v === "number" && !isNaN(v)) {return v;}
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
    return Number(v);
  }
  return 0;
};

const toPoint = (v: any): Point => {
  if (v && typeof v.row === "number" && typeof v.column === "number") {
    return { row: v.row, column: v.column };
  }
  return { row: 0, column: 0 };
};

const toRange = (v: any): SimpleRange => {
  if (v && v.start && v.end) {
    return {
      start: toPoint(v.start),
      end: toPoint(v.end),
    };
  }
  return {
    start: { row: 0, column: 0 },
    end: { row: 0, column: 0 },
  };
};

export const normalizeChunk = (raw: any): CodeChunk => {
  return {
    id: toStr(raw.id),
    hash: toStr(raw.hash),
    filePath: toStr(raw.filePath),
    type: toStr(raw.type),
    name: toStr(raw.name),
    code: toStr(raw.code),
    text: toStr(raw.text),
    startLine: toInt(raw.startLine),
    endLine: toInt(raw.endLine),
    startPosition: toPoint(raw.startPosition),
    endPosition: toPoint(raw.endPosition),
    range: toRange(raw.range),
  };
};

// src/services/normalize.ts
export const normalizeCode = (source: string): string => {
  // Example: remove trailing whitespace, normalize line endings
  return source.replace(/\r\n/g, "\n").trim();
};

