# Icon Generation

This directory contains icon assets and generation scripts.

## Files

- `icon.png` - Source icon (1024x1024 recommended)
- `icon.icns` - macOS app icon (generated)
- `generate.sh` - Icon generation script

## Usage

### Generate icons from source PNG

```bash
cd src/icons
./generate.sh icon.png
```

This will create:
- `icon.icns` - macOS app bundle icon
- `icon.go` - Go source file with embedded systray icon (32x32)

### Replace icons in project

```bash
# After running generate.sh
cp icon.go ../icon.go
```

Then rebuild:
```bash
cd ../..
make dist
```

## Requirements

- macOS with `sips` and `iconutil` (built-in)
- Source PNG should be 1024x1024 for best quality
- Square aspect ratio required

## Icon Sizes Generated

macOS .icns includes:
- 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
- Retina variants (@2x)

Systray icon:
- 32x32 PNG embedded in binary
