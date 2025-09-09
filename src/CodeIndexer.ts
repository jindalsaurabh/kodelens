import * as vscode from "vscode";
import * as path from "path";
import { safeParse } from "./services/parserService";
import { normalizeCode } from "./services/normalize";
import { sha256Hex } from "./services/crypto";
import { CodeChunk } from "./types";

/**
 * CodeIndexer is responsible for indexing files in a workspace.
 * It normalizes code, hashes content, parses the AST, and prepares metadata for chunking and caching.
 */
export class CodeIndexer {
  private workspaceRoot: string;
  private context: vscode.ExtensionContext;

  constructor(workspaceRoot: string, context: vscode.ExtensionContext) {
    this.workspaceRoot = workspaceRoot;
    this.context = context;
  }

  /**
   * Index a single file: normalize, hash, parse.
   * @param filePath Absolute path of the file.
   * @param content File content as string.
   * @returns Object containing filePath, hash, and AST rootNode, or null on failure.
   */
  async indexFile(filePath: string, content: string): Promise<{ filePath: string; hash: string; ast: any } | null> {
    try {
      const normalized = normalizeCode(content);
      const hash = sha256Hex(normalized);

      // Parse code using workspace-aware singleton parser
      const tree = await safeParse(this.workspaceRoot, this.context, normalized);

<<<<<<< HEAD
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
=======
      if (!tree) {
        console.warn(`Skipping ${filePath}, parse failed`);
>>>>>>> 6aca314 (Singleton parser + commands: parseApexCommand,askCommand, parseWorkspaceCommand, findReferencesDisposable in src/extension.ts - working)
        return null;
      }

      return {
        filePath,
        hash,
        ast: tree.rootNode, // downstream chunking will use this
      };
    } catch (err) {
      console.error(`Indexing failed for ${filePath}`, err);
      vscode.window.showErrorMessage(
        `KodeLens: Indexing failed for ${path.basename(filePath)}`
      );
      return null;
    }
  }
}
