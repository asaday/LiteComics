# LiteComics

**The lightest comic viewer ever.** No build process, no frameworks, just vanilla JavaScript + HTML.

Browse CBZ/ZIP/CBR/RAR/7Z files and play video/audio files comfortably in your browser.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![Size](https://img.shields.io/badge/bundle-0KB-brightgreen.svg)
![Dependencies](https://img.shields.io/badge/frontend-0%20dependencies-brightgreen.svg)

[日本語](README.md) | **English**

## ✨ Features

### 🪶 Ultra-Lightweight Design
- **Zero Frontend Dependencies**: No React/Vue/Angular needed
- **No Build Process**: No webpack/Vite/Rollup required, runs directly
- **Vanilla JS + HTML**: Pure JavaScript/HTML/CSS only
- **Minimal Backend**: Express.js + 2 archive libraries only

### 📚 Rich Features
- **Multiple Format Support**: CBZ, ZIP, CBR, RAR, CB7, 7Z, EPUB (images only)
- **Media Playback**: Video & audio file support (MP4, MKV, WebM, MP3, FLAC, etc.)
- **Spread View**: Natural right-to-left spread display (wide images automatically shown as single page)
- **Thumbnail Grid**: Quick page browsing with grid layout
- **File List**: Sidebar with page name list
- **Keyboard Shortcuts**: Comfortable navigation
- **Fast Display**: Thumbnail and file list caching
- **Dark Mode**: Light/dark theme switching
- **Zoom Function**: UI scaling (50-200%)

## 🚀 Quick Start

### Requirements

- Node.js 14.0.0 or higher
- unrar command (for RAR/CBR files)
- 7z command (for 7Z/CB7 files)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd LiteComics

# Install dependencies
npm install

# Install as command-line tool (optional)
npm link

# Install required commands
# Ubuntu/Debian:
sudo apt install unrar p7zip-full

# macOS:
brew install unrar p7zip
```

### Configuration

Create `config.json` and specify comic file locations and port number:

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

### Start

```bash
# Use config file
litecomics

# Specify port
litecomics -p 3000

# Specify root directories directly
litecomics -r /path/to/comics -r /path/to/movies

# Use custom config file
litecomics -c /path/to/config.json

# Show help
litecomics --help
```

Access the URL displayed in the browser.

## 📝 Command Line Options

```
litecomics [options]

Options:
  -c, --config <path>  Specify config file path (default: ./config.json)
  -p, --port <number>  Specify port number (default: 8539)
  -r, --root <path>    Add root directory (can be used multiple times)
  -h, --help           Show this help message

Examples:
  litecomics
  litecomics -p 3000
  litecomics -r /path/to/comics -r /another/path
  litecomics -c custom-config.json -p 3000
```

## 🔄 Running in Background with PM2

PM2 is recommended for production environments or servers that need to run continuously.

### Install PM2

```bash
npm install -g pm2
```

### Start with PM2

```bash
# Start application
pm2 start server.js --name litecomics

# Start with custom port
pm2 start server.js --name litecomics -- -p 3000

# Check status
pm2 status

# View logs
pm2 logs litecomics

# Restart
pm2 restart litecomics

# Stop
pm2 stop litecomics

# Delete
pm2 delete litecomics
```

### Auto-start on System Boot

```bash
# Save current PM2 processes
pm2 save

# Enable PM2 auto-start on system boot
pm2 startup
# Execute the displayed command (may require sudo)
```

## 🐳 Running with Docker

Docker Compose makes it easy to start without installing dependencies.

### Start with Docker Compose

1. Edit `docker-compose.yml` and set the path to comic files:

```yaml
volumes:
  - /path/to/your/comics:/data:ro
```

2. Build and start the container:

```bash
docker-compose up -d
```

3. Access http://localhost:8539 in your browser

### Docker Commands

```bash
# View logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart

# Rebuild
docker-compose up -d --build
```

### Using Custom Configuration

Uncomment in `docker-compose.yml` to mount `config.json`:

```yaml
volumes:
  - ./config.json:/app/config.json:ro
```

## 🎮 Usage

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
| `↑` / `↓` | Adjust page offset |
| `S` | Toggle single/spread display mode |
| `Enter` | Toggle fullscreen mode |
| `T` | Show thumbnail grid |
| `L` | Show/hide file name list |
| `H` | Show/hide help |
| `ESC` / `Backspace` | Return to file list |

#### Mouse Controls

- **Click left half**: Next page
- **Click right half**: Previous page
- **Hover top area**: Show toolbar
- **Hover bottom area**: Show page info

### Toolbar

- **✕ Close**: Return to file list
- **📋 List**: Show file name list
- **🖼️ Thumbnail**: Show thumbnail grid
- **◀◀ / ▶▶**: Page navigation
- **◀ / ▶**: Page offset adjustment
- **Single/Spread**: Toggle display mode
- **Fullscreen**: Fullscreen mode
- **Help**: Show help

## 🏗️ Tech Stack

- **Backend**: Express.js 4.18.2
- **Archive Handling**: adm-zip 0.5.10, unrar (command-line), 7z (command-line)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (each HTML file is standalone)
- **Routing**: Hash-based client-side routing
- **Storage**: localStorage (settings), sessionStorage (navigation state)

## 📁 Project Structure

```
.
├── server.js          # Express server
├── config.json        # Configuration file
├── package.json       # Dependencies
├── README.md          # Documentation (Japanese)
├── README_EN.md       # This file
└── public/
    ├── index.html     # File list screen
    ├── viewer.html    # Comic viewer screen
    ├── media.html     # Media player screen
    └── favicon.svg    # Icon
```

## 🔧 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/roots` | Get root list |
| `GET /api/dir/*` | Get directory contents |
| `GET /api/book/:filename(*)/list` | Get file list in archive |
| `GET /api/book/:filename(*)/image/:index` | Get image from archive |
| `GET /api/book/:filename(*)/thumbnail` | Get thumbnail (LRU cache) |
| `GET /api/media/:filename(*)` | Get media file (video/audio, Range support) |
| `GET /api/media-url/:filename(*)` | Get media URL (device detection, external player support) |
| `GET /api/file/:filename(*)` | Get any file |

## 🎨 Supported Formats

### Archives (Comics)
- **CBZ, ZIP**: JavaScript (adm-zip)
- **CBR, RAR**: unrar command
- **CB7, 7Z**: 7z command
- **EPUB**: Partial support

### Media
- **Video**: MP4, MKV, WebM, AVI, MOV, M2TS, TS, WMV, FLV, MPG, MPEG
- **Audio**: MP3, FLAC, WAV, OGG, M4A, AAC, WMA, Opus

### Images
- JPG, JPEG, PNG, GIF, WebP, BMP, AVIF

## 💾 Cache Configuration

- **Thumbnail Cache**: Maximum 4096 items (LRU)
- **File List Cache**: Maximum 256 items (memory)
- **Cache Directory**: `.thumbnail-cache/`

## 🌐 External Player Support

Certain formats can be opened with external players based on device (configured in config.json):

- **iOS**: VLC (MKV, AVI, FLAC, etc.)
- **Android**: VLC (MKV, M2TS, etc.)
- **macOS**: IINA (AVI, FLAC, MKV, etc.)
- **Windows**: VLC (AVI, FLAC, MKV, etc.)

## 📄 License

ISC License
