#!/bin/bash

set -e

echo "Building and packaging LiteComics for macOS..."

# ビルド出力ディレクトリ
BUILD_DIR="dist"
APP_NAME="LiteComics.app"
APP_DIR="packages/$APP_NAME"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
ROOT_DIR=".."

mkdir -p "$BUILD_DIR"

# Go依存関係のダウンロード
echo "Downloading Go dependencies..."
go mod download

# macOS用Goバイナリをビルド
echo "Building Go tray app..."
go build -o "$BUILD_DIR/litecomics-tray" main.go

echo "✅ Build complete!"

# クリーンアップ
echo ""
echo "Creating .app bundle..."
rm -rf "$APP_DIR"

# ディレクトリ構造作成
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# Goトレイアプリをコピー
cp "$BUILD_DIR/litecomics-tray" "$MACOS_DIR/"
chmod +x "$MACOS_DIR/litecomics-tray"

# Node.jsをコピー
if command -v node &> /dev/null; then
    NODE_PATH=$(command -v node)
    cp "$NODE_PATH" "$MACOS_DIR/node"
    chmod +x "$MACOS_DIR/node"
    echo "Node.js copied from: $NODE_PATH"
else
    echo "Error: Node.js not found. Please install Node.js first."
    exit 1
fi

# サーバーファイルをコピー
echo "Copying server files..."
cp "$ROOT_DIR/server.js" "$MACOS_DIR/"
cp "$ROOT_DIR/package.json" "$MACOS_DIR/"
cp -r "$ROOT_DIR/node_modules" "$MACOS_DIR/"
cp -r "$ROOT_DIR/public" "$MACOS_DIR/"

# Info.plistを作成
cat > "$CONTENTS_DIR/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>litecomics-tray</string>
    <key>CFBundleIdentifier</key>
    <string>com.litecomics.app</string>
    <key>CFBundleName</key>
    <string>LiteComics</string>
    <key>CFBundleDisplayName</key>
    <string>LiteComics</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

echo "✅ LiteComics.app created"

# DMGを作成
echo ""
echo "Creating DMG..."
hdiutil create -volname LiteComics -srcfolder "$APP_DIR" -ov -format UDZO packages/LiteComics.dmg > /dev/null

echo ""
echo "✅ Build complete!"
echo ""
echo "Created files:"
echo "  packages/LiteComics.app"
echo "  packages/LiteComics.dmg"
echo ""
echo "To install:"
echo "  cp -r packages/LiteComics.app /Applications/"
echo "  or open packages/LiteComics.dmg"
