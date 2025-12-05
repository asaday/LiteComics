# LiteComics Go版

Node.js版をGoに移植したバージョンです。シンプルな単一ファイル構成。

## ビルド & 実行

```bash
# 依存パッケージのダウンロード
go mod tidy

# ビルド
go build

# 実行
./litecomics
```

または直接実行:

```bash
go run main.go
```

## オプション

```bash
# ポート指定
./litecomics -p 3000

# ルートディレクトリ指定
./litecomics -r /path/to/comics

# 複数指定
./litecomics -r /comics -r /manga -p 8080

# 設定ファイル使用
./litecomics -c myconfig.json
```

## クロスコンパイル

```bash
# Linux
GOOS=linux GOARCH=amd64 go build -o litecomics-linux

# Windows
GOOS=windows GOARCH=amd64 go build -o litecomics.exe

# macOS (Intel)
GOOS=darwin GOARCH=amd64 go build -o litecomics-mac-intel

# macOS (Apple Silicon)
GOOS=darwin GOARCH=arm64 go build -o litecomics-mac-arm64
```
