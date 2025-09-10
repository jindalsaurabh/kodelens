// src/ResultsProvider.ts
import * as vscode from "vscode";
import { CodeChunk } from "./types";

export class ResultItem extends vscode.TreeItem {
  constructor(
    public readonly chunk: CodeChunk
  ) {
    // Label = function name / class name (type) + short preview
    super(
      `${chunk.type}: ${chunk.text.substring(0, 50)}${chunk.text.length > 50 ? "..." : ""}`,
      vscode.TreeItemCollapsibleState.None
    );

    // Description = file name
    this.description = vscode.workspace.asRelativePath(chunk.filePath);

    // Tooltip = full code snippet
    this.tooltip = new vscode.MarkdownString()
      .appendMarkdown("```apex\n" + chunk.text + "\n```");

    // Command: open file at location
    this.command = {
      command: "vscode.open",
      title: "Open File",
      arguments: [
        vscode.Uri.file(chunk.filePath),
        {
          selection: new vscode.Range(
            chunk.startLine,
            chunk.startPosition.column,
            chunk.endLine,
            chunk.endPosition.column
          )
        }
      ]
    };
  }
}

export class ResultsProvider implements vscode.TreeDataProvider<ResultItem> {
  private _results: CodeChunk[] = [];
  private _onDidChangeTreeData = new vscode.EventEmitter<ResultItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getTreeItem(element: ResultItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<ResultItem[]> {
    return Promise.resolve(this._results.map(chunk => new ResultItem(chunk)));
  }

  /** Replace results and refresh tree view */
  setResults(results: CodeChunk[]) {
    this._results = results;
    this._onDidChangeTreeData.fire();
  }

  /** Clear all results */
  clear() {
    this._results = [];
    this._onDidChangeTreeData.fire();
  }
}
