#!/bin/bash
# Icon generation script
# Usage: ./generate.sh icon.svg
# 
# Requirements:
# - ImageMagick (convert command)
# - iconutil (macOS built-in)

set -e

ICON="icon.png"
SVG="icon.svg"
APP="app_icon.png"
MAC_TRAY="mac_tray.png"
DIST_DIR="dist"

# Create dist directory
mkdir -p "$DIST_DIR"

# Generate macOS systray icon (use mac_tray.png directly)
echo "Generating macOS systray icon..."
convert "$MAC_TRAY" -resize 32x32 "$DIST_DIR/mac_tray32.png"
echo "✓ Created $DIST_DIR/mac_tray32.png (32x32) from $MAC_TRAY"

# Generate web icons
echo "Generating web icons..."
convert "$ICON" -resize 180x180 ../public/apple-touch-icon.png
echo "✓ Created ../public/apple-touch-icon.png (180x180)"
cp "$SVG" ../public/favicon.svg
echo "✓ Created ../public/favicon.svg"

# Generate Windows .ico (multiple sizes for better compatibility)
echo "Generating Windows icon.ico..."
convert "$APP" -define icon:auto-resize=256,128,64,48,32,16 "$DIST_DIR/icon.ico"
echo "✓ Created $DIST_DIR/icon.ico"

# Generate macOS .icns
echo "Generating macOS .icns..."
mkdir -p icon.iconset
# Standard sizes for macOS icons
convert "$APP" -resize 16x16     icon.iconset/icon_16x16.png
convert "$APP" -resize 32x32     icon.iconset/icon_16x16@2x.png
convert "$APP" -resize 32x32     icon.iconset/icon_32x32.png
convert "$APP" -resize 64x64     icon.iconset/icon_32x32@2x.png
convert "$APP" -resize 128x128   icon.iconset/icon_128x128.png
convert "$APP" -resize 256x256   icon.iconset/icon_128x128@2x.png
convert "$APP" -resize 256x256   icon.iconset/icon_256x256.png
convert "$APP" -resize 512x512   icon.iconset/icon_256x256@2x.png
convert "$APP" -resize 512x512   icon.iconset/icon_512x512.png
convert "$APP" -resize 1024x1024 icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o "$DIST_DIR/icon.icns"
rm -rf icon.iconset
echo "✓ Created $DIST_DIR/icon.icns"
