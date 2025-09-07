// src/CodeIndexer.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { initializeParser } from './parser';

export interface CodeSymbol {
    name: string;
    type: string; // 'class', 'method', 'property', 'variable', 'interface'
    filePath: string;
    range: vscode.Range;
    parent?: string; // parent class or namespace
}

export class CodeIndexer {
    private symbols: CodeSymbol[] = [];
    private isIndexing = false;
    private parser: any = null; // Will hold the parser instance

    // Initialize the parser (call this once at activation)
    async initialize(extensionPath: string): Promise<void> {
        try {
            this.parser = await initializeParser(extensionPath);
            console.log('Parser initialized successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize parser: ${error}`);
            throw error;
        }
    }

    // Build the index for the entire workspace
    async buildIndex(): Promise<void> {
        if (!this.parser) {
            vscode.window.showErrorMessage('Parser not initialized. Call initialize() first.');
            return;
        }

        if (this.isIndexing) {
            vscode.window.showWarningMessage('Indexing already in progress...');
            return;
        }

        this.isIndexing = true;
        const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        status.text = '$(sync~spin) KodeLens: Indexing...';
        status.show();

        try {
            this.symbols = []; // Clear previous index

            // Find all Apex files
            const files = await vscode.workspace.findFiles('**/*.cls', '**/node_modules/**');
            console.log(`Found ${files.length} Apex files to index`);
            
            for (const fileUri of files) {
                await this.indexFile(fileUri);
            }

            status.text = '$(check) KodeLens: Indexing complete';
            const stats = this.getIndexStats();
            console.log('Index stats:', stats);
            this.debugFirstFewSymbols(); // Show first few symbols for debugging
            
            vscode.window.showInformationMessage(`Indexed ${stats.totalSymbols} symbols across ${files.length} files.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Indexing failed: ${error}`);
            console.error('Indexing error:', error);
        } finally {
            this.isIndexing = false;
            setTimeout(() => status.hide(), 3000);
        }
    }

    // Index a single file
    private async indexFile(fileUri: vscode.Uri): Promise<void> {
        if (!this.parser) {
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const code = document.getText();

            // Use the pre-initialized parser
            const tree = this.parser.parse(code);
            if (!tree) {
            console.warn(`Failed to parse ${fileUri.fsPath}: parser returned null tree`);
            return;
        }
            const rootNode = tree.rootNode;
            const fileSymbols = this.extractSymbolsFromAST(rootNode, fileUri.fsPath);
            this.symbols.push(...fileSymbols);

            // DEBUG: See the AST structure for the first file only to avoid too much output
            if (this.symbols.length === 0) {
                console.log(`=== DEBUG AST for ${fileUri.fsPath} ===`);
                this.debugAST(rootNode);
                console.log('=== END DEBUG ===');
            }

            //const fileSymbols = this.extractSymbolsFromAST(rootNode, fileUri.fsPath);
            if (fileSymbols.length > 0) {
                console.log(`Indexed ${fileSymbols.length} symbols from ${path.basename(fileUri.fsPath)}`);
            }
        } catch (error) {
            console.error(`Failed to index file ${fileUri.fsPath}:`, error);
            vscode.window.showWarningMessage(
            `KodeLens: Could not parse ${path.basename(fileUri.fsPath)}. Syntax errors may affect search results.`
        );
        }
    }

    // Extract symbols from AST - Core logic for parsing Apex code structure
    private extractSymbolsFromAST(rootNode: any, filePath: string): CodeSymbol[] {
        const symbols: CodeSymbol[] = [];
        
        // Traverse the AST recursively
        const traverse = (node: any, parentName?: string) => {
            if (!node || !node.type) {
                return;
            }

            let currentSymbol: CodeSymbol | null = null;

            // Check for different types of declarations
            switch (node.type) {
                case 'class_declaration':
                case 'interface_declaration':
                    const className = this.getNodeName(node);
                    if (className) {
                        currentSymbol = {
                            name: className,
                            type: node.type === 'class_declaration' ? 'class' : 'interface',
                            filePath: filePath,
                            range: this.getRange(node),
                            parent: parentName
                        };
                        symbols.push(currentSymbol);
                        // Set this as the new parent for nested declarations
                        parentName = className;
                    }
                    break;

                case 'method_declaration':
                    const methodName = this.getNodeName(node);
                    if (methodName) {
                        currentSymbol = {
                            name: methodName,
                            type: 'method',
                            filePath: filePath,
                            range: this.getRange(node),
                            parent: parentName
                        };
                        symbols.push(currentSymbol);
                    }
                    break;

                case 'property_declaration':
                    const propertyName = this.getNodeName(node);
                    if (propertyName) {
                        currentSymbol = {
                            name: propertyName,
                            type: 'property',
                            filePath: filePath,
                            range: this.getRange(node),
                            parent: parentName
                        };
                        symbols.push(currentSymbol);
                    }
                    break;

                case 'variable_declaration':
                    const variableName = this.getNodeName(node);
                    if (variableName) {
                        currentSymbol = {
                            name: variableName,
                            type: 'variable',
                            filePath: filePath,
                            range: this.getRange(node),
                            parent: parentName
                        };
                        symbols.push(currentSymbol);
                    }
                    break;
            }

            // Recursively traverse child nodes
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    traverse(child, currentSymbol ? currentSymbol.name : parentName);
                }
            }
        };

        // Start traversal from the root node
        traverse(rootNode);
        
        return symbols;
    }

    // Helper method to extract the name from a node
    private getNodeName(node: any): string | null {
        // Look for identifier nodes in the children
        if (node.children) {
            for (const child of node.children) {
                if (child.type === 'identifier' && child.text) {
                    return child.text;
                }
                // For method declarations, we might need to look deeper
                if (child.type === 'formal_parameters' && child.previousSibling && child.previousSibling.text) {
                    return child.previousSibling.text;
                }
            }
        }
        return null;
    }

    // Helper method to convert tree-sitter range to VS Code range
    private getRange(node: any): vscode.Range {
        return new vscode.Range(
            node.startPosition.row,
            node.startPosition.column,
            node.endPosition.row,
            node.endPosition.column
        );
    }

    // Find references to a specific symbol - WITH DEBUGGING
    findReferences(symbolName: string): CodeSymbol[] {
        console.log(`Searching for references to: "${symbolName}"`);
        
        const results: CodeSymbol[] = [];
        const exactMatches: CodeSymbol[] = [];
        const partialMatches: CodeSymbol[] = [];
        
        // Convert to lowercase for case-insensitive search
        const searchTerm = symbolName.toLowerCase();
        
        for (const symbol of this.symbols) {
            const symbolNameLower = symbol.name.toLowerCase();
            
            if (symbolNameLower === searchTerm) {
                exactMatches.push(symbol);
            } else if (symbolNameLower.includes(searchTerm)) {
                partialMatches.push(symbol);
            }
        }
        
        console.log(`Found ${exactMatches.length} exact matches and ${partialMatches.length} partial matches`);
        
        // Log the first few matches for debugging
        if (exactMatches.length > 0) {
            console.log('Exact matches:', exactMatches.slice(0, 3).map(s => `${s.type} "${s.name}"`));
        }
        if (partialMatches.length > 0) {
            console.log('Partial matches:', partialMatches.slice(0, 3).map(s => `${s.type} "${s.name}"`));
        }
        
        // Return exact matches first, then partial matches
        return [...exactMatches, ...partialMatches];
    }

    // Get statistics about the index
    getIndexStats(): { totalSymbols: number; byType: Record<string, number> } {
        const byType: Record<string, number> = {};
        
        for (const symbol of this.symbols) {
            byType[symbol.type] = (byType[symbol.type] || 0) + 1;
        }
        
        return {
            totalSymbols: this.symbols.length,
            byType
        };
    }

    // Get all symbols of a specific type
    getSymbolsByType(type: string): CodeSymbol[] {
        return this.symbols.filter(symbol => symbol.type === type);
    }

    // Clear the index
    clearIndex(): void {
        this.symbols = [];
    }

    // Check if indexing is in progress
    isCurrentlyIndexing(): boolean {
        return this.isIndexing;
    }

    // Get the total number of symbols in index
    getTotalSymbols(): number {
        return this.symbols.length;
    }

    // Add the debug method to help with AST exploration
    private debugAST(node: any, depth: number = 0): void {
        const indent = '  '.repeat(depth);
        console.log(`${indent}${node.type}: "${node.text?.substring(0, 50)}"`);
        
        if (node.children && depth < 3) { // Limit depth to avoid too much output
            for (const child of node.children) {
                this.debugAST(child, depth + 1);
            }
        }
    }

    // Debug method to see what symbols we've extracted
    private debugFirstFewSymbols(): void {
        console.log('=== FIRST 20 SYMBOLS IN INDEX ===');
        for (let i = 0; i < Math.min(20, this.symbols.length); i++) {
            const symbol = this.symbols[i];
            console.log(`${symbol.type} "${symbol.name}" in ${path.basename(symbol.filePath)}`);
        }
        console.log('=== END DEBUG ===');
    }
}