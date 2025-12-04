#!/bin/bash

set -e

echo "Building LiteComics for Linux..."

# ビルド出力ディレクトリ
BUILD_DIR="dist"
PACKAGE_DIR="packages/linux"
ROOT_DIR=".."

mkdir -p "$BUILD_DIR"
mkdir -p "$PACKAGE_DIR"

# Go依存関係のダウンロード
echo "Downloading Go dependencies..."
go mod download

# Linux用Goバイナリをクロスコンパイル
echo "Building Go tray app for Linux..."
GOOS=linux GOARCH=amd64 go build -o "$BUILD_DIR/litecomics-tray" main.go

echo "✅ Build complete!"

# パッケージングディレクトリ作成
echo ""
echo "Creating package structure..."
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# Goトレイアプリをコピー
cp "$BUILD_DIR/litecomics-tray" "$PACKAGE_DIR/"
chmod +x "$PACKAGE_DIR/litecomics-tray"

# Node.js Linux版をダウンロード
NODE_VERSION="v22.12.0"
NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz"
NODE_TAR="node-linux-x64.tar.xz"

if [ ! -f "$PACKAGE_DIR/node" ]; then
    echo ""
    echo "Downloading Node.js for Linux..."
    curl -L "$NODE_URL" -o "$BUILD_DIR/$NODE_TAR"
    echo "Extracting node..."
    tar -xJf "$BUILD_DIR/$NODE_TAR" -C "$BUILD_DIR" "node-${NODE_VERSION}-linux-x64/bin/node"
    mv "$BUILD_DIR/node-${NODE_VERSION}-linux-x64/bin/node" "$PACKAGE_DIR/"
    chmod +x "$PACKAGE_DIR/node"
    rm -rf "$BUILD_DIR/node-${NODE_VERSION}-linux-x64" "$BUILD_DIR/$NODE_TAR"
    echo "✅ Node.js for Linux downloaded"
else
    echo "Node.js for Linux already exists"
fi

# サーバーファイルをコピー
echo "Copying server files..."
cp "$ROOT_DIR/server.js" "$PACKAGE_DIR/"
cp "$ROOT_DIR/package.json" "$PACKAGE_DIR/"
cp -r "$ROOT_DIR/node_modules" "$PACKAGE_DIR/"
cp -r "$ROOT_DIR/public" "$PACKAGE_DIR/"

# インストールスクリプトを作成
cat > "$PACKAGE_DIR/install.sh" << 'EOF'
#!/bin/bash

set -e

APP_NAME="litecomics"
INSTALL_DIR="/opt/$APP_NAME"
DESKTOP_FILE="$HOME/.config/autostart/$APP_NAME.desktop"

echo "Installing LiteComics..."

# インストールディレクトリを作成
sudo mkdir -p "$INSTALL_DIR"
sudo cp -r ./* "$INSTALL_DIR/"
sudo chmod +x "$INSTALL_DIR/litecomics-tray"
sudo chmod +x "$INSTALL_DIR/node"

echo "✅ Files installed to $INSTALL_DIR"

# 自動起動用デスクトップファイルを作成
mkdir -p "$HOME/.config/autostart"

cat > "$DESKTOP_FILE" << DESKTOP
[Desktop Entry]
Type=Application
Name=LiteComics
Exec=$INSTALL_DIR/litecomics-tray
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
DESKTOP

echo "✅ Autostart configured"
echo ""
echo "Installation complete!"
echo "LiteComics will start automatically on next login."
echo ""
echo "To start now:"
echo "  $INSTALL_DIR/litecomics-tray &"
EOF

chmod +x "$PACKAGE_DIR/install.sh"

# アンインストールスクリプトを作成
cat > "$PACKAGE_DIR/uninstall.sh" << 'EOF'
#!/bin/bash

set -e

APP_NAME="litecomics"
INSTALL_DIR="/opt/$APP_NAME"
DESKTOP_FILE="$HOME/.config/autostart/$APP_NAME.desktop"

echo "Uninstalling LiteComics..."

# プロセスを停止
pkill -f "litecomics-tray" || true

# インストールディレクトリを削除
if [ -d "$INSTALL_DIR" ]; then
    sudo rm -rf "$INSTALL_DIR"
    echo "✅ Application removed from $INSTALL_DIR"
fi

# 自動起動設定を削除
if [ -f "$DESKTOP_FILE" ]; then
    rm "$DESKTOP_FILE"
    echo "✅ Autostart configuration removed"
fi

# ユーザー設定削除の確認
read -p "Do you want to remove user configuration (~/.litecomics)? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$HOME/.litecomics"
    echo "✅ User configuration removed"
fi

echo ""
echo "Uninstallation complete!"
EOF

chmod +x "$PACKAGE_DIR/uninstall.sh"

# tar.gzを作成
echo ""
echo "Creating tar.gz archive..."
(cd packages && tar -czf litecomics-linux-x64.tar.gz linux)

echo ""
echo "✅ Build complete!"
echo ""
echo "Created files:"
echo "  packages/litecomics-linux-x64.tar.gz"
echo ""
echo "Installation (on Linux):"
echo "  tar -xzf litecomics-linux-x64.tar.gz"
echo "  cd linux"
echo "  ./install.sh"
echo ""
echo "Uninstallation (on Linux):"
echo "  /opt/litecomics/uninstall.sh"
