// src/utils/queryExpansion.ts
const salesforceSynonyms: Record<string, string[]> = {
    // CRUD Operations
    "create": ["create", "insert", "new", "add"],
    "read": ["read", "get", "fetch", "query", "retrieve", "SOQL"],
    "update": ["update", "modify", "change", "edit"],
    "delete": ["delete", "remove", "erase", "destroy"],
    
    // Salesforce Objects
    "account": ["account", "business account", "customer"],
    "contact": ["contact", "person", "individual"],
    "opportunity": ["opportunity", "deal", "sale"],
    
    // Apex Patterns
    "trigger": ["trigger", "automation", "before insert", "after update"],
    "batch": ["batch", "async", "large data"],
    "test": ["test", "unit test", "test method", "@isTest"],
    
    // Business Concepts
    "payment": ["payment", "transaction", "billing", "invoice"],
    "customer": ["customer", "client", "account", "user"],
    "process": ["process", "handler", "service", "manager"]
};

export function expandQuery(query: string): string {
    const words = query.toLowerCase().split(/\s+/);
    const expanded = new Set<string>();
    
    for (const word of words) {
        if (word.length < 3) {continue;}
        
        expanded.add(word);
        
        // Add synonyms
        if (salesforceSynonyms[word]) {
            salesforceSynonyms[word].forEach(syn => expanded.add(syn));
        }
        
        // Add common variations
        if (word.endsWith('s')) {expanded.add(word.slice(0, -1));}
        if (word.endsWith('ing')) {expanded.add(word.slice(0, -3));}
    }
    
    return Array.from(expanded).join(' ');
}