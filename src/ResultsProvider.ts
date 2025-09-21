// src/ResultsProvider.ts
import * as vscode from 'vscode';
//import { CodeChunk } from './chunking';
import { CodeChunk } from './types';

/**
 * TreeDataProvider to show search results in a tree view.
 * Works with CodeChunk objects.
 */
export class ResultsProvider implements vscode.TreeDataProvider<ResultItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ResultItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private results: CodeChunk[] = [];

    /**
     * Refresh the tree view with new results
     */
    setResults(results: CodeChunk[]): void {
        this.results = results;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ResultItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ResultItem): Thenable<ResultItem[]> {
        if (element) {
            // Flat list → no children
            return Promise.resolve([]);
        } else {
            // Map CodeChunks to ResultItems
            return Promise.resolve(this.results.map(chunk => new ResultItem(chunk)));
        }
    }

    getParent(element: ResultItem): vscode.ProviderResult<ResultItem> {
        // Flat list → no parent
        return null;
    }
}

/**
 * Represents a single chunk in the tree view
 */
export class ResultItem extends vscode.TreeItem {
    constructor(public readonly chunk: CodeChunk) {
        super(chunk.name ?? "Unnamed", vscode.TreeItemCollapsibleState.None);

        this.description = `${chunk.type} • ${this.getFileBasename(chunk.filePath)}`;
        this.tooltip = this.getTooltip();

        // Clicking opens the file at the exact range
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [
                vscode.Uri.file(chunk.filePath),
                { selection: chunk.range }
            ]
        };

        this.iconPath = this.getIconPath(chunk.type ?? "unknown");

    }

    private getFileBasename(filePath: string): string {
        return filePath.split('/').pop() || filePath;
    }

    private getTooltip(): string {
//        return `${this.chunk.type} ${this.chunk.name}\n${this.chunk.filePath}\nLine ${this.chunk.startLine + 1}`;
        return `${this.chunk.type ?? "unknown"} ${this.chunk.name ?? "Unnamed"}\n` +
       `${this.chunk.filePath ?? ""}\n` +
       `Line ${(this.chunk.startLine ?? 0) + 1}`;

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
            case 'trigger':
                return new vscode.ThemeIcon('symbol-event'); // For triggers
            default:
                return new vscode.ThemeIcon('symbol-key');
        }
    }
}
