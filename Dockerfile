FROM golang:1.23-alpine AS builder
WORKDIR /build
COPY src/go.mod src/go.sum ./
RUN go mod download
COPY src/*.go ./
COPY src/public ./public
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags "-s -w" -o litecomics .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /build/litecomics .
COPY config.json.example ./config.json.example
EXPOSE 8539
CMD ["./litecomics"]
