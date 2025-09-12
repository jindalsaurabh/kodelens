// __mocks__/vscode.ts
export const workspace = {
  getConfiguration: () => ({ get: () => null }),
};
export const window = {
  showInformationMessage: (msg: string) => console.log("INFO:", msg),
  showErrorMessage: (msg: string) => console.error("ERROR:", msg),
};
