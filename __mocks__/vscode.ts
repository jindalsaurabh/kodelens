// __mocks__/vscode.ts
export const workspace = {
  name: "test-workspace",
  getConfiguration: jest.fn().mockReturnValue({
    get: jest.fn(),
    update: jest.fn(),
  }),
};

export const window = {
  showErrorMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(), // ✅ add this

};

export const Uri = {
  file: (path: string) => ({ fsPath: path }),
};

