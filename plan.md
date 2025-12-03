# CBZ/ZIP/RAR Viewer

## 概要
Node.js + Express を使った Web ベースのコミックアーカイブビューア。
CBZ/ZIP/CBR/RAR ファイルを快適に閲覧できる。

## 機能

### ファイル一覧画面
- config.json で設定したルート（複数可）のファイル・フォルダを一覧表示
- 各ルートは名前とパスで管理、URL にはルート名のみ表示（パスは非表示）
- CBZ/ZIP/CBR/RAR ファイルとフォルダを識別して表示（絵文字アイコン付き）
- CBZ/ZIP/CBR/RAR ファイルはサムネイル表示モード（タイルビュー）に対応
- キーボード操作（↑↓）でカーソル移動、Enter で開く、ESC/Backspace で戻る
- マウスクリックでも開ける
- パンくずリスト表示（ルート名/相対パス）
- ディレクトリナビゲーション（フォルダ階層の移動）
- 状態保持（ビューアから戻ったときにカーソル位置を復元）
- ダークモード/ライトモードの切り替え（macOS Finder スタイル）
- グラデーション背景、ガラスモルフィズムデザイン

### ビューア画面
- CBZ/ZIP/CBR/RAR 内の画像を自然順ソートで表示
- AVIF フォーマット対応
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
  - `ESC` / `Backspace` ファイル一覧に戻る
- マウス操作：
  - 画面左半分クリックで次のページ
  - 画面右半分クリックで前のページ
  - 画面上部10%にホバーでツールバー表示
  - 画面下部10%にホバーでページ情報表示
- ツールバー（マウスホバーで表示、1秒で自動非表示）
  - ファイル名表示
  - ✕ 閉じる、📋 リスト、🖼️ サムネイル、前/次ページ、オフセット調整、単/複表示、全画面、ヘルプ
- ファイル名リスト（サイドバー）
  - 📋 リストボタン または L キーで表示
  - 全ページのファイル名一覧
  - 現在ページをハイライト
  - クリックでページジャンプ
  - × ボタンで閉じる
  - ヘッダー固定、リスト部分のみスクロール
  - 半透明背景（0.85）、セルはほぼ透明（0.1）
- サムネイル一覧（全画面オーバーレイ）
  - 🖼️ サムネイルボタン または T キーで表示
  - グリッドレイアウトでサムネイル表示
  - 現在ページをハイライト
  - クリックでページジャンプ
  - × ボタンで閉じる
- ページ番号表示（2秒で自動非表示、キー押下で再表示）
- 読み込み時間表示（ローディング終了後に表示）
- ヘルプオーバーレイ
- ローディングインジケーター
- 黒背景、macOS Finder 風デザイン
- テーマ設定とスクロール位置の永続化（localStorage）

## 技術スタック
- Backend: Express.js 4.18.2, adm-zip 0.5.10, unrar コマンド（child_process）
- Frontend: Vanilla JavaScript, HTML5, CSS3
- ポート: 8539
- アーカイブ形式: ZIP/CBZ（adm-zip）、RAR/CBR（unrar コマンド）

## ファイル構成
```
.
├── server.js          # Express サーバー（ルート名マッピング）
├── config.json        # 設定ファイル（roots 配列: {name, path}）
├── package.json       # npm 依存関係
├── .gitignore         # node_modules と data を除外
└── public/
    ├── index.html     # ファイル一覧画面
    ├── viewer.html    # ビューア画面
    ├── viewer.js      # ビューアロジック
    └── style.css      # スタイルシート（macOS Finder 風）
```

## セットアップ
```bash
npm install
# unrar コマンドが必要（RAR/CBR 対応のため）
# Ubuntu/Debian: sudo apt install unrar
# macOS: brew install unrar
node server.js
```

ブラウザで http://localhost:8539 にアクセス

## config.json 例
```json
{
  "roots": [
    {
      "name": "comics",
      "path": "/mnt/hdd/book/comics"
    },
    {
      "name": "manga",
      "path": "/mnt/hdd/book/manga"
    }
  ]
}
```

## API エンドポイント
- `GET /api/files` - ルート一覧取得
- `GET /api/dir/:rootName/*` - ディレクトリ内容取得
- `GET /api/archive/:rootName/*/list` - アーカイブ内ファイル一覧
- `GET /api/archive/:rootName/*/image/:index` - 画像取得
- `GET /api/archive/:rootName/*/thumbnail` - サムネイル取得（先頭画像）

## URL 構造
- ファイル一覧: `/#/ルート名/相対パス`
- ビューア: `/viewer.html#/ルート名/相対パス/ファイル名.cbz`
- サーバー側でルート名を実際のパスに解決
