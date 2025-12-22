# LiteComics

A lightweight and feature-rich web-based comic and media viewer system. Browse CBZ/ZIP/CBR/RAR/7Z archive files and play various video/audio files in standard browser environments.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Go](https://img.shields.io/badge/go-%3E%3D1.23-00ADD8.svg)

[日本語](docs/README_JP.md) | **English**

## Introduction

For more information and live demonstration, visit:
- [Introduction Page](https://asaday.github.io/LiteComics/)
- [Online Demo](https://asaday.github.io/LiteComics/__demo__/)

## Features

### Features
- **Go-based high-performance server**: Extremely small binary size with fast execution
- **Archive format support**: ZIP, CBZ, RAR, CBR, 7Z, CB7, EPUB (image only)
- **Media playback**: MP4, MKV, WebM, MP3, FLAC, etc.
- **Caching system**: Efficient cache management for thumbnails and file lists
- **Web-based responsive interface**: Modern browser support
- **No external dependencies**: No database or additional software required
- **Modern browser support**: Chrome, Firefox, Safari, Edge
- **Mobile device support**: iPhone, iPad, Android tablets and phones
- **Low memory footprint**: 256MB minimum, 512MB recommended
- **Docker support**: Easy deployment
- **Cross-platform**: macOS, Linux, Windows
- **Desktop GUI app**: System tray integration
- **Configurable**: Via web UI or JSON configuration file

## Installation

- [macOS](#macos)
- [Windows](#windows)
- [Docker](#docker)
- [Linux (systemd)](#linux-systemd)
- [Build from Source](#build-from-source-for-developers)

### macOS

1. Download `litecomics-mac-*.dmg` from [Releases](https://github.com/asaday/LiteComics/releases)
2. Mount DMG and drag `LiteComics.app` to Applications folder
3. Launch app (icon appears in menu bar)

---

### Windows

1. Download `litecomics-windows-*.zip` from [Releases](https://github.com/asaday/LiteComics/releases)
2. Extract ZIP
3. Double-click `litecomics.exe` (icon appears in system tray)

---

### Docker

If you have Docker, you can start easily without installing Go or dependencies.

#### Setup

1. **Download docker-compose.yml:**

```bash
curl -O https://raw.githubusercontent.com/asaday/LiteComics/main/docker-compose.yml
```

Or download manually: [docker-compose.yml](https://raw.githubusercontent.com/asaday/LiteComics/main/docker-compose.yml)

2. **Set folder path:**

Open `docker-compose.yml` and change to your folder path:

```yaml
services:
  viewer:
    # ...
    volumes:
      # ↓Change here
      - /path/to/your/comics:/data:ro
```

**Examples:**
- macOS: `- /Users/username/Comics:/data:ro`
- Windows: `- C:/Users/username/Comics:/data:ro`
- Linux: `- /home/username/comics:/data:ro`

`:ro` means read-only mount (to prevent accidental file deletion).

**Note:** Config file is automatically persisted (`config-data` volume). After first startup, you can change settings from Settings in the browser.

3. **Start:**

```bash
docker-compose up -d
```

First run may take a few minutes (downloading from GitHub and building Docker image).

After startup, access http://localhost:8539 in your browser.

#### Change Port Number

Default is port 8539, but you can change it in `docker-compose.yml`:

```yaml
ports:
  - "8080:8539"  # Host port:Container port
```

In this example, you can access at http://localhost:8080.

#### Troubleshooting

**Port in use:**
```bash
# Use a different port or stop conflicting process
docker-compose down
# Change port in docker-compose.yml then restart
```

**Folder not shown:**
- Check if path in `docker-compose.yml` is correct
- Check if folder has read permission
- Restart container: `docker-compose restart`

---

### Linux (systemd)

For Linux environments, automatic installation with one command:

```bash
# Normal install (manual start)
curl -fsSL https://raw.githubusercontent.com/asaday/LiteComics/main/install.sh | bash

# Auto-start as systemd service
curl -fsSL https://raw.githubusercontent.com/asaday/LiteComics/main/install.sh | sudo bash -s -- --service
```

After installation:
```bash
# For manual start
litecomics
# Config file: ~/.config/LiteComics/config.json

# For service
sudo systemctl status litecomics
# Config file: /etc/litecomics/config.json
```

---

### Build from Source (For Developers)

```bash
git clone https://github.com/asaday/LiteComics.git
cd LiteComics
make build
cd src && ./litecomics
```

Or run directly for development:
```bash
# Run GUI version (macOS/Windows)
cd src
go run .

# Debug CUI version (for Linux) on macOS
cd src
go run -tags cui .
```

#### Install to System (Linux)

```bash
# Install binary
sudo make install

# Register as systemd service (Linux only)
sudo make install-service
# Config file will be placed at /etc/litecomics/config.json

# Uninstall
sudo make uninstall
sudo make uninstall-service  # Also remove service
```

## Configuration

### First Launch

Settings screen opens from the menu. Or manually edit `config.json`:

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

**For detailed configuration options, see [CONFIG.md](docs/CONFIG.md).**

### Change Settings

- **GUI (Desktop version)**: Menu bar/system tray icon → Settings
- **Browser**: Top-right menu (☰) → ⚙️ Settings
- **File**: Edit `config.json` directly
  - systemd service: `/etc/litecomics/config.json`
  - Manual execution: `~/.config/LiteComics/config.json`

### TLS/HTTPS Configuration

To start with HTTPS, add the following to `config.json`:

```json
{
  "port": 8539,
  "tls": {
    "certFile": "/path/to/cert.pem",
    "keyFile": "/path/to/key.pem"
  },
  "roots": [...]
}
```

- Both certificate file and private key file are required
- Self-signed certificates are supported but will show browser warnings
- See [CONFIG.md](docs/CONFIG.md) for details

## System Requirements

- **Memory**: Minimum 256MB, recommended 512MB or more
- **Storage**: Several hundred MB for thumbnail cache
- **Browser**: Modern browsers like Chrome, Firefox, Safari, Edge

## Usage

### File List Screen

#### Keyboard Controls

| Key | Function |
|-----|----------|
| `↑` / `↓` | Move cursor |
| `←` / `→` | Move cursor |
| `PageUp` / `PageDown` | Move by 10 items |
| `Enter` | Open file |
| `ESC` / `Backspace` | Go back to parent directory |
| `Ctrl` + `-` | Decrease UI size |
| `Ctrl` + `+` | Increase UI size |

#### Mouse Controls

- **Click**: Open file or folder
- **A-/A+ buttons**: Zoom entire UI
- **🌓 button**: Toggle light/dark theme

### Viewer Screen

#### Keyboard Controls

| Key | Function |
|-----|----------|
| `←` / `→` | Page navigation (right-binding) |
| `Space` | Next page |
| `↑` / `↓` | Adjust page offset |
| `S` | Toggle single/spread display mode |
| `Enter` | Toggle fullscreen mode |
| `P` | Show thumbnail grid |
| `F` | Show/hide file name list |
| `H` | Show/hide help |
| `ESC` / `Backspace` | Return to file list (or close sidebar/overlay if open) |

#### Mouse Controls

- **Click left half**: Next page
- **Click right half**: Previous page
- **Hover top area**: Show toolbar
- **Hover bottom area**: Show page info

### Toolbar

- **✕ Close**: Return to file list
- **Pages**: Show thumbnail grid
- **Files**: Show file name list
- **◀◀ / ▶▶**: Page navigation
- **◀ / ▶**: Page offset adjustment
- **Single/Double**: Toggle display mode
- **Fullscreen**: Fullscreen mode
- **Help**: Show help

## Tech Stack

- **Backend**: Go 1.23+
- **HTTP Router**: gorilla/mux
- **Archive Processing**: 
  - ZIP: Go standard library (archive/zip)
  - RAR: github.com/nwaples/rardecode/v2
  - 7Z: github.com/bodgit/sevenzip
- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (each HTML file is standalone)
- **Routing**: Hash-based client-side routing
- **Storage**: localStorage (settings), sessionStorage (navigation state)




## Supported Formats

### Archives (Comics)
- **CBZ, ZIP**: Go standard library (archive/zip)
- **CBR, RAR**: github.com/nwaples/rardecode/v2
- **CB7, 7Z**: github.com/bodgit/sevenzip
- **EPUB**: Partial support

### Media
- **Video**: MP4, MKV, WebM, AVI, MOV, M2TS, TS, WMV, FLV, MPG, MPEG
- **Audio**: MP3, FLAC, WAV, OGG, M4A, AAC, WMA, Opus

### Images
- JPG, JPEG, PNG, GIF, WebP, BMP, AVIF

## Cache Configuration

- **Thumbnail Cache**: Maximum 4096 items (LRU)
- **File List Cache**: Maximum 256 items (memory)
- **Cache Directory**: `.cache/thumbnail/`

## External Player Support

Certain formats can be opened with external players based on device (configured in config.json):

- **iOS**: VLC (MKV, AVI, FLAC, etc.)
- **Android**: VLC (MKV, M2TS, etc.)
- **macOS**: IINA (AVI, FLAC, MKV, etc.)
- **Windows**: VLC (AVI, FLAC, MKV, etc.)

## License

ISC License
