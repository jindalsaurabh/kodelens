// src/services/WebviewEmbeddingService.ts
import * as vscode from "vscode";
import { EmbeddingService } from "./embeddings";
import { getWebviewContent } from "./webviewHelper";

export class WebviewEmbeddingService implements EmbeddingService {
  private panel?: vscode.WebviewPanel;
  private pendingRequests = new Map<string, (result: Float32Array) => void>();
  private dimension = 384; // adjust if your model has a different embedding size
  private readyPromise?: Promise<void>; // resolves when webview + model is ready
  private resolveReady?: () => void;

  constructor(private context: vscode.ExtensionContext) {}

  dim(): number {
    return this.dimension;
  }

  async init(): Promise<void> {
    if (this.panel) {return;} // already initialized

    this.panel = vscode.window.createWebviewPanel(
      "embeddingWebview",
      "Embedding Webview",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true }
    );

    this.panel.webview.html = getWebviewContent(this.context, this.panel);

    // Promise to wait for model to be ready
    this.readyPromise = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });

    // Listen for messages from webview
    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleWebviewMessage(msg),
      undefined,
      this.context.subscriptions
    );

    return this.readyPromise;
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    // Wait for webview + model to be ready
    if (this.readyPromise) {
      await this.readyPromise;
    }

    if (!this.panel) {throw new Error("Webview not initialized");}

    const promises = texts.map(
      (text) =>
        new Promise<Float32Array>((resolve, reject) => {
          const requestId = this.generateRequestId();
          this.pendingRequests.set(requestId, resolve);
          this.panel!.webview.postMessage({
            type: "embeddingRequest",
            requestId,
            text,
          });
        })
    );

    return Promise.all(promises);
  }

  private handleWebviewMessage(msg: any) {
    if (!msg || !msg.type) {return;}

    // Webview signals model ready
    if (msg.type === "ready") {
      this.resolveReady?.();
      this.resolveReady = undefined;
      return;
    }

    if (msg.type === "embeddingResponse" && msg.requestId) {
      const resolver = this.pendingRequests.get(msg.requestId);
      if (!resolver) {return;}
      this.pendingRequests.delete(msg.requestId);

      if (msg.error) {
        console.error("Embedding error:", msg.error);
        resolver(new Float32Array()); // return empty on error
      } else {
        resolver(new Float32Array(msg.embedding));
      }
    }
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 12);
  }

  async dispose(): Promise<void> {
    this.panel?.dispose();
    this.pendingRequests.clear();
  }
}
