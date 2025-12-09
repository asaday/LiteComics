# LiteComics Configuration File (config.json) Reference

This file explains all configuration options available in LiteComics.

## Basic Settings

### port (Required)
- **Type**: Integer
- **Default**: 8539
- **Description**: Web server port number
- **Example**: `8539`, `8080`, `3000`

### autoOpen (Optional, GUI version only)
- **Type**: Boolean
- **Default**: `true`
- **Description**: Automatically open browser on app startup
- **Example**: `true`, `false`

### disableGUI (Optional)
- **Type**: Boolean
- **Default**: `false`
- **Description**: Disable GUI mode (settings page and tray icon)
- **Example**: `true`, `false`
- **Note**: When enabled, settings page will be inaccessible. You'll need to edit config.json manually.

### tls (Optional)
- **Type**: Object
- **Description**: TLS/HTTPS configuration. Server will use HTTPS when both files are specified.
- **Properties**:
  - `certFile`: Path to certificate file (required)
  - `keyFile`: Path to private key file (required)
- **Example**:
```json
"tls": {
  "certFile": "/path/to/cert.pem",
  "keyFile": "/path/to/key.pem"
}
```

### roots (Required)
- **Type**: Array (string or object)
- **Description**: Root directories for comic/media files

#### String format (Simple)
```json
"roots": [
  "/path/to/comics"
]
```
Directory name will be used as display name.

#### Object format (Custom name)
```json
"roots": [
  {
    "path": "/path/to/comics",
    "name": "My Comics"
  }
]
```
- `path`: Actual directory path (required)
- `name`: Display name (optional, defaults to directory name)

#### Mixed format is also possible
```json
"roots": [
  "/path/to/comics",
  {
    "path": "/path/to/manga",
    "name": "Manga Collection"
  }
]
```

## External Player Integration (handlers)

Configuration for opening specific file formats with external players on specific devices.

**Note**: This setting can only be changed by directly editing `config.json`. It cannot be changed from the settings page.

### Structure
```json
"handlers": {
  "Device Type": {
    "Player Name": {
      "ext": ["extension1", "extension2"],
      "url": "URL Scheme"
    }
  }
}
```

### Device Types
- `ios` - iPhone/iPad
- `android` - Android devices
- `mac` - Mac
- `windows` - Windows PC

### URL Scheme
The `{url}` part will be replaced with the actual file URL.

### Example: VLC on iOS
```json
"handlers": {
  "ios": {
    "VLC": {
      "ext": ["mkv", "avi", "flac", "m2ts"],
      "url": "vlc-x-callback://x-callback-url/stream?url={url}"
    }
  }
}
```

### Example: IINA on macOS
```json
"handlers": {
  "mac": {
    "IINA": {
      "ext": ["avi", "flac", "mkv", "m2ts"],
      "url": "iina://weblink?url={url}"
    }
  }
}
```

### Supported Players Examples

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

## Complete Configuration Example

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
    "ios": {
      "VLC": {
        "ext": [".mkv", ".avi", ".flac", ".m2ts"],
        "url": "vlc-x-callback://x-callback-url/stream?url={url}"
      }
    },
    "mac": {
      "IINA": {
        "ext": [".avi", ".flac", ".mkv", ".m2ts"],
        "url": "iina://weblink?url={url}"
      }
    }
  }
}
```

## Configuration File Location

### GUI Version (Desktop)
- **macOS**: `~/Library/Application Support/LiteComics/config.json`
- **Windows**: `%APPDATA%\LiteComics\config.json`

### CLI Version (Server)
- **Linux**: `~/.config/LiteComics/config.json`
- Custom path: Specify with `-c /path/to/config.json` option

## Notes

1. **Path Separators**
   - Windows: Both `/` and `\\` are supported (`/` recommended)
   - macOS/Linux: `/` only

2. **External Players**
   - The corresponding app must be installed
   - URL schemes vary by app
   - This setting must be edited in `config.json` directly

3. **TLS/HTTPS**
   - Both certificate file and private key file are required
   - Self-signed certificates are supported but will show browser warnings

4. **Configuration Priority**
   - Command line arguments > config.json > Default values

5. **Auto Reload**
   - Changes made from browser settings page are automatically saved
   - Manual file edits require server restart
   - `handlers` changes always require manual editing and server restart
