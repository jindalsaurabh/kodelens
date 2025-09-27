// src/services/webviewHelper.ts
import * as vscode from "vscode";

export function getWebviewContent(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel
): string {
  const nonce = getNonce();

  return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               style-src 'unsafe-inline';
               script-src 'nonce-${nonce}';
               font-src https:;
               connect-src https:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Embedding Webview</title>
<style>
  body { font-family: sans-serif; padding: 10px; background-color: #1e1e1e; color: white; }
  .status { color: #4fc3f7; }
</style>
</head>
<body>
<h3 class="status">Embedding Service Webview</h3>
<div id="log"></div>

<script nonce="${nonce}" type="module">
  const vscode = acquireVsCodeApi();
  const logEl = document.getElementById("log");

  function log(msg) {
    if (logEl) {
      logEl.textContent += msg + "\\n";
    }
    console.log(msg);
  }

  log("Initializing embedding model...");

  import('https://cdn.jsdelivr.net/npm/@xenova/transformers/dist/transformers.min.js').then(async ({ pipeline }) => {
    log("Transformers.js loaded. Initializing embedding pipeline...");

    let embedder;
    try {
      embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      log("Embedding model ready.");
      vscode.postMessage({ type: 'ready' });
    } catch (err) {
      log("Failed to load embedding model: " + err);
      vscode.postMessage({ type: 'ready' }); // still signal ready to avoid blocking
    }

    window.addEventListener('message', async (event) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'embeddingRequest') {
        const { requestId, text } = msg;
        try {
          if (!embedder) throw new Error("Model not initialized");
          const output = await embedder(text, { pooling: 'mean', normalize: true });
          const embeddingArray = Array.from(output.data[0]);
          vscode.postMessage({ type: 'embeddingResponse', requestId, embedding: embeddingArray });
        } catch (err) {
          vscode.postMessage({ type: 'embeddingResponse', requestId, error: err.message });
        }
      }
    });
  }).catch(err => {
    log("Failed to import transformers.js: " + err);
    vscode.postMessage({ type: 'ready' });
  });

</script>
</body>
</html>
`;
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
