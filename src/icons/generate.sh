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

# Generate 32x32 PNG for systray (embedded in Go)
echo "Generating icon.go..."
sips -z 32 32 "$SOURCE" --out icon-32x32.png > /dev/null

# Convert to Go byte array
echo "package main" > icon.go
echo "" >> icon.go
echo "// Icon data - 32x32 PNG icon for systray" >> icon.go
echo "var iconData = []byte{" >> icon.go

# Convert PNG to hex bytes
xxd -i < icon-32x32.png | sed 's/^/\t/' | sed 's/unsigned.*$//' >> icon.go

echo "}" >> icon.go

rm icon-32x32.png
echo "✓ Created icon.go"

echo ""
echo "Generated files:"
echo "  - icon.icns (macOS app icon)"
echo "  - icon.go (systray icon embedded in binary)"
echo ""
echo "Next steps:"
echo "  1. Replace ../icon.go with the generated icon.go"
echo "  2. Run 'make dist' to build with new icons"
