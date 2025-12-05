FROM golang:1.23-alpine AS builder
WORKDIR /build
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/*.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o litecomics .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /build/litecomics .
COPY public ./public
COPY config.json.example ./config.json.example
EXPOSE 8539
CMD ["./litecomics"]
