# LiteComics Tray App

トレイに常駐するLiteComicsアプリケーション。

## ビルド方法

### 1. CLIバイナリのビルド（初回のみ）

```bash
cd ../service-app
npm install
npm run build
```

### 2. Goトレイアプリのビルド

```bash
cd tray-app
chmod +x build.sh
./build.sh
```

### 3. 配布パッケージの作成

```bash
chmod +x package.sh
./package.sh
```

## 配布パッケージ

`packages/`ディレクトリに以下のファイルが生成されます：

- `litecomics-macos-arm64.zip` - macOS Apple Silicon用
- `litecomics-macos-x64.zip` - macOS Intel用
- `litecomics-windows-x64.zip` - Windows 64bit用
- `litecomics-linux-x64.tar.gz` - Linux 64bit用

## インストール方法

### macOS

1. zipファイルを解凍
2. `litecomics-tray-macos-arm64`（またはx64）を実行
3. 初回実行時にセキュリティ設定で許可が必要な場合があります

### Windows

1. zipファイルを解凍
2. `litecomics-tray-win-x64.exe`を実行
3. トレイアイコンから操作

### Linux

1. tar.gzファイルを解凍
2. `litecomics-tray-linux-x64`を実行
3. トレイアイコンから操作

## 使い方

1. トレイアイコンをクリック
2. 「ブラウザで開く」でコミックビューアーを開く
3. 「設定」で`~/.litecomics/config.json`を編集
4. 「終了」でアプリを終了

## 設定ファイル

`~/.litecomics/config.json`:

```json
{
  "port": 8539,
  "roots": [
    "/path/to/comics/folder1",
    "/path/to/comics/folder2"
  ]
}
```

## アーキテクチャ

- **Goトレイアプリ** (~5-10MB): トレイメニュー管理、プロセス管理
- **CLIバイナリ** (~40-47MB): Node.js埋め込み、Expressサーバー
- 設定ファイル: ユーザーホームディレクトリに保存

## 開発

### ローカルテスト

```bash
# macOS ARM64でテスト
go run main.go
```

### クロスコンパイル

```bash
# Windows向け
GOOS=windows GOARCH=amd64 go build -o litecomics-tray.exe main.go

# Linux向け
GOOS=linux GOARCH=amd64 go build -o litecomics-tray main.go
```
