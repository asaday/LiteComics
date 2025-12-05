# Icon Generation

This directory contains icon assets and generation scripts.

## Files

- `icon.png` - Source icon (1024x1024 recommended)
- `icon.icns` - macOS app icon (generated)
- `icon.ico` - Windows systray icon (generated, 16x16)
- `generate.sh` - Icon generation script (macOS/Linux)
- `generate-windows-ico.ps1` - Windows icon generation script

## Usage

### macOS/Linux: Generate icons from source PNG

```bash
cd src/icons
./generate.sh icon.png
```

This will create:
- `icon.icns` - macOS app bundle icon (multi-resolution)
- `icon.ico` - Windows systray icon (16x16, if ImageMagick available)
- `../icon_darwin.go` - macOS icon embed code
- `../icon_windows.go` - Windows icon embed code

### Windows: Generate icons from source PNG

```powershell
cd src\icons
.\generate-windows-ico.ps1
```

This will create:
- `icon.ico` - Windows systray icon (16x16 ICO format)
- `..\icon_darwin.go` - macOS icon embed code
- `..\icon_windows.go` - Windows icon embed code

**Note**: Icons are embedded using `go:embed` directives. No need to manually copy files.

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
