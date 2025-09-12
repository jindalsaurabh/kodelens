// src/services/normalizeHelpers.ts
export function safeParseJSON(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
