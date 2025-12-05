# ビルドステージ
FROM golang:1.23-alpine AS builder

WORKDIR /build

# 依存関係をコピーしてダウンロード
COPY server/go.mod server/go.sum ./
RUN go mod download

# ソースコードをコピーしてビルド
COPY server/*.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o litecomics .

# 実行ステージ
FROM alpine:latest

WORKDIR /app

# ビルド済みバイナリをコピー
COPY --from=builder /build/litecomics .

# 静的ファイルをコピー
COPY public ./public

# サンプル設定ファイルをコピー
COPY config.json.example ./config.json.example

# ポート 8539 を公開
EXPOSE 8539

# アプリケーションを起動
CMD ["./litecomics"]
