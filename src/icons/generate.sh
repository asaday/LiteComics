#!/bin/bash
# Icon generation script
# Usage: ./generate.sh icon.png
# 
# Requirements:
# - macOS: built-in sips and iconutil
# - source PNG should be 1024x1024 for best quality

set -e

SOURCE="${1:-icon.png}"

if [ ! -f "$SOURCE" ]; then
    echo "Error: Source file '$SOURCE' not found"
    echo "Usage: $0 <source.png>"
    exit 1
fi

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

iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset
echo "✓ Created icon.icns"

# Generate Windows .ico (16x16 for systray)
echo "Generating Windows icon.ico..."
if command -v magick &> /dev/null || command -v convert &> /dev/null; then
    # Use ImageMagick if available
    if command -v magick &> /dev/null; then
        magick "$SOURCE" -resize 16x16 -define icon:auto-resize=16 icon.ico
    else
        convert "$SOURCE" -resize 16x16 -define icon:auto-resize=16 icon.ico
    fi
    echo "✓ Created icon.ico (using ImageMagick)"
else
    echo "⚠ ImageMagick not found. Run generate-windows-ico.ps1 on Windows to create icon.ico"
fi

# Generate platform-specific Go files
echo "Generating icon_darwin.go..."
cat > ../icon_darwin.go << 'EOF'
//go:build darwin && !cui

package main

import _ "embed"

//go:embed icons/icon.icns
var iconBytes []byte
EOF
echo "✓ Created icon_darwin.go"

echo "Generating icon_windows.go..."
cat > ../icon_windows.go << 'EOF'
//go:build windows && !cui

package main

import _ "embed"

//go:embed icons/icon.ico
var iconBytes []byte
EOF
echo "✓ Created icon_windows.go"

echo ""
echo "Generated files:"
echo "  - icon.icns (macOS app icon)"
echo "  - icon.ico (Windows systray icon, if ImageMagick available)"
echo "  - ../icon_darwin.go (macOS icon embed)"
echo "  - ../icon_windows.go (Windows icon embed)"
echo ""
if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null; then
    echo "Note: To generate icon.ico on Windows, run:"
    echo "  pwsh -File generate-windows-ico.ps1"
    echo ""
fi
echo "Icons are now embedded via go:embed directives"
