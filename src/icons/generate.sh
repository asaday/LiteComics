#!/bin/bash
# Icon generation script
# Usage: ./generate.sh icon.png
# 
# Requirements:
# - macOS: built-in sips and iconutil
# - source PNG should be 1024x1024 for best quality

set -e

SOURCE="${1:-icon.png}"
DIST_DIR="dist"

if [ ! -f "$SOURCE" ]; then
    echo "Error: Source file '$SOURCE' not found"
    echo "Usage: $0 <source.png>"
    exit 1
fi

# Create dist directory
mkdir -p "$DIST_DIR"

# Check source image size
WIDTH=$(sips -g pixelWidth "$SOURCE" | tail -1 | awk '{print $2}')
HEIGHT=$(sips -g pixelHeight "$SOURCE" | tail -1 | awk '{print $2}')

echo "Source image: ${WIDTH}x${HEIGHT}"
if [ "$WIDTH" -lt 1024 ] || [ "$HEIGHT" -lt 1024 ]; then
    echo "Warning: Source image should be at least 1024x1024 for best quality"
fi

# Generate macOS .icns
echo "Generating macOS .icns..."
mkdir -p icon.iconset

# Standard sizes for macOS icons
sips -z 16 16     "$SOURCE" --out icon.iconset/icon_16x16.png      > /dev/null
sips -z 32 32     "$SOURCE" --out icon.iconset/icon_16x16@2x.png   > /dev/null
sips -z 32 32     "$SOURCE" --out icon.iconset/icon_32x32.png      > /dev/null
sips -z 64 64     "$SOURCE" --out icon.iconset/icon_32x32@2x.png   > /dev/null
sips -z 128 128   "$SOURCE" --out icon.iconset/icon_128x128.png    > /dev/null
sips -z 256 256   "$SOURCE" --out icon.iconset/icon_128x128@2x.png > /dev/null
sips -z 256 256   "$SOURCE" --out icon.iconset/icon_256x256.png    > /dev/null
sips -z 512 512   "$SOURCE" --out icon.iconset/icon_256x256@2x.png > /dev/null
sips -z 512 512   "$SOURCE" --out icon.iconset/icon_512x512.png    > /dev/null
sips -z 1024 1024 "$SOURCE" --out icon.iconset/icon_512x512@2x.png > /dev/null

iconutil -c icns icon.iconset -o "$DIST_DIR/icon.icns"
rm -rf icon.iconset
echo "✓ Created $DIST_DIR/icon.icns"

# Generate macOS systray icon (template icon from mactray.png)
echo "Generating macOS systray icon..."
sips -z 32 32 mac_tray.png --out "$DIST_DIR/mac_tray32.png" > /dev/null
echo "✓ Created $DIST_DIR/mac_tray32.png (32x32) from mac_tray.png"

# Generate Windows .ico (multiple sizes for better compatibility)
echo "Generating Windows icon.ico..."
if command -v magick &> /dev/null || command -v convert &> /dev/null; then
    # Use ImageMagick if available
    # Include multiple sizes: 256, 128, 64, 48, 32, 16
    if command -v magick &> /dev/null; then
        magick "$SOURCE" -define icon:auto-resize=256,128,64,48,32,16 "$DIST_DIR/icon.ico"
    else
        convert "$SOURCE" -define icon:auto-resize=256,128,64,48,32,16 "$DIST_DIR/icon.ico"
    fi
    echo "✓ Created $DIST_DIR/icon.ico (using ImageMagick)"
else
    echo "⚠ ImageMagick not found. Install with: brew install imagemagick"
fi

echo ""
echo "Generated files in $DIST_DIR/:"
echo "  - icon.icns (macOS app icon)"
echo "  - mac_tray32.png (macOS systray icon)"
echo "  - icon.ico (Windows app icon)"
echo ""
echo "Icons are embedded in main_gui.go via go:embed directives"
