#!/bin/bash
# Icon generation script
# Usage: ./generate.sh icon.svg
# 
# Requirements:
# - ImageMagick (convert command)
# - iconutil (macOS built-in)

set -e

SOURCE="${1:-icon.png}"
DIST_DIR="dist"

if [ ! -f "$SOURCE" ]; then
    echo "Error: Source file '$SOURCE' not found"
    echo "Usage: $0 <source.svg>"
    exit 1
fi

# Check for ImageMagick
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick (convert) not found"
    echo "Install with: brew install imagemagick"
    exit 1
fi

# Create dist directory
mkdir -p "$DIST_DIR"

# Generate macOS .icns
echo "Generating macOS .icns..."
mkdir -p icon.iconset

# Standard sizes for macOS icons
convert "$SOURCE" -resize 16x16     icon.iconset/icon_16x16.png
convert "$SOURCE" -resize 32x32     icon.iconset/icon_16x16@2x.png
convert "$SOURCE" -resize 32x32     icon.iconset/icon_32x32.png
convert "$SOURCE" -resize 64x64     icon.iconset/icon_32x32@2x.png
convert "$SOURCE" -resize 128x128   icon.iconset/icon_128x128.png
convert "$SOURCE" -resize 256x256   icon.iconset/icon_128x128@2x.png
convert "$SOURCE" -resize 256x256   icon.iconset/icon_256x256.png
convert "$SOURCE" -resize 512x512   icon.iconset/icon_256x256@2x.png
convert "$SOURCE" -resize 512x512   icon.iconset/icon_512x512.png
convert "$SOURCE" -resize 1024x1024 icon.iconset/icon_512x512@2x.png

iconutil -c icns icon.iconset -o "$DIST_DIR/icon.icns"
rm -rf icon.iconset
echo "✓ Created $DIST_DIR/icon.icns"

# Generate macOS systray icon (use mac_tray.png directly)
echo "Generating macOS systray icon..."
if [ -f "mac_tray.png" ]; then
    convert mac_tray.png -resize 32x32 "$DIST_DIR/mac_tray32.png"
    echo "✓ Created $DIST_DIR/mac_tray32.png (32x32) from mac_tray.png"
else
    echo "⚠ mac_tray.png not found, skipping systray icon generation"
fi

# Generate web icons
echo "Generating web icons..."
convert "$SOURCE" -resize 180x180 ../public/apple-touch-icon.png
echo "✓ Created ../public/apple-touch-icon.png (180x180)"
convert "$SOURCE" -resize 32x32 ../public/favicon.png
echo "✓ Created ../public/favicon.png (32x32)"

# Generate Windows .ico (multiple sizes for better compatibility)
echo "Generating Windows icon.ico..."
convert "$SOURCE" -define icon:auto-resize=256,128,64,48,32,16 "$DIST_DIR/icon.ico"
echo "✓ Created $DIST_DIR/icon.ico"

echo ""
echo "Generated files in $DIST_DIR/:"
echo "  - icon.icns (macOS app icon)"
echo "  - mac_tray32.png (macOS systray icon)"
echo "  - icon.ico (Windows app icon)"
echo ""
echo "Generated web icons:"
echo "  - ../public/apple-touch-icon.png (180x180)"
echo "  - ../public/favicon.png (32x32)"
echo ""
echo "Icons are embedded in main_gui.go via go:embed directives"
