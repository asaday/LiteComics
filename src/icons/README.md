# Icon Generation

This directory contains icon assets and generation scripts.

## Files

### Source Files
- `icon.png` - Source icon for app icons (1024x1024 recommended)
- `mac_tray.png` - Source icon for macOS systray (template icon)
- `generate.sh` - Icon generation script (macOS/Linux)

### Generated Files (in `dist/`)
- `icon.icns` - macOS app icon (generated)
- `icon.ico` - Windows app icon (generated)
- `mac_tray32.png` - macOS systray icon (generated, 32x32)

## Usage

### Generate icons from source PNG

```bash
cd src/icons
./generate.sh icon.png
```

This will create in `dist/`:
- `icon.icns` - macOS app bundle icon (multi-resolution)
- `icon.ico` - Windows app icon (multi-size: 256, 128, 64, 48, 32, 16)
- `mac_tray32.png` - macOS systray template icon (32x32, from mac_tray.png)

**Note**: Icons are embedded in `main_gui.go` using `go:embed` directives from `icons/dist/`. No need to manually copy files or generate separate Go files.

Then rebuild:
```bash
cd ../..
make dist
```

## Requirements

- macOS/Linux with `sips` and `iconutil` (macOS built-in)
- **ImageMagick** for `.ico` generation: `brew install imagemagick`
- Source PNG should be 1024x1024 for best quality
- Square aspect ratio required
- `mac_tray.png` should be a monochrome template icon for macOS menu bar

## Icon Sizes Generated

**macOS .icns** includes:
- 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
- Retina variants (@2x)

**macOS systray (mac_tray32.png)**:
- 32x32 template icon (auto-adapts to light/dark mode)

**Windows .ico** includes:
- 256x256, 128x128, 64x64, 48x48, 32x32, 16x16
