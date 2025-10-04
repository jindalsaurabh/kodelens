// src/webview/referencesPanel.ts
import * as vscode from 'vscode';
import * as path from 'path';

// Interface for reference results
export interface ReferenceResult {
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
    referenceType: 'declaration' | 'usage' | 'implementation';
}

/**
 * Specialized panel for showing code references with semantic search
 */
export class ReferencesPanel {
    public static currentPanel: ReferencesPanel | undefined;
    private static readonly viewType = 'kodelensReferences';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];
    private referenceResults: ReferenceResult[] = [];
    private symbolName: string = '';

    public static createOrShow(
        extensionUri: vscode.Uri,
        results: ReferenceResult[],
        symbolName: string
    ): ReferencesPanel {
        const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.Beside;

        // If we already have a panel, show it
        if (ReferencesPanel.currentPanel) {
            ReferencesPanel.currentPanel.panel.reveal(column);
            ReferencesPanel.currentPanel.update(results, symbolName);
            return ReferencesPanel.currentPanel;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            ReferencesPanel.viewType,
            `🔗 References to ${symbolName}`,
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        ReferencesPanel.currentPanel = new ReferencesPanel(panel, extensionUri, results, symbolName);
        return ReferencesPanel.currentPanel;
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        results: ReferenceResult[],
        symbolName: string
    ) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.referenceResults = results;
        this.symbolName = symbolName;

        // Set the webview's initial html content
        this.update(results, symbolName);

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
                    this.update(this.referenceResults, this.symbolName);
                }
            },
            null,
            this.disposables
        );
    }

    public update(results: ReferenceResult[], symbolName: string = ''): void {
        this.referenceResults = results;
        this.symbolName = symbolName;
        
        this.panel.webview.html = this.getHtmlForWebview();
        this.panel.title = `🔗 References to ${symbolName}`;
    }

private async handleWebviewMessage(message: any): Promise<void> {
    switch (message.command) {
        case 'openFile':
            await this.openFileAtLocation(message.filePath, message.line, message.column);
            break;
        case 'explainCode':
            await this.explainCode(message.filePath, message.code);
            break;
        case 'copySnippet':
            await vscode.env.clipboard.writeText(message.code);
            vscode.window.showInformationMessage('Code snippet copied to clipboard!');
            break;
        case 'exportResults':
            await this.exportResultsToMarkdown();
            break;
        // REMOVED: findMoreReferences case
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
        // Use the direct explain command that accepts code as parameter
        await vscode.commands.executeCommand('kodelens.explainCode', code);
    }

    private async exportResultsToMarkdown(): Promise<void> {
        const content = this.generateMarkdownExport();
        const document = await vscode.workspace.openTextDocument({
            content: content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(document);
    }

    // Update the findMoreReferences method
private async findMoreReferences(symbolName: string): Promise<void> {
    try {
        // Close the current panel first
        this.dispose();
        
        // Small delay to ensure panel is closed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Execute the find references command
        await vscode.commands.executeCommand('kodelens.findReferences');
        
    } catch (error) {
        console.error('Failed to find more references:', error);
        // Fallback: show information message
        vscode.window.showInformationMessage(
            `Place your cursor on a symbol and run "Find References" again`,
            "Run Find References"
        ).then(selection => {
            if (selection === "Run Find References") {
                vscode.commands.executeCommand('kodelens.findReferences');
            }
        });
    }
}

    private generateMarkdownExport(): string {
        const timestamp = new Date().toLocaleString();
        let markdown = `# Kodelens Reference Search Results\n\n`;
        markdown += `**Symbol:** ${this.symbolName}\n`;
        markdown += `**Date:** ${timestamp}\n`;
        markdown += `**References Found:** ${this.referenceResults.length}\n`;
        markdown += `**Search Type:** Semantic (AI-powered)\n\n`;
        markdown += `---\n\n`;

        // Group by reference type
        const byType = this.referenceResults.reduce((acc, result) => {
            if (!acc[result.referenceType]) {acc[result.referenceType] = [];}
            acc[result.referenceType].push(result);
            return acc;
        }, {} as Record<string, ReferenceResult[]>);

        Object.entries(byType).forEach(([type, results]) => {
            markdown += `## ${type.charAt(0).toUpperCase() + type.slice(1)} References (${results.length})\n\n`;
            
            results.forEach((result, index) => {
                markdown += `### ${index + 1}. ${result.name}\n\n`;
                markdown += `**File:** ${result.filePath}  \n`;
                markdown += `**Type:** ${result.type}  \n`;
                markdown += `**Reference Type:** ${result.referenceType}  \n`;
                markdown += `**Semantic Score:** ${Math.round(result.score * 100)}%  \n`;
                markdown += `**Lines:** ${result.startLine + 1}-${result.endLine + 1}\n\n`;
                markdown += `\`\`\`apex\n${result.snippet}\n\`\`\`\n\n`;
                markdown += `---\n\n`;
            });
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
            <title>Kodelens References</title>
            <style>
                ${this.getStyles()}
            </style>
        </head>
        <body>
            <div class="container">
                <header class="references-header">
                    <div class="header-main">
                        <h1>🔗 Semantic References</h1>
                        <div class="header-actions">
                            <button class="btn btn-secondary" id="exportBtn">
                                📥 Export Markdown
                            </button>
                            <!-- REMOVED: Find More References button -->
                        </div>
                    </div>
                    <div class="references-meta">
                        <span class="result-count">${this.referenceResults.length} semantic references</span>
                        <span class="symbol-name">for <strong>"${this.escapeHtml(this.symbolName)}"</strong></span>
                        <span class="search-type">AI-powered semantic search</span>
                    </div>
                </header>

                <main class="references-main">
                    ${this.referenceResults.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-icon">🔍</div>
                            <h3>No semantic references found</h3>
                            <p>Try selecting a different symbol or check your codebase indexing</p>
                        </div>
                    ` : `
                        <div class="references-list">
                            ${this.referenceResults.map((result, index) => this.getReferenceHtml(result, index)).join('')}
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

    private getReferenceHtml(result: ReferenceResult, index: number): string {
        const scorePercent = Math.round(result.score * 100);
        const scoreColor = this.getScoreColor(result.score);
        const referenceIcon = this.getReferenceIcon(result.referenceType);
        const referenceColor = this.getReferenceColor(result.referenceType);
        
        return `
            <div class="reference-item" data-index="${index}">
                <div class="reference-header">
                    <div class="reference-meta">
                        <span class="file-icon">${this.getFileIcon(result.type)}</span>
                        <span class="file-name">${this.escapeHtml(result.fileName)}</span>
                        <span class="reference-type-badge" style="background: ${referenceColor}">
                            ${referenceIcon} ${result.referenceType}
                        </span>
                        <span class="result-type">${result.type}</span>
                    </div>
                    <div class="reference-score">
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${scorePercent}%; background: ${scoreColor};"></div>
                        </div>
                        <span class="score-text">${scorePercent}% match</span>
                    </div>
                </div>
                
                <div class="reference-content">
                    <h3 class="reference-title">${this.escapeHtml(result.name)}</h3>
                    <pre class="code-preview">${this.escapeHtml(result.snippet)}</pre>
                </div>
                
                <div class="reference-footer">
                    <div class="file-location">
                        ${path.basename(result.filePath)} • Lines ${result.startLine + 1}-${result.endLine + 1}
                    </div>
                    <div class="reference-actions">
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

    private getReferenceIcon(referenceType: string): string {
        const icons: { [key: string]: string } = {
            'declaration': '📝',
            'usage': '🔧', 
            'implementation': '⚡'
        };
        return icons[referenceType] || '📄';
    }

    private getReferenceColor(referenceType: string): string {
        const colors: { [key: string]: string } = {
            'declaration': '#2196F3', // Blue
            'usage': '#4CAF50',       // Green
            'implementation': '#FF9800' // Orange
        };
        return colors[referenceType] || '#9E9E9E';
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
            .references-header {
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

            .references-header h1 {
                color: var(--vscode-textLink-foreground);
                font-size: 1.3em;
                font-weight: 600;
                margin: 0;
            }

            .header-actions {
                display: flex;
                gap: var(--spacing-sm);
            }

            .references-meta {
                display: flex;
                gap: var(--spacing-md);
                font-size: 0.9em;
                color: var(--vscode-descriptionForeground);
                flex-wrap: wrap;
            }

            .result-count {
                font-weight: 600;
            }

            .symbol-name strong {
                color: var(--vscode-textLink-foreground);
            }

            .search-type {
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 0.8em;
            }

            /* Main Content */
            .references-main {
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

            /* Reference Items */
            .references-list {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-md);
            }

            .reference-item {
                background: var(--vscode-editorWidget-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: var(--border-radius);
                padding: var(--spacing-lg);
                transition: all 0.2s ease;
                border-left: 4px solid transparent;
            }

            .reference-item:hover {
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                transform: translateY(-1px);
            }

            .reference-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: var(--spacing-md);
            }

            .reference-meta {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                font-size: 0.9em;
                flex-wrap: wrap;
            }

            .file-icon {
                font-size: 1.1em;
            }

            .file-name {
                font-weight: 600;
                color: var(--vscode-foreground);
            }

            .reference-type-badge {
                color: white;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 0.8em;
                font-weight: 500;
            }

            .result-type {
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 0.8em;
                text-transform: capitalize;
            }

            .reference-score {
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
                min-width: 50px;
                text-align: right;
            }

            .reference-content {
                margin-bottom: var(--spacing-md);
            }

            .reference-title {
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

            .reference-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.85em;
            }

            .file-location {
                color: var(--vscode-descriptionForeground);
                font-family: monospace;
            }

            .reference-actions {
                display: flex;
                gap: var(--spacing-sm);
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .reference-item:hover .reference-actions {
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

                .reference-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: var(--spacing-sm);
                }

                .reference-footer {
                    flex-direction: column;
                    gap: var(--spacing-md);
                    align-items: flex-start;
                }

                .reference-actions {
                    opacity: 1;
                }

                .references-meta {
                    flex-direction: column;
                    gap: var(--spacing-sm);
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
            
            // REMOVED: Find More References button event listener
            
            // Handle reference item actions
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
                    const filePath = btn.getAttribute('data-file');
                    const code = btn.getAttribute('data-code');
                    vscode.postMessage({ 
                        command: 'explainCode', 
                        filePath: filePath,
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
            
            // Make entire reference item clickable to open file
            document.querySelectorAll('.reference-item').forEach(item => {
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
        ReferencesPanel.currentPanel = undefined;

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