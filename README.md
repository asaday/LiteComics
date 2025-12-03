# LiteComics

シンプルで高機能な Web ベースのコミックアーカイブビューア。CBZ/ZIP/CBR/RAR ファイルをブラウザで快適に閲覧できます。

A simple and feature-rich web-based comic archive viewer built with vanilla JavaScript. Browse CBZ/ZIP/CBR/RAR files comfortably in your browser.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)

**日本語** | [English](README_EN.md)

## ✨ 特徴

- 📚 **複数フォーマット対応**: CBZ, ZIP, CBR, RAR, (EPUB)
- 📖 **見開き表示**: 右から左への自然な見開き表示（横長画像は自動的に1ページ表示）
- 🖼️ **サムネイル一覧**: 全ページをグリッド表示で素早く閲覧
- 📋 **ファイル名リスト**: サイドバーでページ一覧を確認
- ⌨️ **キーボードショートカット**: 快適な操作性
- 🚀 **高速表示**: 画像キャッシュとスムーズな読み込み
- 🎬 **メディア再生**: 動画・音声ファイルにも対応

## 🚀 クイックスタート

### 必要な環境

- Node.js 14.0.0 以上
- unrar コマンド（RAR/CBR ファイルを扱う場合）

### インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd viewer

# 依存パッケージをインストール
npm install

# unrar コマンドのインストール（RAR/CBR 対応に必要）
# Ubuntu/Debian の場合:
sudo apt install unrar

# macOS の場合:
brew install unrar
```

### 設定

`config.json` を作成し、コミックファイルの保存場所を指定します：

```json
{
  "roots": [
    {
      "name": "comics",
      "path": "/path/to/your/comics"
    },
    {
      "name": "manga",
      "path": "/path/to/your/manga"
    }
  ]
}
```

### 起動

```bash
node server.js
```

ブラウザで http://localhost:8539 にアクセスしてください。

## 🔄 PM2 でのバックグラウンド起動

本番環境やサーバーで常時起動させる場合は PM2 の使用を推奨します。

### PM2 のインストール

```bash
npm install -g pm2
```

### PM2 で起動

```bash
# アプリケーションを起動
pm2 start server.js --name comic-viewer

# 起動状態を確認
pm2 status

# ログを確認
pm2 logs comic-viewer

# 再起動
pm2 restart comic-viewer

# 停止
pm2 stop comic-viewer

# 削除
pm2 delete comic-viewer
```

### システム起動時の自動起動設定

```bash
# 現在の PM2 プロセスを保存
pm2 save

# システム起動時に PM2 を自動起動
pm2 startup
# 表示されたコマンドを実行（sudo権限が必要な場合があります）
```

## 🐳 Docker での起動

Docker Compose を使用すると、依存関係のインストールが不要で簡単に起動できます。

### Docker Compose で起動

1. `docker-compose.yml` を編集して、コミックファイルのパスを設定：

```yaml
volumes:
  - /path/to/your/comics:/data:ro
```

2. コンテナをビルド・起動：

```bash
docker-compose up -d
```

3. ブラウザで http://localhost:8539 にアクセス

### Docker コマンド

```bash
# ログ確認
docker-compose logs -f

# 停止
docker-compose down

# 再起動
docker-compose restart

# 再ビルド
docker-compose up -d --build
```

### カスタム設定を使用する場合

`docker-compose.yml` のコメントを解除して、`config.json` をマウント：

```yaml
volumes:
  - ./config.json:/app/config.json:ro
```

## 🎮 使い方

### ファイル一覧画面

- **↑/↓**: カーソル移動
- **Enter**: ファイルを開く
- **ESC/Backspace**: 親ディレクトリに戻る
- **クリック**: ファイルやフォルダを開く

### ビューア画面

#### キーボード操作

| キー | 機能 |
|------|------|
| `←` / `→` | ページ送り（右綴じ） |
| `↑` / `↓` | 配置修正（ページオフセット調整） |
| `S` | 単/複表示モード切り替え |
| `Enter` | 全画面モード切り替え |
| `T` | サムネイル一覧を表示 |
| `L` | ファイル名リストを表示/非表示 |
| `H` | ヘルプを表示/非表示 |
| `ESC` / `Backspace` | ファイル一覧に戻る |

#### マウス操作

- **画面左半分クリック**: 次のページ
- **画面右半分クリック**: 前のページ
- **画面上部にホバー**: ツールバー表示
- **画面下部にホバー**: ページ情報表示

### ツールバー

- **✕ 閉じる**: ファイル一覧に戻る
- **📋 リスト**: ファイル名リストを表示
- **🖼️ サムネイル**: サムネイル一覧を表示
- **◀◀ / ▶▶**: ページ送り
- **◀ / ▶**: ページオフセット調整
- **単/複**: 表示モード切り替え
- **全画面**: フルスクリーンモード
- **ヘルプ**: ヘルプ表示

## 🏗️ 技術スタック

- **Backend**: Express.js 4.18.2
- **Archive Handling**: adm-zip 0.5.10, unrar (command-line)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3（各HTMLファイルは完全独立）
- **Routing**: Hash-based client-side routing
- **Storage**: localStorage (設定保持), sessionStorage (ナビゲーション状態)

## 📁 プロジェクト構成

```
.
├── server.js          # Express サーバー
├── config.json        # 設定ファイル
├── package.json       # 依存関係
├── README.md          # このファイル
└── public/
    ├── index.html     # ファイル一覧画面
    ├── viewer.html    # コミックビューア画面
    ├── media.html     # メディアプレイヤー画面
    └── favicon.svg    # アイコン
```

## 🔧 API エンドポイント

| エンドポイント | 説明 |
|---------------|------|
| `GET /api/roots` | ルート一覧取得 |
| `GET /api/dir/*` | ディレクトリ内容取得 |
| `GET /api/book/:filename(*)/list` | 本（アーカイブ）内ファイル一覧 |
| `GET /api/book/:filename(*)/image/:index` | 本から画像取得 |
| `GET /api/book/:filename(*)/thumbnail` | 本のサムネイル取得 |
| `GET /api/media/:filename(*)` | メディアファイル取得（動画・音声） |
| `GET /api/file/:filename(*)` | 任意のファイル取得 |

