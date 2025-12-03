FROM node:18-slim

# unrar のインストール
RUN apt-get update && \
    apt-get install -y unrar && \
    rm -rf /var/lib/apt/lists/*

# 作業ディレクトリを設定
WORKDIR /app

# package.json と package-lock.json をコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install --production

# アプリケーションのファイルをコピー
COPY . .

# ポート 8539 を公開
EXPOSE 8539

# アプリケーションを起動
CMD ["node", "server.js"]
