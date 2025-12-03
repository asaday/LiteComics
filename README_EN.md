# LiteComics

A simple and feature-rich web-based comic archive viewer built with vanilla JavaScript. Browse CBZ/ZIP/CBR/RAR files comfortably in your browser.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)

[日本語](README.md) | **English**

## ✨ Features

- 📚 **Multiple Format Support**: CBZ, ZIP, CBR, RAR, AVIF
- 📖 **Spread View**: Natural right-to-left spread display (wide images automatically shown as single page)
- 🖼️ **Thumbnail Grid**: Quick page overview with grid layout
- 📋 **Page List**: Sidebar with page filenames
- ⌨️ **Keyboard Shortcuts**: Smooth navigation controls
- 🎨 **macOS Finder Design**: Polished dark mode UI with glassmorphism
- 🔒 **Privacy Protection**: Filesystem paths hidden from URLs
- 🚀 **Fast Loading**: Image caching and smooth rendering
- 🌐 **Web-Based**: No installation needed, works in any modern browser
- 🪶 **Lightweight**: Built with vanilla JavaScript, no heavy frameworks

## 🚀 Quick Start

### Requirements

- Node.js 14.0.0 or higher
- unrar command (for RAR/CBR support)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd viewer

# Install dependencies
npm install

# Install unrar (for RAR/CBR support)
# Ubuntu/Debian:
sudo apt install unrar

# macOS:
brew install unrar
```

### Configuration

Create `config.json` and specify comic file locations:

```json
{
  "roots": [
    {
      "name": "comics",
      "path": "/path/to/your/comics"
    },
    {
      "name": "manga",
      "path": "/path/to/your/manga"
    }
  ]
}
```

### Run

```bash
node server.js
```

Open http://localhost:8539 in your browser.

## 🔄 PM2 Background Service

For production or server deployment, PM2 is recommended.

### Install PM2

```bash
npm install -g pm2
```

### PM2 Commands

```bash
# Start application
pm2 start server.js --name litecomics

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

# Setup PM2 startup script
pm2 startup
# Run the command shown (may require sudo)
```

## 🐳 Docker Deployment

Docker Compose makes deployment simple without manual dependency installation.

### Docker Compose Setup

1. Edit `docker-compose.yml` to set comic file paths:

```yaml
volumes:
  - /path/to/your/comics:/data:ro
```

2. Build and start container:

```bash
docker-compose up -d
```

3. Open http://localhost:8539 in your browser

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

### Custom Configuration

Uncomment in `docker-compose.yml` to mount `config.json`:

```yaml
volumes:
  - ./config.json:/app/config.json:ro
```

## 🎮 Usage

### File List Screen

- **↑/↓**: Move cursor
- **Enter**: Open file
- **ESC/Backspace**: Go to parent directory
- **Click**: Open file or folder

### Viewer Screen

#### Keyboard Controls

| Key | Function |
|-----|----------|
| `←` / `→` | Navigate pages (right-to-left) |
| `↑` / `↓` | Adjust page offset |
| `Space` | Next page(s) |
| `S` | Toggle single/spread mode |
| `Enter` | Toggle fullscreen |
| `T` | Show thumbnail grid |
| `L` | Toggle page list sidebar |
| `H` | Toggle help |
| `ESC` / `Backspace` | Return to file list |

#### Mouse Controls

- **Click left half**: Next page
- **Click right half**: Previous page
- **Hover top**: Show toolbar
- **Hover bottom**: Show page info

#### Toolbar

- **✕ Close**: Return to file list
- **📋 List**: Show page list
- **🖼️ Thumbnails**: Show thumbnail grid
- **◀◀ / ▶▶**: Navigate pages
- **◀ / ▶**: Adjust page offset
- **Single/Spread**: Toggle display mode
- **Fullscreen**: Toggle fullscreen mode
- **?**: Show help

## 🏗️ Tech Stack

- **Backend**: Express.js 4.18.2
- **Archive Handling**: adm-zip 0.5.10, unrar (command-line)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Routing**: Hash-based client-side routing
- **Storage**: localStorage (settings), sessionStorage (navigation state)

## 📁 Project Structure

```
.
├── server.js          # Express server
├── config.json        # Configuration file
├── package.json       # Dependencies
├── README.md          # This file
└── public/
    ├── index.html     # File list screen
    ├── viewer.html    # Viewer screen
    ├── viewer.js      # Viewer logic
    └── style.css      # Stylesheets
```

## 🔧 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/files` | List roots |
| `GET /api/dir/:rootName/*` | List directory contents |
| `GET /api/archive/:rootName/*/list` | List archive files |
| `GET /api/archive/:rootName/*/image/:index` | Get image |
| `GET /api/archive/:rootName/*/thumbnail` | Get thumbnail |

## 📄 License

MIT License
