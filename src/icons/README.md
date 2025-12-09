# Icon Generation

This directory contains icon assets and generation scripts.

## Files

### Source Files (Required)
- `app_icon.svg` / `app_icon.png` - Application icon (1024x1024 recommended)
- `icon.svg` / `icon.png` - Web icon for favicon and apple-touch-icon
- `mac_tray.svg` / `mac_tray.png` - macOS systray template icon (monochrome)
- `generate.sh` - Icon generation script (macOS/Linux)

### Generated Files (in `dist/`)
- `icon.icns` - macOS app icon (generated from `app_icon`)
- `icon.ico` - Windows app icon (generated from `app_icon`)
- `mac_tray32.png` - macOS systray icon (generated, 32x32)

### Generated Web Files (in `../public/`)
- `apple-touch-icon.png` - iOS/Safari icon (180x180, from `icon`)
- `favicon.svg` - Browser favicon (from `icon.svg`)

## Usage

### Generate all icons

```bash
cd src/icons
./generate.sh
```

This will create:
- `dist/icon.icns` - macOS app bundle icon (multi-resolution from `app_icon`)
- `dist/icon.ico` - Windows app icon (multi-size: 256, 128, 64, 48, 32, 16 from `app_icon`)
- `dist/mac_tray32.png` - macOS systray template icon (32x32 from `mac_tray`)
- `../public/apple-touch-icon.png` - iOS/Safari icon (180x180 from `icon`)
- `../public/favicon.svg` - Browser favicon (from `icon.svg`)

**Note**: Icons are embedded in `main_gui.go` using `go:embed` directives from `icons/dist/`. No need to manually copy files or generate separate Go files.

Then rebuild:
```bash
cd ../..
make dist
```

## Requirements

- macOS/Linux with `iconutil` (macOS built-in)
- **ImageMagick** for image conversion: `brew install imagemagick`
- Source images should be 1024x1024 for best quality
- Square aspect ratio required
- `mac_tray` should be a monochrome template icon for macOS menu bar (auto-adapts to light/dark mode)

## Icon Purposes

**app_icon**: Application icon (dock, taskbar, window title)
**icon**: Web/browser icon (favicon, mobile home screen)
**mac_tray**: macOS menu bar icon (systray, status bar)

## Icon Sizes Generated

**macOS .icns** includes:
- 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
- Retina variants (@2x)

**macOS systray (mac_tray32.png)**:
- 32x32 template icon (auto-adapts to light/dark mode)

**Windows .ico** includes:
- 256x256, 128x128, 64x64, 48x48, 32x32, 16x16
