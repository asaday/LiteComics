# LiteComics

軽量かつ高機能なWebベースのコミック・メディアビューアシステム。標準的なブラウザ環境で、CBZ/ZIP/CBR/RAR/7Z形式のアーカイブファイルの閲覧、および各種動画・音声ファイルの再生を実現します。

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Go](https://img.shields.io/badge/go-%3E%3D1.23-00ADD8.svg)

**日本語** | [English](README.md)

## 特徴


### 機能
- **多様なフォーマットへの対応**: CBZ, ZIP, CBR, RAR, CB7, 7Z, EPUB（画像のみ）
- **マルチメディア再生**: 動画ファイル（MP4, MKV, WebM等）および音声ファイル（MP3, FLAC等）の再生
- **見開き表示機能**: 右綴じレイアウトの自動判定と最適な表示
- **サムネイルビュー**: グリッド形式による高速なページプレビュー
- **ファイルリスト表示**: サイドバーによる構造化されたページ一覧
- **キーボード操作対応**: 効率的なナビゲーションのための包括的なショートカット
- **キャッシング機構**: サムネイルおよびファイルリストの効率的なキャッシュ管理
- **テーマ切替**: ライトモード・ダークモードの選択
- **UI スケーリング**: 全体表示の拡大縮小機能（50-200%）

## インストール

### 方法1: Dockerで実行

Docker環境があれば、Go環境や依存関係のインストールなしで簡単に起動できます。

#### セットアップ

1. **docker-compose.yml をダウンロード:**

```bash
curl -O https://raw.githubusercontent.com/asaday/LiteComics/main/docker-compose.yml
```

または手動でダウンロード: [docker-compose.yml](https://raw.githubusercontent.com/asaday/LiteComics/main/docker-compose.yml)

2. **フォルダのパスを設定:**

`docker-compose.yml` を開いて、あなたのフォルダのパスに変更します:

```yaml
services:
  viewer:
    # ...
    volumes:
      # ↓ここを変更
      - /path/to/your/comics:/data:ro
```

**例:**
- macOS: `- /Users/username/Comics:/data:ro`
- Windows: `- C:/Users/username/Comics:/data:ro`
- Linux: `- /home/username/comics:/data:ro`

`:ro` は読み取り専用マウントを意味します（ファイルの誤削除を防ぐため）。

**注意:** 設定ファイルは自動的に永続化されます（`config-data` ボリューム）。初回起動後、ブラウザの Settings から設定を変更できます。

3. **起動:**

```bash
docker-compose up -d
```

初回は数分かかる場合があります（GitHubからのダウンロードとDockerイメージのビルド）。

起動後、ブラウザで http://localhost:8539 にアクセスしてください。

#### ポート番号を変更する

デフォルトはポート8539ですが、`docker-compose.yml` で変更できます:

```yaml
ports:
  - "8080:8539"  # ホスト側のポート:コンテナ内のポート
```

この例では http://localhost:8080 でアクセスできます。

#### トラブルシューティング

**ポートが使用中:**
```bash
# 別のポートを使用するか、競合しているプロセスを停止
docker-compose down
# docker-compose.ymlのポートを変更してから再起動
```

**フォルダが表示されない:**
- `docker-compose.yml` のパスが正しいか確認
- フォルダの読み取り権限があるか確認
- コンテナを再起動: `docker-compose restart`

---

### 方法2: バイナリを手動ダウンロード

デスクトップやRaspberry Piで使いたい場合:

**macOS:**
1. [Releases](https://github.com/asaday/LiteComics/releases)から`litecomics-mac-*.dmg`をダウンロード
2. DMGをマウントして`LiteComics.app`をApplicationsフォルダにドラッグ
3. アプリを起動（メニューバーにアイコンが表示されます）

**Windows:**
1. [Releases](https://github.com/asaday/LiteComics/releases)から`litecomics-windows-*.zip`をダウンロード
2. ZIPを解凍
3. `litecomics.exe`をダブルクリック（システムトレイにアイコンが表示されます）

**Linux / Raspberry Pi:**
1. [Releases](https://github.com/asaday/LiteComics/releases)から適切なファイルをダウンロード
   - Intel/AMD: `litecomics-linux-amd64-*.tar.gz`
   - Raspberry Pi: `litecomics-linux-arm64-*.tar.gz`
2. 解凍して実行:
```bash
tar xzf litecomics-linux-*.tar.gz
cd litecomics-linux-*/
./litecomics
```

---

### 方法3: ワンライナーインストール（Linux）

Linux環境なら、1行のコマンドで自動インストール:

```bash
# 通常インストール（手動起動）
curl -fsSL https://raw.githubusercontent.com/asaday/LiteComics/main/install.sh | bash

# systemdサービスとして自動起動
curl -fsSL https://raw.githubusercontent.com/asaday/LiteComics/main/install.sh | sudo bash -s -- --service
```

インストール後:
```bash
# 手動起動の場合
litecomics
# 設定ファイル: ~/.config/LiteComics/config.json

# サービスの場合
sudo systemctl status litecomics
# 設定ファイル: /etc/litecomics/config.json
```

---

### ソースからビルド（開発者向け）

```bash
git clone https://github.com/asaday/LiteComics.git
cd LiteComics
make build
cd src && ./litecomics
```

または開発用に直接実行:
```bash
# GUI版（macOS/Windows）を実行
cd src
go run .

# CUI版（Linux用）をmacOSでデバッグ
cd src
go run -tags cui .
```

#### システムにインストール（Linux）

```bash
# バイナリをインストール
sudo make install

# systemdサービスとして登録（Linuxのみ）
sudo make install-service
# 設定ファイルは /etc/litecomics/config.json に配置されます

# アンインストール
sudo make uninstall
sudo make uninstall-service  # サービスも削除する場合
```

## 設定


### 設定の変更

- **GUI（Desktop版）**: メニューバー/システムトレイのアイコン → Settings
- **ブラウザ**: 右上のメニュー(☰) → ⚙️ Settings
- **ファイル**: `config.json` を直接編集
  - systemdサービス: `/etc/litecomics/config.json`
  - 手動実行: `~/.config/LiteComics/config.json`

## システム要件

- **メモリ**: 最小256MB、推奨512MB以上
- **ストレージ**: サムネイルキャッシュ用に数百MB
- **ブラウザ**: Chrome、Firefox、Safari、Edge等のモダンブラウザ

## 使い方

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
| `Space` | 次ページ |
| `↑` / `↓` | ページオフセット調整 |
| `S` | シングル/見開き表示切替 |
| `Enter` | フルスクリーン切替 |
| `P` | サムネイル一覧表示 |
| `F` | ファイル名リスト表示/非表示 |
| `H` | ヘルプ表示/非表示 |
| `ESC` / `Backspace` | ファイルリストに戻る（サイドバー等が開いている場合は閉じる） |

#### マウス操作

- **左半分クリック**: 次ページ
- **右半分クリック**: 前ページ
- **上部ホバー**: ツールバー表示
- **下部ホバー**: ページ情報表示

### ツールバー

- **✕ 閉じる**: ファイルリストに戻る
- **Pages**: サムネイル一覧表示
- **Files**: ファイル名リスト表示
- **◀◀ / ▶▶**: ページ送り
- **◀ / ▶**: ページオフセット調整
- **Single/Double**: 表示モード切替
- **Fullscreen**: フルスクリーンモード
- **Help**: ヘルプ表示

## 技術スタック

- **バックエンド**: Go 1.23+
- **HTTPルーター**: gorilla/mux
- **アーカイブ処理**: 
  - ZIP: Go標準ライブラリ（archive/zip）
  - RAR: github.com/nwaples/rardecode/v2
  - 7Z: github.com/bodgit/sevenzip
- **フロントエンド**: Vanilla JavaScript, HTML5, CSS3（各HTMLファイルは独立動作）
- **ルーティング**: ハッシュベースのクライアントサイドルーティング
- **ストレージ**: localStorage（設定）, sessionStorage（ナビゲーション状態）


## APIエンドポイント

| エンドポイント | 説明 |
|---------------|------|
| `GET /api/roots` | ルート一覧を取得 |
| `GET /api/dir/:root/*` | ディレクトリ内容を取得 |
| `GET /api/book/:root/:path(*)/list` | アーカイブ内ファイル一覧取得 |
| `GET /api/book/:root/:path(*)/image/:index` | アーカイブから画像取得 |
| `GET /api/book/:root/:path(*)/thumbnail` | サムネイル取得（LRUキャッシュ） |
| `GET /api/media/:root/:path(*)` | メディアファイル取得（動画・音声、Range対応） |
| `GET /api/media-url/:root/:path(*)` | メディアURL取得（デバイス判定、外部プレイヤー対応） |
| `GET /api/file/:root/:path(*)` | 任意のファイル取得 |

## 対応フォーマット

### アーカイブ（コミック）
- **CBZ, ZIP**: Go標準ライブラリ（archive/zip）
- **CBR, RAR**: github.com/nwaples/rardecode/v2
- **CB7, 7Z**: github.com/bodgit/sevenzip
- **EPUB**: 部分対応

### メディア
- **動画**: MP4, MKV, WebM, AVI, MOV, M2TS, TS, WMV, FLV, MPG, MPEG
- **音声**: MP3, FLAC, WAV, OGG, M4A, AAC, WMA, Opus

### 画像
- JPG, JPEG, PNG, GIF, WebP, BMP, AVIF

## キャッシュ設定

- **サムネイルキャッシュ**: 最大4096個（LRU）
- **ファイルリストキャッシュ**: 最大256個（メモリ）
- **キャッシュディレクトリ**: `.cache/thumbnail/`

## 外部プレイヤー対応

デバイスに応じて特定のフォーマットを外部プレイヤーで開くことができます（config.jsonで設定）:

- **iOS**: VLC（MKV, AVI, FLAC など）
- **Android**: VLC（MKV, M2TS など）
- **macOS**: IINA（AVI, FLAC, MKV など）
- **Windows**: VLC（AVI, FLAC, MKV など）

## ライセンス

ISC License
