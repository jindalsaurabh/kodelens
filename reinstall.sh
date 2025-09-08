#!/bin/bash
set -e

echo "🔨 Compiling & Packaging..."
npm run compile
npm run package

echo "📦 Reinstalling VS Code extension..."
code --uninstall-extension kodelens.kodelens || true
code --install-extension kodelens-0.0.1.vsix

#echo "🔄 Reloading VS Code (if supported)..."
#code --command "workbench.action.reloadWindow" || true

#echo "🛠️ Opening DevTools (if supported)..."
#code --command "workbench.action.toggleDevTools" || true

echo "✅ Done!"
echo "✅ Test your extension in VS Code now"
