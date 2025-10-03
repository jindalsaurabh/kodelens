// src/webview/explanationPanel.ts
import * as vscode from 'vscode';
import { CodeExplanation } from '../utils/codeExplainer';

/**
 * Webview panel for displaying code explanations
 */
export class ExplanationPanel {
    public static currentPanel: ExplanationPanel | undefined;

    /**
     * Create or show the explanation panel
     */
    public static createOrShow(
        context: vscode.ExtensionContext,
        explanation: CodeExplanation,
        originalCode: string
    ): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (ExplanationPanel.currentPanel) {
            ExplanationPanel.currentPanel.panel.reveal(column);
            ExplanationPanel.currentPanel.update(explanation, originalCode);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'kodelensExplanation',
            'Kodelens - Code Explanation',
            column || vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'media')
                ]
            }
        );

        ExplanationPanel.currentPanel = new ExplanationPanel(panel, context, explanation, originalCode);
    }

    /**
     * Close the current panel if it exists
     */
    public static closeCurrentPanel(): void {
        if (ExplanationPanel.currentPanel) {
            ExplanationPanel.currentPanel.dispose();
        }
    }

    private constructor(
        private readonly panel: vscode.WebviewPanel,
        private readonly context: vscode.ExtensionContext,
        private explanation: CodeExplanation,
        private originalCode: string
    ) {
        // Set initial content
        this.update(this.explanation, this.originalCode);

        // Listen for when the panel is disposed
        this.panel.onDidDispose(() => this.dispose(), null, context.subscriptions);

        // Update when configuration changes
        this.panel.onDidChangeViewState(
            () => {
                if (this.panel.visible) {
                    this.update(this.explanation, this.originalCode);
                }
            },
            null,
            context.subscriptions
        );
    }

    /**
     * Update the panel content
     */
    public update(explanation: CodeExplanation, originalCode: string): void {
        this.explanation = explanation;
        this.originalCode = originalCode;
        this.panel.webview.html = this.getHtmlForWebview();
    }

    /**
     * Generate HTML content for the webview
     */
    private getHtmlForWebview(): string {
        // Convert markdown to HTML in the summary
        const summaryHtml = this.convertMarkdownToHtml(this.explanation.summary);
        // Convert breakdown content from markdown to HTML
        const breakdownWithHtml = this.explanation.breakdown.map(section => ({
            ...section,
            content: this.convertMarkdownToHtml(section.content)
        }));

     
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Explanation - Kodelens</title>
            <style>
                ${this.getStyles()}
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <div class="header-content">
                        <h1>🧠 Kodelens Code Explanation</h1>
                        <div class="complexity-display">
                            <div class="complexity-badge complexity-${this.explanation.complexity.level}">
                                ${this.getComplexityLabel(this.explanation.complexity.level)}
                            </div>
                            ${this.explanation.complexity.details.length > 0 ? `
                                <div class="complexity-details">
                                    <div class="complexity-factors">
                                        ${this.explanation.complexity.details.map((detail: string) => 
                                            `<span class="complexity-factor">${this.escapeHtml(detail)}</span>`
                                        ).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </header>

                <main>
                    <section class="code-preview">
                        <h2>📝 Code Preview</h2>
                        <div class="card-content">
                            <pre><code>${this.escapeHtml(this.originalCode)}</code></pre>
                        </div>
                    </section>

                    <section class="summary-card">
                        <h2>📋 Summary</h2>
                        <div class="card-content">
                            <div class="summary-text">${summaryHtml}</div>
                        </div>
                    </section>

                    <section class="breakdown">
                        <h2>🔍 Detailed Breakdown</h2>
                        <div class="breakdown-grid">
                            ${breakdownWithHtml.map(section => `
                                <div class="breakdown-card">
                                    <div class="breakdown-header">
                                        <span class="icon">${section.icon}</span>
                                        <h3>${section.title}</h3>
                                    </div>
                                    <div class="breakdown-content">
                                        ${section.content}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </section>

                    ${this.explanation.recommendations && this.explanation.recommendations.length > 0 ? `
                    <section class="recommendations">
                        <h2>💡 Recommendations</h2>
                        <div class="card-content">
                            <ul class="recommendations-list">
                                ${this.explanation.recommendations.map(rec => `
                                    <li>${this.escapeHtml(rec)}</li>
                                `).join('')}
                            </ul>
                        </div>
                    </section>
                    ` : ''}
                </main>

                <footer>
                    <div class="footer-content">
                        <span class="footer-text">Powered by Kodelens • Salesforce Code Intelligence</span>
                    </div>
                </footer>
            </div>
        </body>
        </html>
    `;
}

    /**
     * Get descriptive label for complexity level
     */
    private getComplexityLabel(level: 'simple' | 'moderate' | 'complex'): string {
        const labels = {
            'simple': 'Easy to Understand',
            'moderate': 'Moderate Complexity', 
            'complex': 'Complex Logic'
        };
        return labels[level];
    }

    /**
     * Convert markdown syntax to HTML
     */
    private convertMarkdownToHtml(text: string): string {
        return text
            // Convert **bold** to <strong>bold</strong>
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Convert `code` to <code>code</code>
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Convert line breaks
            .replace(/\n/g, '<br>');
    }

    /**
     * Get CSS styles for the webview
     */
    private getStyles(): string {
        return `
            :root {
                --border-radius: 8px;
                --spacing-sm: 8px;
                --spacing-md: 16px;
                --spacing-lg: 24px;
                --spacing-xl: 32px;
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
                line-height: 1.6;
                padding: 0;
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }

            header {
                background: var(--vscode-titleBar-activeBackground);
                border-bottom: 1px solid var(--vscode-panel-border);
                padding: var(--spacing-md) var(--spacing-lg);
                position: sticky;
                top: 0;
                z-index: 100;
            }

            .header-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            h1 {
                color: var(--vscode-textLink-foreground);
                font-size: 1.5em;
                font-weight: 600;
                margin: 0;
            }

            .complexity-display {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 4px;
            }

            .complexity-badge {
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 0.8em;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .complexity-simple {
                background: var(--vscode-testing-iconPassed);
                color: white;
            }

            .complexity-moderate {
                background: var(--vscode-testing-iconQueued);
                color: white;
            }

            .complexity-complex {
                background: var(--vscode-testing-iconFailed);
                color: white;
            }

            .complexity-details {
                font-size: 0.75em;
                text-align: right;
            }

            .complexity-factors {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .complexity-factor {
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 1.0em;
            }

            main {
                flex: 1;
                padding: var(--spacing-lg);
                display: flex;
                flex-direction: column;
                gap: var(--spacing-lg);
            }

            section {
                width: 100%;
            }

            h2 {
                color: var(--vscode-textLink-foreground);
                font-size: 1.2em;
                font-weight: 600;
                margin-bottom: var(--spacing-md);
                padding-bottom: var(--spacing-sm);
                border-bottom: 2px solid var(--vscode-panel-border);
            }

            .card-content {
                background: var(--vscode-editorWidget-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: var(--border-radius);
                padding: var(--spacing-md);
            }

            .summary-text {
                font-size: 1.1em;
                line-height: 1.6;
                color: var(--vscode-foreground);
            }

            .summary-text strong {
                color: var(--vscode-textLink-foreground);
                font-weight: 600;
            }

            .code-preview pre {
                background: var(--vscode-textCodeBlock-background);
                padding: var(--spacing-md);
                border-radius: 4px;
                overflow-x: auto;
                font-family: var(--vscode-editor-font-family);
                font-size: 0.9em;
                line-height: 1.4;
                margin: 0;
                border: 1px solid var(--vscode-panel-border);
                white-space: pre-wrap;
                word-wrap: break-word;
            }

            .breakdown-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: var(--spacing-md);
            }

            .breakdown-card {
                background: var(--vscode-editorWidget-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: var(--border-radius);
                padding: var(--spacing-md);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }

            .breakdown-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .breakdown-header {
                display: flex;
                align-items: center;
                margin-bottom: var(--spacing-sm);
            }

            .breakdown-header .icon {
                font-size: 1.4em;
                margin-right: var(--spacing-sm);
            }

            .breakdown-header h3 {
                color: var(--vscode-textLink-foreground);
                font-size: 1.1em;
                font-weight: 600;
                margin: 0;
            }

            .breakdown-content {
                color: var(--vscode-foreground);
                font-size: 0.95em;
                line-height: 1.5;
            }

            .breakdown-content strong {
                color: var(--vscode-textLink-foreground);
                font-weight: 600;
            }

            .breakdown-content code {
                background: var(--vscode-textCodeBlock-background);
                padding: 2px 6px;
                border-radius: 3px;
                font-family: var(--vscode-editor-font-family);
                font-size: 0.9em;
                border: 1px solid var(--vscode-panel-border);
            }

            .breakdown-content ul {
                padding-left: var(--spacing-md);
                margin: var(--spacing-sm) 0;
            }

            .breakdown-content li {
                margin-bottom: 4px;
            }

            .patterns-list {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-md);
            }

            .pattern-card {
                background: var(--vscode-editorWidget-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: var(--border-radius);
                padding: var(--spacing-md);
                transition: transform 0.2s ease;
            }

            .pattern-card:hover {
                transform: translateX(4px);
            }

            .pattern-header {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                margin-bottom: var(--spacing-sm);
            }

            .pattern-badge {
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.8em;
                font-weight: 600;
            }

            .similarity-badge {
                background: var(--vscode-textLink-foreground);
                color: white;
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 0.8em;
                font-weight: 600;
            }

            .type-tag {
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 0.8em;
                font-family: monospace;
            }

            .pattern-snippet {
                background: var(--vscode-textCodeBlock-background);
                padding: var(--spacing-sm);
                border-radius: 4px;
                font-family: monospace;
                font-size: 0.85em;
                margin: var(--spacing-sm) 0;
                overflow-x: auto;
                border: 1px solid var(--vscode-panel-border);
                white-space: pre-wrap;
            }

            .pattern-file {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                color: var(--vscode-descriptionForeground);
                font-size: 0.85em;
                font-family: monospace;
            }

            .file-icon {
                font-size: 0.9em;
            }

            .recommendations {
                margin-top: var(--spacing-lg);
            }

            .recommendations-list {
                padding-left: var(--spacing-lg);
            }

            .recommendations-list li {
                margin-bottom: var(--spacing-sm);
                color: var(--vscode-foreground);
                line-height: 1.5;
            }

            footer {
                background: var(--vscode-titleBar-inactiveBackground);
                border-top: 1px solid var(--vscode-panel-border);
                padding: var(--spacing-md) var(--spacing-lg);
                margin-top: auto;
            }

            .footer-content {
                text-align: center;
            }

            .footer-text {
                color: var(--vscode-descriptionForeground);
                font-size: 0.9em;
            }

            @media (max-width: 768px) {
                .breakdown-grid {
                    grid-template-columns: 1fr;
                }
                
                main {
                    padding: var(--spacing-md);
                }
                
                .header-content {
                    flex-direction: column;
                    gap: var(--spacing-sm);
                    align-items: flex-start;
                }
            }
        `;
    }

    /**
     * Escape HTML for safe rendering
     */
    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Clean up resources
     */
    private dispose(): void {
        ExplanationPanel.currentPanel = undefined;
        this.panel.dispose();
    }
}