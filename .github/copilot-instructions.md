# LiteComics Copilot Instructions

## Project Overview

LiteComics is a lightweight Go-based web server for viewing comics (CBZ/ZIP/RAR/7Z) and playing media files. Single-binary application with embedded web UI, supports both CLI mode and GUI mode with system tray (desktop apps).

## Architecture

### Two-Binary Strategy via Build Tags

- **`main.go`** (build tag: `linux || cui`): CLI-only server for Linux/Docker
- **`main_gui.go`** (build tag: `(darwin || windows) && !cui`): Desktop GUI with systray integration for macOS/Windows
- Shared server logic in `server.go`, `handlers.go`, `config.go`, `cache.go`, `archive.go`

### Embedded Assets Pattern

- Production: Web UI assets embedded using `//go:embed public-minified` in `server.go`
- Development: Falls back to external `src/public/` directory if available
- Minification: Run `make minify` (or `cd src && node minify.js`) to generate `public-minified/` before building
- Icons embedded in `main_gui.go` for tray functionality

### Key Components

- **Server** (`server.go`): HTTP server with Gorilla Mux router, manages two caches
- **Handlers** (`handlers.go`): API endpoints for roots, directories, archive contents, thumbnails, media streaming
- **Archive** (`archive.go`): ZIP/RAR/7Z extraction with Shift_JIS → UTF-8 conversion for Japanese filenames
- **Cache** (`cache.go`): In-memory LRU caches for thumbnails and image lists, disk-backed thumbnails
- **Config** (`config.go`): JSON config with CLI flag parsing, handles both object and string formats for roots

## Build & Development Workflow

### Building

```bash
# Build for current platform (automatically runs minify)
make build

# Build for specific platforms
make build-linux        # Linux AMD64 (CGO_ENABLED=0, static)
make build-linux-arm64  # Linux ARM64 (static)
make build-mac-arm64    # macOS Apple Silicon
make build-windows      # Windows (requires MinGW for CGO)

# CLI-only build (no systray)
make build-cui
```

### Minification (REQUIRED before release builds)

```bash
make minify
# OR
cd src && node minify.js
```

This inlines CSS/JS into HTML files and outputs to `src/public-minified/`, which gets embedded into the binary.

### Running Locally

```bash
# Development mode (uses src/public/ directory)
cd src && go run . --config ../config.json.example

# Or with make
make run
```

### Testing

No test files exist currently. When adding tests, place in `src/` as `*_test.go`.

## Configuration Patterns

### Config File Structure (`config.json`)

- **Port**: Default 8539
- **Roots**: Array of directories, supports both `{"path": "...", "name": "..."}` and shorthand string format
- **Handlers**: Platform-specific external player integrations (VLC, IINA) keyed by platform (`ios`, `android`, `mac`, `windows`)
- **TLS**: Optional HTTPS with `certFile` and `keyFile`
- **AutoOpen**: Auto-launch browser on startup (GUI only)
- **DisableGUI**: Force CLI mode even on GUI platforms

### Name/Path Resolution

The server maintains bidirectional mappings (`nameToPath`, `pathToName`) for roots. API paths use root names as first segment, resolved to actual filesystem paths.

## Code Conventions

### Error Handling

- Use `respondError(w, message, statusCode)` for HTTP errors
- Use `respondJSON(w, data)` for successful JSON responses
- Log errors with `log.Printf()` for server-side debugging

### File Type Detection

- Functions: `isArchiveFile()`, `isImageFile()`, `isVideoFile()`, `isAudioFile()` in `utils.go`
- Returns file type strings: `"directory"`, `"book"`, `"video"`, `"audio"`, `"file"`

### Sorting

- Natural case-insensitive sorting for directory listings
- Directories always appear before files

### Japanese Filename Support

- Archives may contain Shift_JIS encoded filenames
- `toUTF8()` function in `archive.go` handles encoding detection and conversion
- Fallback to original if UTF-8 validation fails

## Cross-Platform Considerations

### Platform-Specific Code

- Use build tags: `//go:build (darwin || windows) && !cui` for GUI code
- Check `runtime.GOOS` for platform-specific behavior (e.g., tray icons)
- systray library requires CGO on Windows (use MinGW)

### Static Builds

- Linux builds: `CGO_ENABLED=0` for static binaries
- Windows/macOS GUI builds: CGO required for systray support

### Version Injection

Version set via ldflags: `-X main.version=$(VERSION)` in all build commands.

## API Endpoints (HTTP Handlers)

- `GET /api/roots` - List configured root directories
- `GET /api/dir/{path:.*}` - List directory contents
- `GET /api/list/{path:.*}` - List images in archive
- `GET /api/thumbnail/{path:.*}` - Get thumbnail image (cached)
- `GET /api/image/{path:.*}?p={page}` - Extract image from archive by page number
- `GET /api/media/{path:.*}` - Stream video/audio with range request support
- `GET /api/config` - Get current config
- `POST /api/config` - Update config (saves to disk)

## Docker Deployment

- Multi-stage build: `golang:1.23-alpine` → `alpine:latest`
- Config via volume mount or `CACHE_DIR` env var
- Default port 8539, runs as CLI mode (no GUI)

## Common Pitfalls

- **Forgot to minify**: Release builds need `make minify` run first, otherwise embedded assets are stale
- **Build tag confusion**: Don't edit both `main.go` and `main_gui.go` without checking build tags
- **Cache location**: Docker uses `CACHE_DIR` env var, local builds use OS user cache dir
- **Cross-compilation**: macOS can't build Windows GUI (systray/autostart CGO dependencies), use platform-native builds or GitHub Actions
- **Filename encoding**: Always use `toUTF8()` when displaying archive filenames to handle Japanese Shift_JIS

## Development Tips

- External `src/public/` directory overrides embedded assets during development
- Config changes via API are persisted to disk immediately
- Thumbnail cache survives restarts (disk-backed in OS cache directory)
- Image list cache is memory-only, rebuilt on server restart
