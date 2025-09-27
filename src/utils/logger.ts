//src/utils/logger.ts
import * as vscode from 'vscode';

const CHANNEL_NAME = 'KodeLens';
let channel: vscode.OutputChannel | null = null;

function getOutputChannel() {
  if (!channel) {channel = vscode.window.createOutputChannel(CHANNEL_NAME);}
  return channel;
}

function info(msg: string) {
  const ch = getOutputChannel();
  ch.appendLine(`[INFO] ${new Date().toISOString()} ${msg}`);
}

function error(msg: string) {
  const ch = getOutputChannel();
  ch.appendLine(`[ERROR] ${new Date().toISOString()} ${msg}`);
}

function warn(msg: string) {
  const ch = getOutputChannel();
  ch.appendLine(`[WARN] ${new Date().toISOString()} ${msg}`);
}

export const logger = { info, error, warn };
