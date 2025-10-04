// src/types/search.ts
export interface SearchResult {
    id: string;
    filePath: string;
    fileName: string;
    type: 'class' | 'method' | 'trigger' | 'property' | 'interface' | 'enum' | 'file';
    name: string;
    snippet: string;
    score: number;
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
}

export interface SearchFilters {
    fileTypes: ('class' | 'method' | 'trigger' | 'property')[];
    minScore: number;
    maxResults: number;
}

export interface SearchHistoryItem {
    query: string;
    timestamp: Date;
    resultCount: number;
    filters?: SearchFilters;
}