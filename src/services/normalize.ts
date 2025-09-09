/**
 * Normalize Apex code so that hashing & chunking
 * remain stable across whitespace or comment changes.
 */
export function normalizeCode(input: string): string {
  if (!input) {return "";}

  // Normalize line endings
  let s = input.replace(/\r\n/g, "\n");

  // Remove block comments /* ... */
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");

  // Remove line comments // ...
  s = s.replace(/\/\/.*$/gm, "");

  // Collapse multiple spaces/tabs
  s = s.replace(/[ \t]+/g, " ");

  // Trim each line & remove empty ones
  s = s
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");

  return s;
}
