// src/webview/searchResultsPanel.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { SearchResult, SearchHistoryItem } from '../types/search';

/**
 * Modern webview panel for displaying semantic search results
 */
export class SearchResultsPanel {
    public static currentPanel: SearchResultsPanel | undefined;
    private static readonly viewType = 'kodelensSearchResults';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];
    private searchResults: SearchResult[] = [];
    private currentQuery: string = '';

    public static createOrShow(
        extensionUri: vscode.Uri,
        results: SearchResult[],
        query: string = ''
    ): SearchResultsPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (SearchResultsPanel.currentPanel) {
            SearchResultsPanel.currentPanel.panel.reveal(column);
            SearchResultsPanel.currentPanel.update(results, query);
            return SearchResultsPanel.currentPanel;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            SearchResultsPanel.viewType,
            '🔍 Kodelens Search Results',
            column || vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        SearchResultsPanel.currentPanel = new SearchResultsPanel(panel, extensionUri, results, query);
        return SearchResultsPanel.currentPanel;
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        results: SearchResult[],
        query: string
    ) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.searchResults = results;
        this.currentQuery = query;

        // Set the webview's initial html content
        this.update(results, query);

        // Listen for when the panel is disposed
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleWebviewMessage(message);
            },
            null,
            this.disposables
        );

        // Update when configuration changes
        this.panel.onDidChangeViewState(
            () => {
                if (this.panel.visible) {
                    this.update(this.searchResults, this.currentQuery);
                }
            },
            null,
            this.disposables
        );
    }

    public update(results: SearchResult[], query: string = ''): void {
        this.searchResults = results;
        this.currentQuery = query;
        
        this.panel.webview.html = this.getHtmlForWebview();
        this.panel.title = `🔍 Kodelens ${query ? `- "${query}"` : 'Search Results'}`;
    }

    private async handleWebviewMessage(message: any): Promise<void> {
    switch (message.command) {
        case 'openFile':
            await this.openFileAtLocation(message.filePath, message.line, message.column);
            break;
        case 'explainCode':
            // Pass the code directly to the explain command
            await vscode.commands.executeCommand('kodelens.explainCode', message.code);
            break;
        case 'copySnippet':
            await vscode.env.clipboard.writeText(message.code);
            vscode.window.showInformationMessage('Code snippet copied to clipboard!');
            break;
        case 'exportResults':
            await this.exportResultsToMarkdown();
            break;
        case 'rerunSearch':
            await this.rerunSearch(message.query);
            break;
    }
}

    private async openFileAtLocation(filePath: string, line: number, column: number = 0): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const editor = await vscode.window.showTextDocument(document);
            
            // Highlight the specific line
            const position = new vscode.Position(line, column);
            const selection = new vscode.Selection(position, position);
            editor.selection = selection;
            
            // Reveal the line in the editor
            editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
        } catch (error) {
            vscode.window.showErrorMessage(`Could not open file: ${filePath}`);
        }
    }

    private async explainCode(filePath: string, code: string): Promise<void> {
        // Use your existing explain code command
        await vscode.commands.executeCommand('kodelens.explainCodeFromText', code);
    }

    private async exportResultsToMarkdown(): Promise<void> {
        const content = this.generateMarkdownExport();
        const document = await vscode.workspace.openTextDocument({
            content: content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(document);
    }

    /*
    private async rerunSearch(query: string): Promise<void> {
        await vscode.commands.executeCommand('kodelens.semanticSearch', query);
    } */

   private async rerunSearch(query: string): Promise<void> {
    try {
        // Close the current results panel
        this.dispose();
        
        // Small delay to ensure panel is closed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Execute search with the pre-filled query
        await vscode.commands.executeCommand('kodelens.askQuestion', query);
        
    } catch (error) {
        console.error('Failed to rerun search:', error);
        // Fallback: show input manually
        const newQuery = await vscode.window.showInputBox({
            prompt: 'Search Apex code',
            value: query,
            placeHolder: 'Press Enter to search again...'
        });
        
        if (newQuery) {
            await vscode.commands.executeCommand('kodelens.askQuestion', newQuery);
        }
    }
}  

    private generateMarkdownExport(): string {
        const timestamp = new Date().toLocaleString();
        let markdown = `# Kodelens Search Results\n\n`;
        markdown += `**Query:** ${this.currentQuery || 'No query'}\n`;
        markdown += `**Date:** ${timestamp}\n`;
        markdown += `**Results:** ${this.searchResults.length}\n\n`;
        markdown += `---\n\n`;

        this.searchResults.forEach((result, index) => {
            markdown += `## ${index + 1}. ${result.name}\n\n`;
            markdown += `**File:** ${result.filePath}  \n`;
            markdown += `**Type:** ${result.type}  \n`;
            markdown += `**Score:** ${Math.round(result.score * 100)}%  \n`;
            markdown += `**Lines:** ${result.startLine + 1}-${result.endLine + 1}\n\n`;
            markdown += `\`\`\`apex\n${result.snippet}\n\`\`\`\n\n`;
            markdown += `---\n\n`;
        });

        return markdown;
    }

    private getHtmlForWebview(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Kodelens Search Results</title>
                <style>
                    ${this.getStyles()}
                </style>
            </head>
            <body>
                <div class="container">
                    <header class="results-header">
                        <div class="header-main">
                            <h1>🔍 Semantic Search Results</h1>
                            <div class="header-actions">
                                <button class="btn btn-secondary" id="exportBtn">
                                    📥 Export Markdown
                                </button>
                                ${this.currentQuery ? `
                                <button class="btn btn-primary" id="rerunBtn">
                                    🔄 Search "${this.escapeHtml(this.currentQuery)}" Again
                                </button>
                                ` : ''}
                            </div>
                        </div>
                        <div class="results-meta">
                            <span class="result-count">${this.searchResults.length} matches</span>
                            ${this.currentQuery ? `
                            <span class="search-query">for "${this.escapeHtml(this.currentQuery)}"</span>
                            ` : ''}
                        </div>
                    </header>

                    <main class="results-main">
                        ${this.searchResults.length === 0 ? `
                            <div class="empty-state">
                                <div class="empty-icon">🔍</div>
                                <h3>No results found</h3>
                                <p>Try adjusting your search query or filters</p>
                            </div>
                        ` : `
                            <div class="results-list">
                                ${this.searchResults.map((result, index) => this.getResultHtml(result, index)).join('')}
                            </div>
                        `}
                    </main>
                </div>

                <script>
                    ${this.getScript()}
                </script>
            </body>
            </html>
        `;
    }

    private getResultHtml(result: SearchResult, index: number): string {
        const scorePercent = Math.round(result.score * 100);
        const scoreColor = this.getScoreColor(result.score);
        
        return `
            <div class="result-item" data-index="${index}">
                <div class="result-header">
                    <div class="result-meta">
                        <span class="file-icon">${this.getFileIcon(result.type)}</span>
                        <span class="file-name">${this.escapeHtml(result.fileName)}</span>
                        <span class="result-type">${result.type}</span>
                    </div>
                    <div class="result-score">
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${scorePercent}%; background: ${scoreColor};"></div>
                        </div>
                        <span class="score-text">${scorePercent}%</span>
                    </div>
                </div>
                
                <div class="result-content">
                    <h3 class="result-title">${this.escapeHtml(result.name)}</h3>
                    <pre class="code-preview">${this.escapeHtml(result.snippet)}</pre>
                </div>
                
                <div class="result-footer">
                    <div class="file-location">
                        ${path.basename(result.filePath)} • Lines ${result.startLine + 1}-${result.endLine + 1}
                    </div>
                    <div class="result-actions">
                        <button class="btn-action btn-open" 
                                data-file="${this.escapeHtml(result.filePath)}" 
                                data-line="${result.startLine}"
                                data-column="${result.startColumn || 0}"
                                title="Open File">
                            📂 Open
                        </button>
                        <button class="btn-action btn-explain" 
                                data-file="${this.escapeHtml(result.filePath)}"
                                data-code="${this.escapeHtml(result.snippet)}"
                                title="Explain Code">
                            🧠 Explain
                        </button>
                        <button class="btn-action btn-copy" 
                                data-code="${this.escapeHtml(result.snippet)}"
                                title="Copy Code">
                            📋 Copy
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    private getScoreColor(score: number): string {
        if (score >= 0.8) {return '#4CAF50';} // Green
        if (score >= 0.6) {return '#FF9800';} // Orange
        return '#F44336'; // Red
    }

    private getFileIcon(type: string): string {
        const icons: { [key: string]: string } = {
            'class': '📦',
            'method': '⚙️',
            'trigger': '⚡',
            'property': '📝',
            'interface': '🔌',
            'enum': '🔢',
            'file': '📄'
        };
        return icons[type] || '📄';
    }

    private getStyles(): string {
        return `
            :root {
                --border-radius: 6px;
                --spacing-sm: 8px;
                --spacing-md: 12px;
                --spacing-lg: 16px;
                --spacing-xl: 24px;
            }

            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background: var(--vscode-editor-background);
                line-height: 1.5;
                padding: 0;
            }

            .container {
                max-width: 100%;
                margin: 0 auto;
                min-height: 100vh;
            }

            /* Header Styles */
            .results-header {
                background: var(--vscode-titleBar-activeBackground);
                border-bottom: 1px solid var(--vscode-panel-border);
                padding: var(--spacing-md) var(--spacing-lg);
                position: sticky;
                top: 0;
                z-index: 100;
            }

            .header-main {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: var(--spacing-sm);
            }

            .results-header h1 {
                color: var(--vscode-textLink-foreground);
                font-size: 1.3em;
                font-weight: 600;
                margin: 0;
            }

            .header-actions {
                display: flex;
                gap: var(--spacing-sm);
            }

            .results-meta {
                display: flex;
                gap: var(--spacing-md);
                font-size: 0.9em;
                color: var(--vscode-descriptionForeground);
            }

            .result-count {
                font-weight: 600;
            }

            .search-query {
                font-style: italic;
            }

            /* Main Content */
            .results-main {
                padding: var(--spacing-lg);
            }

            /* Empty State */
            .empty-state {
                text-align: center;
                padding: var(--spacing-xl) var(--spacing-lg);
                color: var(--vscode-descriptionForeground);
            }

            .empty-icon {
                font-size: 3em;
                margin-bottom: var(--spacing-md);
            }

            .empty-state h3 {
                margin-bottom: var(--spacing-sm);
                color: var(--vscode-foreground);
            }

            /* Result Items */
            .results-list {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-md);
            }

            .result-item {
                background: var(--vscode-editorWidget-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: var(--border-radius);
                padding: var(--spacing-lg);
                transition: all 0.2s ease;
            }

            .result-item:hover {
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }

            .result-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: var(--spacing-md);
            }

            .result-meta {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                font-size: 0.9em;
            }

            .file-icon {
                font-size: 1.1em;
            }

            .file-name {
                font-weight: 600;
                color: var(--vscode-foreground);
            }

            .result-type {
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 0.8em;
                text-transform: capitalize;
            }

            .result-score {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
            }

            .score-bar {
                width: 60px;
                height: 6px;
                background: var(--vscode-input-background);
                border-radius: 3px;
                overflow: hidden;
            }

            .score-fill {
                height: 100%;
                border-radius: 3px;
                transition: width 0.3s ease;
            }

            .score-text {
                font-size: 0.8em;
                font-weight: 600;
                min-width: 30px;
                text-align: right;
            }

            .result-content {
                margin-bottom: var(--spacing-md);
            }

            .result-title {
                font-size: 1.1em;
                font-weight: 600;
                margin-bottom: var(--spacing-sm);
                color: var(--vscode-foreground);
            }

            .code-preview {
                background: var(--vscode-textCodeBlock-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                padding: var(--spacing-md);
                font-family: var(--vscode-editor-font-family);
                font-size: 0.85em;
                line-height: 1.4;
                overflow-x: auto;
                white-space: pre-wrap;
                max-height: 150px;
                overflow-y: auto;
            }

            .result-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.85em;
            }

            .file-location {
                color: var(--vscode-descriptionForeground);
                font-family: monospace;
            }

            .result-actions {
                display: flex;
                gap: var(--spacing-sm);
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .result-item:hover .result-actions {
                opacity: 1;
            }

            /* Buttons */
            .btn {
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 0.85em;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .btn-primary {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }

            .btn-primary:hover {
                background: var(--vscode-button-hoverBackground);
            }

            .btn-secondary {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }

            .btn-secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground);
            }

            .btn-action {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                font-size: 0.8em;
                cursor: pointer;
                transition: background 0.2s ease;
            }

            .btn-action:hover {
                background: var(--vscode-button-hoverBackground);
            }

            @media (max-width: 768px) {
                .header-main {
                    flex-direction: column;
                    gap: var(--spacing-md);
                    align-items: flex-start;
                }

                .header-actions {
                    width: 100%;
                    justify-content: flex-end;
                }

                .result-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: var(--spacing-sm);
                }

                .result-footer {
                    flex-direction: column;
                    gap: var(--spacing-md);
                    align-items: flex-start;
                }

                .result-actions {
                    opacity: 1;
                }
            }
        `;
    }

private getScript(): string {
    return `
        (function() {
            const vscode = acquireVsCodeApi();
            
            // Handle export button
            document.getElementById('exportBtn')?.addEventListener('click', () => {
                vscode.postMessage({ command: 'exportResults' });
            });
            
            // Handle rerun search button
            document.getElementById('rerunBtn')?.addEventListener('click', () => {
                vscode.postMessage({ 
                    command: 'rerunSearch', 
                    query: '${this.escapeHtml(this.currentQuery)}' 
                });
            });
            
            // Handle result item actions
            document.querySelectorAll('.btn-open').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const filePath = btn.getAttribute('data-file');
                    const line = parseInt(btn.getAttribute('data-line'));
                    const column = parseInt(btn.getAttribute('data-column'));
                    vscode.postMessage({ 
                        command: 'openFile', 
                        filePath: filePath, 
                        line: line, 
                        column: column 
                    });
                });
            });
            
            document.querySelectorAll('.btn-explain').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const code = btn.getAttribute('data-code');
                    vscode.postMessage({ 
                        command: 'explainCode', 
                        code: code 
                    });
                });
            });
            
            document.querySelectorAll('.btn-copy').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const code = btn.getAttribute('data-code');
                    vscode.postMessage({ 
                        command: 'copySnippet', 
                        code: code 
                    });
                });
            });
            
            // Make entire result item clickable to open file
            document.querySelectorAll('.result-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    // Only trigger if not clicking a button
                    if (!e.target.closest('.btn-action')) {
                        const btn = item.querySelector('.btn-open');
                        if (btn) {
                            const filePath = btn.getAttribute('data-file');
                            const line = parseInt(btn.getAttribute('data-line'));
                            const column = parseInt(btn.getAttribute('data-column'));
                            vscode.postMessage({ 
                                command: 'openFile', 
                                filePath: filePath, 
                                line: line, 
                                column: column 
                            });
                        }
                    }
                });
            });
        })();
    `;
}

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    public dispose(): void {
        SearchResultsPanel.currentPanel = undefined;

        // Clean up our resources
        this.panel.dispose();

        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}