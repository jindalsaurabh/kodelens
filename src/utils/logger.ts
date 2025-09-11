// -----------------------------------------------------------------------------
// FILE: src/utils/logger.ts
// Small logger using VS Code OutputChannel. Keeps logging centralized.

import * as vscode from 'vscode';

const CHANNEL_NAME = 'KodeLens';
let channel: vscode.OutputChannel | null = null;

export function getOutputChannel() {
  if (!channel) {channel = vscode.window.createOutputChannel(CHANNEL_NAME);}
  return channel;
}

export function logInfo(msg: string) {
  const ch = getOutputChannel();
  ch.appendLine(`[INFO] ${new Date().toISOString()} ${msg}`);
}

export function logError(msg: string) {
  const ch = getOutputChannel();
  ch.appendLine(`[ERROR] ${new Date().toISOString()} ${msg}`);
}