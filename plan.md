# LiteComics

## 概要
Node.js + Express を使った Web ベースのコミック・メディアビューア。
CBZ/ZIP/CBR/RAR/7Z ファイルや動画・音声ファイルを快適に閲覧・再生できる。

## 機能

### ファイル一覧画面
- config.json で設定したルート（複数可）のファイル・フォルダを一覧表示
- 各ルートは文字列またはオブジェクト `{name, path}` で管理
- ファイルタイプを自動判定（book, video, audio, directory, file）
- アーカイブファイルはサムネイル表示（タイルビュー）
- リスト項目は自然順ソート（1, 2, 10 not 1, 10, 2）
- キーボード操作：
  - `↑/↓/←/→` カーソル移動
  - `PageUp/PageDown` 10件ずつ移動
  - `Enter` ファイルを開く
  - `ESC/Backspace` 戻る
  - `Ctrl +/-` UI全体のズーム（50-200%）
- マウス操作：
  - クリックで開く
  - A-/A+ボタンでズーム
  - 🌓ボタンでテーマ切り替え
- パンくずリスト表示（Home > ルート名 > 相対パス）
- ディレクトリナビゲーション
- 状態保持（ビューアから戻ったときにカーソル位置を復元）
- ダークモード/ライトモードの切り替え
- ズーム設定の永続化（localStorage）
- 長いファイル名は複数行表示（word-break）

### ビューア画面
- CBZ/ZIP/CBR/RAR/CB7/7Z 内の画像を自然順ソートで表示
- AVIF, WebP, BMP を含む全画像フォーマット対応
- 右から左への見開き表示（2ページ）
- 横長画像（アスペクト比 1.5 以上）は自動的に 1 ページ表示
- ブラウザが縦長表示の場合は強制的に 1 ページ表示
- ハッシュベースルーティング（#/ルート名/相対パス）
- キーボード操作：
  - `←` 次のページ
  - `→` 前のページ
  - `↑` オフセット +1（ページずらし）
  - `↓` オフセット -1（ページずらし）
  - `S` 強制 1 ページモードのトグル
  - `Enter` フルスクリーンモードのトグル
  - `H` ヘルプ表示のトグル
  - `T` サムネイル一覧表示
  - `L` ファイル名リスト表示/非表示
  - `ESC / Backspace` ファイル一覧に戻る
- マウス操作：
  - 画面左半分クリックで次のページ
  - 画面右半分クリックで前のページ
  - 画面上部10%にホバーでツールバー表示
  - 画面下部10%にホバーでページ情報表示
- ツールバー、ファイル名リスト、サムネイル一覧、ページ番号表示
- テーマ設定とスクロール位置の永続化（localStorage）

### メディアプレーヤー画面
- 動画・音声ファイルの再生
- HTML5 video/audio タグ使用
- Range リクエスト対応（シーク可能）
- デバイス判定による外部プレイヤー起動（VLC, IINA等）
- 対応フォーマット：
  - 動画: MP4, MKV, WebM, AVI, MOV, M2TS, TS, WMV, FLV, MPG, MPEG
  - 音声: MP3, FLAC, WAV, OGG, M4A, AAC, WMA, Opus

## 技術スタック
- Backend: Express.js 4.18.2, adm-zip 0.5.10
- Archive: unrar/7z コマンド（child_process）
- Frontend: Vanilla JavaScript, HTML5, CSS3
- デフォルトポート: 8539（設定可能）
- アーカイブ形式: ZIP/CBZ（adm-zip）、RAR/CBR（unrar）、7Z/CB7（7z）

## ファイル構成
```
.
├── server.js          # Express サーバー（CLIオプション対応）
├── config.json        # 設定ファイル（port, roots, handlers）
├── package.json       # npm 依存関係（bin: litecomics
├── .gitignore         # node_modules, .thumbnail-cache 等を除外
├── README.md          # ドキュメント
├── plan.md            # このファイル
└── public/
    ├── index.html     # ファイル一覧画面
    ├── viewer.html    # ビューア画面
    ├── media.html     # メディアプレーヤー画面
    └── favicon.svg    # アイコン
```

## セットアップ
```bash
npm install
npm link  # グローバルコマンドとしてインストール

# 必要なコマンド
# Ubuntu/Debian: sudo apt install unrar p7zip-full
# macOS: brew install unrar p7zip

# 起動
litecomics
litecomics -p 3000
litecomics -r /path/to/comics
litecomics -c custom-config.json
```

ブラウザで表示されたURLにアクセス

## config.json 例
```json
{
  "port": 8539,
  "roots": [
    "/path/to/comics",
    {
      "path": "/path/to/manga",
      "name": "Manga"
    }
  ],
  "handlers": {
    "ios": {
      "VLC": {
        "ext": [".mkv", ".avi", ".flac"],
        "url": "vlc-x-callback://x-callback-url/stream?url={url}"
      }
    }
  }
}
```

## CLI オプション
```
litecomics [options]

Options:
  -c, --config <path>  設定ファイルパス (default: ./config.json)
  -p, --port <number>  ポート番号 (default: 8539)
  -r, --root <path>    ルートディレクトリ追加（複数指定可）
  -h, --help           ヘルプ表示
```

## API エンドポイント
- `GET /api/roots` - ルート一覧取得
- `GET /api/dir/*` - ディレクトリ内容取得
- `GET /api/book/:filename(*)/list` - アーカイブ内ファイル一覧
- `GET /api/book/:filename(*)/image/:index` - 画像取得
- `GET /api/book/:filename(*)/thumbnail` - サムネイル取得（LRUキャッシュ）
- `GET /api/media/:filename(*)` - メディアストリーミング（Range対応）
- `GET /api/media-url/:filename(*)` - メディアURL取得（デバイス判定）
- `GET /api/file/:filename(*)` - 任意ファイル取得

## キャッシュ
- サムネイルキャッシュ: 最大4096件（LRU）、`.thumbnail-cache/`
- ファイルリストキャッシュ: 最大256件（メモリ）

## URL 構造
- ファイル一覧: `/?dir=ルート名/相対パス`
- ビューア: `/viewer.html#/ルート名/相対パス/ファイル名.cbz`
- メディア: `/media.html#/ルート名/相対パス/ファイル名.mp4`
- サーバー側でルート名を実際のパスに解決
