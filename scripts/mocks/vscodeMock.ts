import * as path from "path";

export const Uri = {
  file: (p: string) => ({ fsPath: p }),
  joinPath: (uri: any, ...paths: string[]) => ({ fsPath: path.join(uri.fsPath, ...paths) }),
};

export const workspace = {
  workspaceFolders: [{ uri: { fsPath: process.cwd() } }],
  findFiles: async (pattern: string, exclude?: string) => [],
};

export const env = {};

export interface ExtensionContext {
  globalStorageUri: { fsPath: string };
  extensionUri: { fsPath: string };
  subscriptions: any[];
  workspaceState: any;
  globalState: any;
  extensionPath: string;
  asAbsolutePath: (p: string) => string;
  storageUri?: { fsPath: string };
  environmentVariableCollection?: any;
  storagePath?: string;
  logPath?: string;
  extensionMode?: number;
  languageModelAccessInformation?: any;
}

export const window = {
  createOutputChannel: (name: string) => ({
    appendLine: (msg: string) => console.log(`[${name}] ${msg}`),
  }),
  showInformationMessage: (msg: string) => console.log(msg),
};

