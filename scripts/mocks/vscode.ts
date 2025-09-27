// Minimal VS Code mock for testing SemanticCodeIndexer

export interface OutputChannel {
    appendLine(message: string): void;
    show(): void;
    show(preserveFocus?: boolean): void;
}

export const window = {
    createOutputChannel: (name: string): OutputChannel => {
        return {
            appendLine: (msg: string) => console.log(`[${name}] ${msg}`),
            show: (preserveFocus?: boolean) => {},
        };
    },
    showInformationMessage: (msg: string, ...args: any[]) => {
        console.log(`[INFO MESSAGE] ${msg}`);
        return undefined;
    }
};

export const Uri = {
    file: (path: string) => ({ fsPath: path }),
};

export const workspace = {
    workspaceFolders: [{ uri: Uri.file(process.cwd()) }],
    findFiles: async (pattern: string, exclude?: string) => [],
};

export const ExtensionMode = {
    Production: 1
};
