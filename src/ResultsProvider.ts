// src/ResultsProvider.ts
import * as vscode from 'vscode';
import { CodeSymbol } from './CodeIndexer';


export class ResultsProvider implements vscode.TreeDataProvider<ResultItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ResultItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private results: CodeSymbol[] = [];

    refresh(results: CodeSymbol[]): void {
        this.results = results;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ResultItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ResultItem): Thenable<ResultItem[]> {
        if (element) {
            // If we had nested items, they would go here
            return Promise.resolve([]);
        } else {
            // Return the main results
            return Promise.resolve(this.results.map(symbol => new ResultItem(symbol)));
        }
    }

    // ADD THIS METHOD TO FIX THE ERROR
    getParent(element: ResultItem): vscode.ProviderResult<ResultItem> {
        // Since we have a flat list (no hierarchy), return undefined or null
        return null;
    }
}

// Add 'export' to make this class available to other files
export class ResultItem extends vscode.TreeItem {
    constructor(public readonly symbol: CodeSymbol) {
        super(symbol.name, vscode.TreeItemCollapsibleState.None);
        
        this.description = `${symbol.type} • ${this.getFileBasename(symbol.filePath)}`;
        this.tooltip = this.getTooltip();
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(symbol.filePath), {
                selection: symbol.range
            }]
        };
        
        // Set appropriate icon based on symbol type
        this.iconPath = this.getIconPath(symbol.type);
    }

    private getFileBasename(filePath: string): string {
        return filePath.split('/').pop() || filePath;
    }

    private getTooltip(): string {
        return `${this.symbol.type} ${this.symbol.name}\n${this.symbol.filePath}\nLine ${this.symbol.range.start.line + 1}`;
    }

    private getIconPath(type: string): vscode.ThemeIcon {
        switch (type) {
            case 'class':
                return new vscode.ThemeIcon('symbol-class');
            case 'method':
                return new vscode.ThemeIcon('symbol-method');
            case 'interface':
                return new vscode.ThemeIcon('symbol-interface');
            case 'property':
                return new vscode.ThemeIcon('symbol-property');
            case 'variable':
                return new vscode.ThemeIcon('symbol-variable');
            default:
                return new vscode.ThemeIcon('symbol-key');
        }
    }
}