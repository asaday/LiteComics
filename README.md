# LiteComics

A lightweight and feature-rich web-based comic and media viewer system. Browse CBZ/ZIP/CBR/RAR/7Z archive files and play various video/audio files in standard browser environments.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Go](https://img.shields.io/badge/go-%3E%3D1.23-00ADD8.svg)

[日本語](README_JP.md) | **English**

## Features

### Architecture
- **Fast execution with Go**: Lightweight server running as a single binary
- **Pure Go standard library**: ZIP processing with standard library only
- **Minimal dependencies**: Only essential libraries for RAR/7Z processing

### Features
- **Multiple Format Support**: CBZ, ZIP, CBR, RAR, CB7, 7Z, EPUB (image only)
- **Multimedia Playback**: Video files (MP4, MKV, WebM, etc.) and audio files (MP3, FLAC, etc.)
- **Spread View**: Automatic detection and optimal display of right-binding layout
- **Thumbnail View**: Fast page preview in grid format
- **File List Display**: Structured page list via sidebar
- **Keyboard Controls**: Comprehensive shortcuts for efficient navigation
- **Caching Mechanism**: Efficient cache management for thumbnails and file lists
- **Theme Switching**: Light mode / dark mode selection
- **UI Scaling**: Zoom function for overall display (50-200%)

## Installation

### Method 1: Run with Docker

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

### Method 2: Download Binary Manually

For desktop or Raspberry Pi:

**macOS:**
1. Download `litecomics-mac-*.dmg` from [Releases](https://github.com/asaday/LiteComics/releases)
2. Mount DMG and drag `LiteComics.app` to Applications folder
3. Launch app (icon appears in menu bar)

**Windows:**
1. Download `litecomics-windows-*.zip` from [Releases](https://github.com/asaday/LiteComics/releases)
2. Extract ZIP
3. Double-click `litecomics.exe` (icon appears in system tray)

**Linux / Raspberry Pi:**
1. Download appropriate file from [Releases](https://github.com/asaday/LiteComics/releases)
   - Intel/AMD: `litecomics-linux-amd64-*.tar.gz`
   - Raspberry Pi: `litecomics-linux-arm64-*.tar.gz`
2. Extract and run:
```bash
tar xzf litecomics-linux-*.tar.gz
cd litecomics-linux-*/
./litecomics
```

---

### Method 3: One-liner Install (Linux)

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

On first launch, the settings screen opens in your browser. Or manually create `config.json`:

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

### Change Settings

- **GUI (Desktop version)**: Menu bar/system tray icon → Settings
- **Browser**: Top-right menu (☰) → ⚙️ Settings
- **File**: Edit `config.json` directly
  - systemd service: `/etc/litecomics/config.json`
  - Manual execution: `~/.config/LiteComics/config.json`

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


## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/roots` | Get root list |
| `GET /api/dir/:root/*` | Get directory contents |
| `GET /api/book/:root/:path(*)/list` | Get file list in archive |
| `GET /api/book/:root/:path(*)/image/:index` | Get image from archive |
| `GET /api/book/:root/:path(*)/thumbnail` | Get thumbnail (LRU cache) |
| `GET /api/media/:root/:path(*)` | Get media file (video/audio, Range support) |
| `GET /api/media-url/:root/:path(*)` | Get media URL (device detection, external player support) |
| `GET /api/file/:root/:path(*)` | Get any file |

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
