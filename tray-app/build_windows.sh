#!/bin/bash

set -e

echo "Building LiteComics for Windows..."

# ビルド出力ディレクトリ
BUILD_DIR="dist"
PACKAGE_DIR="packages/windows"
ROOT_DIR=".."

mkdir -p "$BUILD_DIR"
mkdir -p "$PACKAGE_DIR"

# Go依存関係のダウンロード
echo "Downloading Go dependencies..."
go mod download

# Windows用Goバイナリをクロスコンパイル
echo "Building Go tray app for Windows..."
GOOS=windows GOARCH=amd64 go build -o "$BUILD_DIR/litecomics-tray.exe" main.go

echo "✅ Build complete!"

# パッケージングディレクトリ作成
echo ""
echo "Creating package structure..."
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# Goトレイアプリをコピー
cp "$BUILD_DIR/litecomics-tray.exe" "$PACKAGE_DIR/"

# Node.js Windows版をダウンロード
NODE_VERSION="v22.12.0"
NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip"
NODE_ZIP="node-win-x64.zip"

if [ ! -f "$PACKAGE_DIR/node.exe" ]; then
    echo ""
    echo "Downloading Node.js for Windows..."
    curl -L "$NODE_URL" -o "$BUILD_DIR/$NODE_ZIP"
    echo "Extracting node.exe..."
    unzip -q "$BUILD_DIR/$NODE_ZIP" "node-${NODE_VERSION}-win-x64/node.exe" -d "$BUILD_DIR"
    mv "$BUILD_DIR/node-${NODE_VERSION}-win-x64/node.exe" "$PACKAGE_DIR/"
    rm -rf "$BUILD_DIR/node-${NODE_VERSION}-win-x64" "$BUILD_DIR/$NODE_ZIP"
    echo "✅ Node.js for Windows downloaded"
else
    echo "Node.js for Windows already exists"
fi

# サーバーファイルをコピー
echo "Copying server files..."
cp "$ROOT_DIR/server.js" "$PACKAGE_DIR/"
cp "$ROOT_DIR/package.json" "$PACKAGE_DIR/"
cp -r "$ROOT_DIR/node_modules" "$PACKAGE_DIR/"
cp -r "$ROOT_DIR/public" "$PACKAGE_DIR/"

# Inno Setup スクリプトを作成
cat > "$PACKAGE_DIR/../litecomics-setup.iss" << 'EOFISS'
#define MyAppName "LiteComics"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "LiteComics"
#define MyAppURL "https://github.com/asaday/LiteComics"
#define MyAppExeName "litecomics-tray.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-4321-8765-FEDCBA987654}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=.
OutputBaseFilename=LiteComics-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"

[Tasks]
Name: "startup"; Description: "Start LiteComics automatically when Windows starts"; GroupDescription: "Additional options:"

[Files]
Source: "windows\litecomics-tray.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "windows\node.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "windows\server.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "windows\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "windows\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "windows\public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "LiteComics"; ValueData: """{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue; Tasks: startup

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  mRes : integer;
begin
  case CurUninstallStep of
    usUninstall:
      begin
        mRes := MsgBox('Do you want to delete user configuration files?', mbConfirmation, MB_YESNO or MB_DEFBUTTON2)
        if mRes = IDYES then
        begin
          DelTree(ExpandConstant('{userappdata}\.litecomics'), True, True, True);
        end;
      end;
  end;
end;
EOFISS

echo "✅ Package structure created"
echo ""
echo "⚠️  Next steps (on Windows machine):"
echo ""
echo "1. Install Inno Setup:"
echo "   https://jrsoftware.org/isdl.php"
echo ""
echo "2. Build installer:"
echo "   Open packages/litecomics-setup.iss in Inno Setup"
echo "   Click Build > Compile"
echo ""
echo "Output will be: packages/LiteComics-Setup.exe"
echo ""
echo "Files prepared in: $PACKAGE_DIR"
