# LiteComics

バニラJavaScriptで作成したシンプルで高機能なWebベースのコミック・メディアビューア。CBZ/ZIP/CBR/RAR/7Zファイルをブラウザで快適に閲覧したり、動画・音声ファイルを再生できます。

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)

**日本語** | [English](README_EN.md)

## ✨ 特徴

- 📚 **複数フォーマット対応**: CBZ, ZIP, CBR, RAR, CB7, 7Z, EPUB（画像のみ）
- 🎬 **メディア再生**: 動画・音声ファイルに対応（MP4, MKV, WebM, MP3, FLAC など）
- 📖 **見開き表示**: 右開き見開きの自然な表示（横長画像は自動的に単ページ表示）
- 🖼️ **サムネイル一覧**: グリッドレイアウトでページを素早く確認
- 📋 **ファイル一覧**: サイドバーにページ名リスト表示
- ⌨️ **キーボードショートカット**: 快適な操作
- 🚀 **高速表示**: サムネイルとファイルリストのキャッシュ
- 🎨 **ダークモード**: ライト/ダークテーマ切り替え
- 🔍 **ズーム機能**: UI全体の拡大縮小（50-200%）

## 🚀 クイックスタート

### 必要要件

- Node.js 14.0.0 以上
- unrar コマンド（RAR/CBRファイル用）
- 7z コマンド（7Z/CB7ファイル用）

### インストール

```bash
# リポジトリのクローン
git clone <repository-url>
cd LiteComics

# 依存関係のインストール
npm install

# コマンドラインツールとしてインストール（オプション）
npm link

# 必要なコマンドのインストール
# Ubuntu/Debian:
sudo apt install unrar p7zip-full

# macOS:
brew install unrar p7zip
```

### 設定

`config.json` を作成し、コミックファイルの場所とポート番号を指定します:

```json
{
  "port": 8539,
  "roots": [
    "/path/to/your/comics",
    {
      "path": "/path/to/your/manga",
      "name": "Manga"
    }
  ]
}
```

### 起動

```bash
# 設定ファイルを使用
litecomics

# ポートを指定
litecomics -p 3000

# ルートディレクトリを直接指定
litecomics -r /path/to/comics -r /path/to/movies

# カスタム設定ファイルを使用
litecomics -c /path/to/config.json

# ヘルプを表示
litecomics --help
```

表示されたURLにブラウザでアクセスします。

## 📝 コマンドラインオプション

```
litecomics [options]

Options:
  -c, --config <path>  設定ファイルのパスを指定（デフォルト: ./config.json）
  -p, --port <number>  ポート番号を指定（デフォルト: 8539）
  -r, --root <path>    ルートディレクトリを追加（複数回使用可能）
  -h, --help           ヘルプメッセージを表示

Examples:
  litecomics
  litecomics -p 3000
  litecomics -r /path/to/comics -r /another/path
  litecomics -c custom-config.json -p 3000
```

## 🔄 PM2でバックグラウンド実行

本番環境やサーバーで継続実行する場合はPM2の使用を推奨します。

### PM2のインストール

```bash
npm install -g pm2
```

### PM2での起動

```bash
# アプリケーションを起動
pm2 start server.js --name litecomics

# カスタムポートで起動
pm2 start server.js --name litecomics -- -p 3000

# 状態確認
pm2 status

# ログ表示
pm2 logs litecomics

# 再起動
pm2 restart litecomics

# 停止
pm2 stop litecomics

# 削除
pm2 delete litecomics
```

### システム起動時の自動起動

```bash
# 現在のPM2プロセスを保存
pm2 save

# システム起動時にPM2を自動起動
pm2 startup
# 表示されたコマンドを実行（sudoが必要な場合があります）
```

## 🐳 Dockerで実行

Docker Composeを使用すると依存関係のインストールなしで簡単に起動できます。

### Docker Composeで起動

1. `docker-compose.yml` を編集してコミックファイルのパスを設定:

```yaml
volumes:
  - /path/to/your/comics:/data:ro
```

2. コンテナをビルド・起動:

```bash
docker-compose up -d
```

3. ブラウザで http://localhost:8539 にアクセス

### Dockerコマンド

```bash
# ログ表示
docker-compose logs -f

# 停止
docker-compose down

# 再起動
docker-compose restart

# 再ビルド
docker-compose up -d --build
```

### カスタム設定の使用

`docker-compose.yml` で `config.json` をマウントするには、以下をアンコメント:

```yaml
volumes:
  - ./config.json:/app/config.json:ro
```

## 🎮 使い方

### ファイルリスト画面

#### キーボード操作

| キー | 機能 |
|------|------|
| `↑` / `↓` | カーソル移動 |
| `←` / `→` | カーソル移動 |
| `PageUp` / `PageDown` | 10個ずつ移動 |
| `Enter` | ファイルを開く |
| `ESC` / `Backspace` | 親ディレクトリに戻る |
| `Ctrl` + `-` | UI サイズ縮小 |
| `Ctrl` + `+` | UI サイズ拡大 |

#### マウス操作

- **クリック**: ファイル/フォルダを開く
- **A-/A+ ボタン**: UI 全体のズーム
- **🌓 ボタン**: ライト/ダークテーマ切り替え

### ビューア画面

#### キーボード操作

| キー | 機能 |
|------|------|
| `←` / `→` | ページ送り（右綴じ） |
| `↑` / `↓` | ページオフセット調整 |
| `S` | シングル/見開き表示切替 |
| `Enter` | フルスクリーン切替 |
| `T` | サムネイル一覧表示 |
| `L` | ファイル名リスト表示/非表示 |
| `H` | ヘルプ表示/非表示 |
| `ESC` / `Backspace` | ファイルリストに戻る |

#### マウス操作

- **左半分クリック**: 次ページ
- **右半分クリック**: 前ページ
- **上部ホバー**: ツールバー表示
- **下部ホバー**: ページ情報表示

### ツールバー

- **✕ 閉じる**: ファイルリストに戻る
- **📋 リスト**: ファイル名リスト表示
- **🖼️ サムネイル**: サムネイル一覧表示
- **◀◀ / ▶▶**: ページ送り
- **◀ / ▶**: ページオフセット調整
- **シングル/見開き**: 表示モード切替
- **全画面**: フルスクリーンモード
- **ヘルプ**: ヘルプ表示

## 🏗️ 技術スタック

- **バックエンド**: Express.js 4.18.2
- **アーカイブ処理**: adm-zip 0.5.10, unrar（コマンドライン）, 7z（コマンドライン）
- **フロントエンド**: Vanilla JavaScript, HTML5, CSS3（各HTMLファイルは独立動作）
- **ルーティング**: ハッシュベースのクライアントサイドルーティング
- **ストレージ**: localStorage（設定）, sessionStorage（ナビゲーション状態）

## 📁 プロジェクト構造

```
.
├── server.js          # Expressサーバー
├── config.json        # 設定ファイル
├── package.json       # 依存関係
├── README.md          # このファイル
├── README_EN.md       # 英語版ドキュメント
└── public/
    ├── index.html     # ファイルリスト画面
    ├── viewer.html    # コミックビューア画面
    ├── media.html     # メディアプレイヤー画面
    └── favicon.svg    # アイコン
```

## 🔧 APIエンドポイント

| エンドポイント | 説明 |
|---------------|------|
| `GET /api/roots` | ルート一覧を取得 |
| `GET /api/dir/*` | ディレクトリ内容を取得 |
| `GET /api/book/:filename(*)/list` | アーカイブ内ファイル一覧取得 |
| `GET /api/book/:filename(*)/image/:index` | アーカイブから画像取得 |
| `GET /api/book/:filename(*)/thumbnail` | サムネイル取得（LRUキャッシュ） |
| `GET /api/media/:filename(*)` | メディアファイル取得（動画・音声、Range対応） |
| `GET /api/media-url/:filename(*)` | メディアURL取得（デバイス判定、外部プレイヤー対応） |
| `GET /api/file/:filename(*)` | 任意のファイル取得 |

## �� 対応フォーマット

### アーカイブ（コミック）
- **CBZ, ZIP**: JavaScript（adm-zip）
- **CBR, RAR**: unrarコマンド
- **CB7, 7Z**: 7zコマンド
- **EPUB**: 部分対応

### メディア
- **動画**: MP4, MKV, WebM, AVI, MOV, M2TS, TS, WMV, FLV, MPG, MPEG
- **音声**: MP3, FLAC, WAV, OGG, M4A, AAC, WMA, Opus

### 画像
- JPG, JPEG, PNG, GIF, WebP, BMP, AVIF

## 💾 キャッシュ設定

- **サムネイルキャッシュ**: 最大4096個（LRU）
- **ファイルリストキャッシュ**: 最大256個（メモリ）
- **キャッシュディレクトリ**: `.thumbnail-cache/`

## 🌐 外部プレイヤー対応

デバイスに応じて特定のフォーマットを外部プレイヤーで開くことができます（config.jsonで設定）:

- **iOS**: VLC（MKV, AVI, FLAC など）
- **Android**: VLC（MKV, M2TS など）
- **macOS**: IINA（AVI, FLAC, MKV など）
- **Windows**: VLC（AVI, FLAC, MKV など）

## 📄 ライセンス

ISC License
