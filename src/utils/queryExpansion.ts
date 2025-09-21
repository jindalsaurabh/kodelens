// src/utils/queryExpansion.ts
const synonymMap: Record<string, string[]> = {
  "merge": ["merge", "combine", "consolidate", "join"],
  "account": ["account", "profile", "user account"],
  "delete": ["delete", "remove", "erase"]
};

export function expandQuery(query: string): string {
  const words = query.toLowerCase().split(/\s+/);
  const expanded: string[] = [];

  for (const w of words) {
    expanded.push(w);
    if (synonymMap[w]) {expanded.push(...synonymMap[w]);}
  }

  return expanded.join(" ");
}
