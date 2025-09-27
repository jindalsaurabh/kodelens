#!/bin/bash

# 1️⃣ Download LibTorch macOS CPU 2.1.0
echo "📥 Downloading LibTorch 2.1.0 (macOS CPU)..."
curl -L -o /tmp/libtorch-macos-2.1.0.zip https://download.pytorch.org/libtorch/cpu/libtorch-macos-2.1.0.zip

# 2️⃣ Unzip to $HOME/libtorch-2.1.0
echo "📂 Unzipping to \$HOME/libtorch-2.1.0..."
rm -rf $HOME/libtorch-2.1.0
unzip -q /tmp/libtorch-macos-2.1.0.zip -d $HOME/libtorch-2.1.0

# 3️⃣ Set environment variables permanently in ~/.zshrc
echo "🔧 Setting environment variables in ~/.zshrc..."
grep -qxF 'export LIBTORCH=$HOME/libtorch-2.1.0' ~/.zshrc || echo 'export LIBTORCH=$HOME/libtorch-2.1.0' >> ~/.zshrc
grep -qxF 'export DYLD_LIBRARY_PATH=$LIBTORCH/lib:$DYLD_LIBRARY_PATH' ~/.zshrc || echo 'export DYLD_LIBRARY_PATH=$LIBTORCH/lib:$DYLD_LIBRARY_PATH' >> ~/.zshrc

# 4️⃣ Apply changes immediately
export LIBTORCH=$HOME/libtorch-2.1.0
export DYLD_LIBRARY_PATH=$LIBTORCH/lib:$DYLD_LIBRARY_PATH

# 5️⃣ Verify
echo "✅ Setup complete!"
echo "LIBTORCH=$LIBTORCH"
echo "DYLD_LIBRARY_PATH=$DYLD_LIBRARY_PATH"
ls $LIBTORCH/lib | grep dylib
