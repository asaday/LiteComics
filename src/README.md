# LiteComics Go

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

```bash
make run
```

## オプション

```bash
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
