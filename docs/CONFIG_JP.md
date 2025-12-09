# LiteComics 設定ファイル (config.json) リファレンス

このファイルは、LiteComicsで利用可能な全ての設定項目を説明します。

## 基本設定

### port (必須)
- **型**: 整数
- **デフォルト**: 8539
- **説明**: Webサーバーのポート番号
- **例**: `8539`, `8080`, `3000`

### autoOpen (オプション、GUI版のみ)
- **型**: 真偽値
- **デフォルト**: `true`
- **説明**: アプリ起動時に自動的にブラウザを開く
- **例**: `true`, `false`

### disableGUI (オプション)
- **型**: 真偽値
- **デフォルト**: `false`
- **説明**: GUIモード（設定画面やトレイアイコン）を無効化
- **例**: `true`, `false`
- **注意**: 有効にすると設定画面からの変更ができなくなります。config.jsonを手動で編集する必要があります。

### tls (オプション)
- **型**: オブジェクト
- **説明**: TLS/HTTPS設定。両方のファイルを指定するとHTTPSで起動します。
- **プロパティ**:
  - `certFile`: 証明書ファイルのパス（必須）
  - `keyFile`: 秘密鍵ファイルのパス（必須）
- **例**:
```json
"tls": {
  "certFile": "/path/to/cert.pem",
  "keyFile": "/path/to/key.pem"
}
```

### roots (必須)
- **型**: 配列（文字列またはオブジェクト）
- **説明**: コミック/メディアファイルのルートディレクトリ

#### 文字列形式（シンプル）
```json
"roots": [
  "/path/to/comics"
]
```
ディレクトリ名がそのまま表示名になります。

#### オブジェクト形式（カスタム名）
```json
"roots": [
  {
    "path": "/path/to/comics",
    "name": "My Comics"
  }
]
```
- `path`: 実際のディレクトリパス（必須）
- `name`: 表示名（オプション、省略時はディレクトリ名）

#### 混在も可能
```json
"roots": [
  "/path/to/comics",
  {
    "path": "/path/to/manga",
    "name": "Manga Collection"
  }
]
```

## 外部プレイヤー連携 (handlers)

特定のデバイスで特定のファイル形式を外部プレイヤーで開く設定。

**注意**: この設定は`config.json`を直接編集することでのみ変更できます。設定画面からは変更できません。

### 構造
```json
"handlers": {
  "デバイス種別": {
    "プレイヤー名": {
      "ext": ["拡張子1", "拡張子2"],
      "url": "URLスキーム"
    }
  }
}
```

### デバイス種別
- `iOS` - iPhone/iPad
- `Android` - Androidデバイス
- `macOS` - Mac
- `Windows` - Windows PC

### URL スキーム
`{url}` の部分が実際のファイルURLに置き換えられます。

### 例: VLC on iOS
```json
"handlers": {
  "iOS": {
    "vlc": {
      "ext": ["mkv", "avi", "flac", "m2ts"],
      "url": "vlc-x-callback://x-callback-url/stream?url={url}"
    }
  }
}
```

### 例: IINA on macOS
```json
"handlers": {
  "macOS": {
    "iina": {
      "ext": ["avi", "flac", "mkv", "m2ts"],
      "url": "iina://weblink?url={url}"
    }
  }
}
```

### 対応プレイヤーの例

#### iOS
- **VLC**: `vlc-x-callback://x-callback-url/stream?url={url}`
- **Infuse**: `infuse://x-callback-url/play?url={url}`

#### Android
- **VLC**: `vlc://{url}`
- **MX Player**: `intent:{url}#Intent;package=com.mxtech.videoplayer.ad;end`

#### macOS
- **IINA**: `iina://weblink?url={url}`
- **VLC**: `vlc://{url}`

#### Windows
- **VLC**: `vlc://{url}`
- **PotPlayer**: `potplayer://{url}`

## 完全な設定例

```json
{
  "port": 8539,
  "autoOpen": true,
  "disableGUI": false,
  "tls": {
    "certFile": "/path/to/cert.pem",
    "keyFile": "/path/to/key.pem"
  },
  "roots": [
    "/Users/username/Comics",
    {
      "path": "/Volumes/NAS/Manga",
      "name": "Manga (NAS)"
    },
    {
      "path": "/Users/username/Movies",
      "name": "Movies"
    }
  ],
  "handlers": {
    "iOS": {
      "vlc": {
        "ext": ["mkv", "avi", "flac", "m2ts"],
        "url": "vlc-x-callback://x-callback-url/stream?url={url}"
      }
    },
    "macOS": {
      "iina": {
        "ext": ["avi", "flac", "mkv", "m2ts"],
        "url": "iina://weblink?url={url}"
      }
    }
  }
}
```

## 設定ファイルの場所

### GUI版（Desktop）
- **macOS**: `~/Library/Application Support/LiteComics/config.json`
- **Windows**: `%APPDATA%\LiteComics\config.json`

### CLI版（Server）
- **Linux**: `~/.config/LiteComics/config.json`
- カスタムパス: `-c /path/to/config.json` オプションで指定可能

## 注意事項

1. **パス区切り文字**
   - Windows: `/` または `\\` 両方使用可能（`/` 推奨）
   - macOS/Linux: `/` のみ

2. **外部プレイヤー**
   - 該当するアプリがインストールされている必要があります
   - URLスキームはアプリによって異なります
   - この設定は`config.json`を直接編集する必要があります

3. **TLS/HTTPS**
   - 証明書ファイルと秘密鍵ファイルの両方が必要です
   - 自己署名証明書も使用可能ですが、ブラウザに警告が表示されます

4. **設定の優先順位**
   - コマンドライン引数 > config.json > デフォルト値

5. **自動リロード**
   - ブラウザの設定画面から変更した場合は自動的に保存されます
   - 手動でファイルを編集した場合はサーバーの再起動が必要です
   - `handlers`の変更は常に手動編集とサーバー再起動が必要です
