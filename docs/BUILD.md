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

## GitHub Actions (Automated Releases)

The repository includes a GitHub Actions workflow (`.github/workflows/release.yml`) that automatically builds and publishes releases for all platforms.

### Automatic Release

Push a tag starting with `v` to trigger an automatic release:

```bash
# Create and push a release tag
git tag v1.0.0
git push origin v1.0.0
```

This will automatically:
1. Build binaries for Linux (amd64/arm64), macOS (arm64), and Windows (amd64)
2. Create platform-specific packages (tar.gz, DMG, ZIP)
3. Create a GitHub Release with all artifacts attached

### Manual Testing

You can also trigger the workflow manually from the GitHub Actions UI:
1. Go to the "Actions" tab in your GitHub repository
2. Select the "Release" workflow
3. Click "Run workflow"
4. Enter a version string (e.g., `v0.0.1-test`)

### Build Output

The workflow creates:
- `litecomics-linux-amd64-*.tar.gz` - Linux AMD64 binary with config
- `litecomics-linux-arm64-*.tar.gz` - Linux ARM64 binary with config
- `litecomics-darwin-arm64-*.dmg` - macOS .app bundle in DMG installer
- `litecomics-windows-amd64-*.zip` - Windows executable

## Development

### Run locally

```bash
# Build and run (GUI mode with config.json in src/)
make run
```

This will:
1. Build the binary for your platform
2. Run it with the config file at `src/config.json`

### Build for current platform

```bash
# Build binary (outputs to src/litecomics)
make build

# Build CUI version (no systray)
make build-cui
```

### Build for specific platforms

```bash
# Linux
make build-linux          # AMD64
make build-linux-arm64    # ARM64 (Raspberry Pi, etc.)

# macOS
make build-mac-arm64      # Apple Silicon

# Windows (requires Windows environment)
make build-windows        # With CGO (GUI support)
make build-windows-nocgo  # Without CGO (no systray)
```

### Create distribution packages

```bash
# macOS/Linux packages (run on macOS)
make dist

# Windows package (run on Windows)
make dist-windows
```

### Install/Uninstall (Linux)

```bash
# Install binary to /usr/local/bin
make install

# Install as systemd service
make install-service

# Uninstall service
make uninstall-service

# Uninstall binary
make uninstall
```

### Clean build artifacts

```bash
make clean
```

### Debug modes

```bash
# Debug Linux CUI version on macOS
cd src
go run -tags cui .

# Debug GUI version
cd src
go run .
```

## Clean Build

```bash
make clean
```
