# Build Instructions

## Platform-Specific Build Requirements

### macOS
macOS can build:
- ✅ macOS ARM64 (native)
- ✅ Linux AMD64 (cross-compile with CGO_ENABLED=0)
- ✅ Linux ARM64 (cross-compile with CGO_ENABLED=0)
- ❌ Windows (autostart library has platform-specific APIs)

### Windows
Windows can build:
- ✅ Windows AMD64 (native)
- ✅ Linux AMD64 (cross-compile with CGO_ENABLED=0)
- ✅ Linux ARM64 (cross-compile with CGO_ENABLED=0)
- ❌ macOS (requires Xcode toolchain)

### Linux
Linux can build:
- ✅ Linux AMD64 (native)
- ✅ Linux ARM64 (cross-compile)
- ❌ macOS (requires Xcode toolchain)
- ❌ Windows (autostart library has platform-specific APIs)

## Building on macOS

```bash
# Build all platforms supported from macOS
make build-all

# Create distribution packages (macOS + Linux)
make dist
```

This creates:
- `litecomics-mac-*.zip` - macOS .app bundle
- `litecomics-mac-*.dmg` - macOS installer
- `litecomics-linux-amd64-*.tar.gz` - Linux AMD64
- `litecomics-linux-arm64-*.tar.gz` - Linux ARM64

## Building on Windows

### Prerequisites
1. **Install Go 1.21 or later**
   - Download from: https://go.dev/dl/
   - Or use winget: `winget install GoLang.Go`

2. **Install MinGW-w64 (for CGO support)**
   - Use winget: `winget install MartinStorsjo.LLVM-MinGW.UCRT`
   - Required for systray and autostart features

3. **Install Inno Setup 6** (for installer creation)
   - Use winget: `winget install JRSoftware.InnoSetup`
   - Or download from: https://jrsoftware.org/isdl.php

### Quick Build with Make (Recommended)

```powershell
# Build binary and create distribution packages (ZIP + installer)
mingw32-make dist-windows
```

This single command will:
- Build the Windows binary with CGO enabled
- Create a ZIP package
- Create a Windows installer (.exe)
- Output files to `dist/` directory

### Manual Build Steps

If you need to build manually:

```powershell
# Set CGO and build
cd src
$env:CGO_ENABLED = "1"
go build -ldflags="-s -w" -o ../build/litecomics-windows-amd64.exe

# Create zip package
cd ..
$version = git describe --tags --always
New-Item -ItemType Directory -Force -Path dist
Compress-Archive -Force -Path build/litecomics-windows-amd64.exe -DestinationPath "dist/litecomics-windows-$version.zip"

# Build installer
$env:VERSION = $version
& "$env:LOCALAPPDATA\Programs\Inno Setup 6\iscc.exe" installer.iss
```

### Notes
- CGO is **required** for systray and autostart features on Windows
- The `installer.iss` file is already configured in the repository
- Default install location: `C:\Program Files\LiteComics`
- Requires administrator privileges for installation

## GitHub Actions (Recommended)

For automated multi-platform builds, create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          - os: macos-latest
            goos: darwin
            goarch: arm64
            output: litecomics-mac-arm64
          - os: ubuntu-latest
            goos: linux
            goarch: amd64
            output: litecomics-linux-amd64
          - os: ubuntu-latest
            goos: linux
            goarch: arm64
            output: litecomics-linux-arm64
          - os: windows-latest
            goos: windows
            goarch: amd64
            output: litecomics-windows-amd64.exe

    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      
      - name: Build
        working-directory: server
        env:
          GOOS: ${{ matrix.goos }}
          GOARCH: ${{ matrix.goarch }}
          CGO_ENABLED: 0
        run: |
          go build -ldflags="-s -w" -o ../build/${{ matrix.output }}
      
      - name: Create macOS app bundle (macOS only)
        if: matrix.os == 'macos-latest'
        run: |
          # Create .app structure and DMG
          # (Add macOS packaging steps here)
      
      - name: Create Windows installer (Windows only)
        if: matrix.os == 'windows-latest'
        run: |
          choco install innosetup -y
          # (Add Inno Setup compilation here)
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.output }}
          path: build/${{ matrix.output }}
```

## Development

### Debug Linux CUI version on macOS

```bash
cd server
go run -tags cui .
```

### Debug GUI version

```bash
cd server
go run .
```

## Clean Build

```bash
make clean
```
