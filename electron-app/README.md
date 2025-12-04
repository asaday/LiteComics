# LiteComics Desktop

LiteComicsのWindows/macOS/Linuxデスクトップアプリケーション版です。

## 特徴

- **スタンドアロン実行**: ブラウザ不要で単独で動作
- **GUI設定画面**: 設定ファイルを直接編集せずにGUIで設定可能
- **ネイティブメニュー**: OS標準のメニューバーを利用
- **自動サーバー起動**: アプリ起動時に自動でサーバーが起動
- **クロスプラットフォーム**: Windows, macOS, Linux対応

## 開発

### 必要な環境

- Node.js 18以上
- npm または yarn

### セットアップ

```bash
# Electronアプリのディレクトリに移動
cd electron-app

# 依存関係をインストール
npm install

# 親ディレクトリの依存関係も必要です（まだインストールしていない場合）
cd ..
npm install
```

### 開発モードで起動

```bash
cd electron-app
npm start
```

アプリケーションが起動し、自動的にLiteComicsのWebインターフェースが表示されます。

### 開発者ツール

アプリ起動後、`Ctrl+Shift+I` (Windows/Linux) または `Cmd+Option+I` (macOS) で開発者ツールを開けます。

## ビルド

### Windows用ビルド

```bash
cd electron-app
npm run build:win
```

生成物: `electron-app/dist/LiteComics Setup [version].exe`

### macOS用ビルド

```bash
cd electron-app
npm run build:mac
```

生成物: `electron-app/dist/LiteComics-[version].dmg`

### Linux用ビルド

```bash
cd electron-app
npm run build:linux
```

生成物: `electron-app/dist/LiteComics-[version].AppImage`

### すべてのプラットフォーム向けにビルド

```bash
cd electron-app
npm run build
```

## 使い方

### 初回起動

1. アプリを起動すると、自動的にデフォルト設定が作成されます
2. メニューバーの「ファイル」→「⚙️ 設定」から設定画面を開きます
3. 「📁 フォルダを追加」ボタンでコミックやメディアファイルがあるフォルダを追加
4. 「💾 保存」をクリックして設定を保存
5. アプリを再起動すると設定が反映されます

### 設定ファイルの場所

設定ファイルは以下の場所に保存されます：

- **Windows**: `%APPDATA%/litecomics-desktop/config.json`
- **macOS**: `~/Library/Application Support/litecomics-desktop/config.json`
- **Linux**: `~/.config/litecomics-desktop/config.json`

メニューバーの「ファイル」→「設定フォルダを開く」から直接アクセスできます。

### キーボードショートカット

- `Ctrl/Cmd + ,` - 設定画面を開く
- `Ctrl/Cmd + R` - ページを再読み込み
- `F11` - フルスクリーン切替
- `Ctrl/Cmd + Shift + I` - 開発者ツール
- `Ctrl/Cmd + Q` - アプリを終了

## トラブルシューティング

### サーバーが起動しない

- ポート番号が既に使用されている可能性があります
- 設定画面でポート番号を変更してください（デフォルト: 8539）

### 設定が反映されない

- 設定を変更した後は、アプリを再起動する必要があります
- 「ファイル」→「終了」でアプリを完全に終了させてから再起動してください

### ファイルが表示されない

- ルートディレクトリが正しく設定されているか確認してください
- フォルダの読み取り権限があるか確認してください

## アーキテクチャ

```
electron-app/
├── main.js           # Electronメインプロセス（ウィンドウ管理、サーバー起動）
├── preload.js        # セキュアなIPC通信用プリロードスクリプト
├── ipc-handlers.js   # IPCハンドラー（設定の読み書き、ダイアログ）
├── menu.js           # アプリケーションメニューの定義
├── settings.html     # 設定画面のUI
├── settings.js       # 設定画面のロジック
├── package.json      # Electron用の依存関係とビルド設定
└── build/            # アイコンなどのビルドアセット
```

アプリは親ディレクトリの `server.js` を子プロセスとして実行し、`public/` フォルダのWebインターフェースを表示します。

## ライセンス

親プロジェクトのライセンスに準じます。

## リンク

- [LiteComics 本体](https://github.com/asaday/LiteComics)
- [Electron 公式ドキュメント](https://www.electronjs.org/docs)
