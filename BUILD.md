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
1. Install Go 1.21 or later
2. Install Git for Windows
3. Install Inno Setup 6 (for installer creation)
   - Download from: https://jrsoftware.org/isdl.php
   - Add to PATH: `C:\Program Files (x86)\Inno Setup 6`

### Build Steps

```powershell
# Build Windows binary
cd server
go build -ldflags="-s -w" -o ../build/litecomics-windows-amd64.exe

# Create zip package
cd ..
$version = (git describe --tags --always --dirty)
mkdir -p dist
Compress-Archive -Path build/litecomics-windows-amd64.exe -DestinationPath "dist/litecomics-windows-$version.zip"
```

### Create Windows Installer

Create `installer.iss`:

```ini
#define MyAppName "LiteComics"
#define MyAppVersion GetEnv("VERSION")
#define MyAppPublisher "Your Name"
#define MyAppURL "https://github.com/asaday/LiteComics"
#define MyAppExeName "litecomics-windows-amd64.exe"

[Setup]
AppId={{YOUR-GUID-HERE}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=dist
OutputBaseFilename=litecomics-windows-{#MyAppVersion}-setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startupicon"; Description: "Start at Windows startup"; GroupDescription: "Startup:"; Flags: unchecked

[Files]
Source: "build\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
```

Build installer:

```powershell
# Set version
$env:VERSION = (git describe --tags --always --dirty)

# Compile installer
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss
```

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
