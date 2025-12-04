# LiteComics デスクトップアプリ ビルド手順

## macOS版

### ビルド方法
```bash
cd tray-app
./build_osx.sh
```

### 成果物
- `packages/LiteComics.app` - アプリケーションバンドル
- `packages/LiteComics.dmg` - インストーラー

### 配布
DMGファイルをユーザーに配布。ダブルクリックでインストール。

---

## Windows版

### ビルド方法（macOS上）
```bash
cd tray-app
./build_windows.sh
```

これで以下が準備されます：
- `packages/windows/` - 全ファイル（exe, node.exe, 関連ファイル）
- `packages/litecomics-setup.iss` - Inno Setupスクリプト

### インストーラービルド（Windowsマシンで）

1. **Inno Setupのインストール**
   - https://jrsoftware.org/isdl.php からダウンロード
   - インストール実行

2. **インストーラーのビルド**
   ```
   Inno Setup Compilerを起動
   → File > Open で packages/litecomics-setup.iss を開く
   → Build > Compile を実行
   ```

3. **成果物**
   - `packages/LiteComics-Setup.exe` が生成される

### 配布
Setup.exeファイルをユーザーに配布。実行するだけでインストール完了。

**機能**:
- Program Filesへの自動インストール
- スタートアップ登録オプション
- アンインストーラー自動生成
- 設定ファイル削除確認

---

## Linux版

### ビルド方法（Linuxマシンで）

```bash
cd tray-app
./build_linux.sh
```

### 成果物
- `packages/litecomics-linux-x64.tar.gz`

### インストール（ユーザー側）
```bash
tar -xzf litecomics-linux-x64.tar.gz
cd linux
./install.sh
```

インストール先: `/opt/litecomics/`  
自動起動: `~/.config/autostart/litecomics.desktop`

### アンインストール
```bash
/opt/litecomics/uninstall.sh
```

---

## GitHub Actionsで自動ビルド（推奨）

### 1. GitHub Actionsワークフローの作成

`.github/workflows/build.yml` を作成:

```yaml
name: Build Desktop Apps

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build macOS app
        run: |
          cd tray-app
          chmod +x build_osx.sh
          ./build_osx.sh
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: LiteComics-macOS
          path: |
            tray-app/packages/LiteComics.dmg
            tray-app/packages/LiteComics.app

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build Windows package
        shell: bash
        run: |
          cd tray-app
          chmod +x build_windows.sh
          ./build_windows.sh
      
      - name: Install Inno Setup
        run: |
          choco install innosetup -y
      
      - name: Build installer
        run: |
          & "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" tray-app/packages/litecomics-setup.iss
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: LiteComics-Windows
          path: tray-app/packages/LiteComics-Setup.exe

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libayatana-appindicator3-dev
          npm install
      
      - name: Build Linux package
        run: |
          cd tray-app
          chmod +x build_linux.sh
          ./build_linux.sh
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: LiteComics-Linux
          path: tray-app/packages/litecomics-linux-x64.tar.gz

  release:
    needs: [build-macos, build-windows, build-linux]
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v3
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            LiteComics-macOS/LiteComics.dmg
            LiteComics-Windows/LiteComics-Setup.exe
            LiteComics-Linux/litecomics-linux-x64.tar.gz
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 2. 使い方

#### 手動実行
1. GitHubリポジトリの「Actions」タブを開く
2. 「Build Desktop Apps」を選択
3. 「Run workflow」ボタンをクリック

#### タグでリリース
```bash
git tag v1.0.0
git push origin v1.0.0
```

自動的にビルドが開始され、リリースページに成果物が公開されます。

### 3. 成果物のダウンロード

- リポジトリの「Actions」タブからダウンロード
- またはリリースページから直接ダウンロード

---

## 開発時のテスト

### macOS
```bash
# ビルド
cd tray-app
./build_osx.sh

# 実行
open packages/LiteComics.app
```

### Windows（クロスコンパイル済みexeのテスト）
Windowsマシンで：
```
packages\windows\litecomics-tray.exe を実行
```

### Linux
Linuxマシンで：
```bash
cd tray-app
./build_linux.sh
cd packages/linux
./litecomics-tray
```

---

## トラブルシューティング

### macOS: "開発元を確認できません"
```bash
xattr -cr packages/LiteComics.app
```

### Windows: セキュリティ警告
- Inno Setupの署名オプションを使用（コード署名証明書が必要）

### Linux: トレイアイコンが表示されない
- `libayatana-appindicator3-dev` のインストールが必要
- GNOMEの場合、拡張機能「AppIndicator Support」が必要

---

## 注意事項

- **Node.js**: 各パッケージに約30-100MBのNode.jsバイナリが含まれます
- **node_modules**: 依存関係が全て含まれるため、パッケージサイズは約150MB前後になります
- **クロスコンパイル**: macOS版はmacOSで、Windows版とLinux版のインストーラービルドはそれぞれの環境が必要（GitHub Actionsで自動化可能）
