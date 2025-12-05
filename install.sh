#!/bin/bash
set -e

# LiteComics installer script
# Usage: curl -fsSL https://raw.githubusercontent.com/asaday/LiteComics/main/install.sh | bash
# With systemd service: curl -fsSL https://raw.githubusercontent.com/asaday/LiteComics/main/install.sh | bash -s -- --service

VERSION="${VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
GITHUB_REPO="asaday/LiteComics"
INSTALL_SERVICE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --service)
            INSTALL_SERVICE=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

echo "Installing LiteComics..."

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Linux*)
        case "$ARCH" in
            x86_64)
                PLATFORM="linux-amd64"
                ;;
            aarch64|arm64)
                PLATFORM="linux-arm64"
                ;;
            *)
                echo "Unsupported architecture: $ARCH"
                echo "Supported: x86_64, aarch64 (Raspberry Pi 64-bit)"
                exit 1
                ;;
        esac
        ;;
    *)
        echo "Unsupported OS: $OS"
        echo "Please download from: https://github.com/$GITHUB_REPO/releases"
        exit 1
        ;;
esac

# Get latest version if not specified
if [ "$VERSION" = "latest" ]; then
    VERSION=$(curl -fsSL "https://api.github.com/repos/$GITHUB_REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    if [ -z "$VERSION" ]; then
        echo "Failed to get latest version"
        exit 1
    fi
fi

echo "Version: $VERSION"
echo "Platform: $PLATFORM"

# Download URL
DOWNLOAD_URL="https://github.com/$GITHUB_REPO/releases/download/$VERSION/litecomics-$PLATFORM-$VERSION.tar.gz"
TEMP_DIR=$(mktemp -d)

echo "Downloading from $DOWNLOAD_URL..."
if command -v curl > /dev/null 2>&1; then
    curl -fsSL "$DOWNLOAD_URL" -o "$TEMP_DIR/litecomics.tar.gz"
elif command -v wget > /dev/null 2>&1; then
    wget -q "$DOWNLOAD_URL" -O "$TEMP_DIR/litecomics.tar.gz"
else
    echo "Error: curl or wget is required"
    exit 1
fi

# Extract
echo "Extracting..."
tar xzf "$TEMP_DIR/litecomics.tar.gz" -C "$TEMP_DIR"

# Install
mkdir -p "$INSTALL_DIR"
EXTRACTED_DIR=$(find "$TEMP_DIR" -type d -name "litecomics-*" | head -n 1)
cp "$EXTRACTED_DIR/litecomics" "$INSTALL_DIR/litecomics"
chmod +x "$INSTALL_DIR/litecomics"

# Note: public files are embedded in the binary, no need to copy separately

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✓ LiteComics installed successfully!"
echo ""
echo "Location: $INSTALL_DIR/litecomics"
echo ""

# Install systemd service if requested
if [ "$INSTALL_SERVICE" = true ]; then
    if command -v systemctl > /dev/null 2>&1; then
        echo "Installing systemd service..."
        
        if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
            SERVICE_FILE="/etc/systemd/system/litecomics.service"
            
            sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=LiteComics Server
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=$INSTALL_DIR/litecomics
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
            
            sudo systemctl daemon-reload
            sudo systemctl enable litecomics
            sudo systemctl start litecomics
            
            echo "✓ Systemd service installed and started"
            echo ""
            echo "Service commands:"
            echo "  sudo systemctl status litecomics"
            echo "  sudo systemctl stop litecomics"
            echo "  sudo systemctl restart litecomics"
            echo "  sudo journalctl -u litecomics -f"
            echo ""
        else
            echo "Warning: sudo access required for service installation. Skipping."
            echo "To install service manually, run with sudo."
            echo ""
        fi
    else
        echo "Warning: systemctl not found. Service installation skipped."
        echo ""
    fi
fi

echo "To run manually:"
echo "  $INSTALL_DIR/litecomics"
echo ""

# Check if in PATH
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
    echo "Note: $INSTALL_DIR is not in your PATH"
    echo "Add this to your ~/.bashrc or ~/.zshrc:"
    echo "  export PATH=\"\$PATH:$INSTALL_DIR\""
    echo ""
fi

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/LiteComics"
echo "Configuration will be created at: $CONFIG_DIR/config.json"
