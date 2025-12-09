.PHONY: build run clean dist dist-windows install uninstall install-service uninstall-service

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
DIST_DIR = dist
BUILD_DIR = build
PREFIX ?= /usr/local
BINDIR ?= $(PREFIX)/bin
SERVICE_FILE = /etc/systemd/system/litecomics.service
CONFIG_DIR = /etc/litecomics

# Note: Cross-platform builds from macOS may fail due to platform-specific dependencies
# (systray, autostart). Use GitHub Actions or build on each platform for production releases.

build:
	cd src && go build -ldflags "-X main.version=$(VERSION)" -o litecomics

build-cui:
	cd src && go build -tags cui -ldflags "-X main.version=$(VERSION)" -o litecomics

build-linux:
	mkdir -p $(BUILD_DIR)
	cd src && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "-s -w -X main.version=$(VERSION)" -o ../$(BUILD_DIR)/litecomics-linux-amd64

build-linux-arm64:
	mkdir -p $(BUILD_DIR)
	cd src && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags "-s -w -X main.version=$(VERSION)" -o ../$(BUILD_DIR)/litecomics-linux-arm64

build-windows:
	@if not exist $(BUILD_DIR) mkdir $(BUILD_DIR)
	cd src && set CGO_ENABLED=1 && go build -ldflags "-s -w -H=windowsgui -X main.version=$(VERSION)" -o ../$(BUILD_DIR)/litecomics-windows-amd64.exe

build-windows-nocgo:
	@if not exist $(BUILD_DIR) mkdir $(BUILD_DIR)
	cd src && set CGO_ENABLED=0 && go build -ldflags "-s -w -H=windowsgui -X main.version=$(VERSION)" -o ../$(BUILD_DIR)/litecomics-windows-amd64.exe

build-mac-arm64:
	mkdir -p $(BUILD_DIR)
	cd src && GOARCH=arm64 go build -ldflags "-s -w -X main.version=$(VERSION)" -o ../$(BUILD_DIR)/litecomics-darwin-arm64

build-all-local: build-linux build-linux-arm64 build-mac-arm64

build-all: build-linux build-linux-arm64 build-mac-arm64

# 配布用パッケージ作成（macOS上で実行、Windows版は除外）
dist: clean build-all
	@echo "Creating distribution packages (version: $(VERSION))..."
	@mkdir -p $(DIST_DIR)
	
	# Linux AMD64
	@mkdir -p $(DIST_DIR)/litecomics-linux-amd64-$(VERSION)
	@cp $(BUILD_DIR)/litecomics-linux-amd64 $(DIST_DIR)/litecomics-linux-amd64-$(VERSION)/litecomics
	@cp config.json.example $(DIST_DIR)/litecomics-linux-amd64-$(VERSION)/config.json.example
	@cp install.sh $(DIST_DIR)/litecomics-linux-amd64-$(VERSION)/
	@chmod +x $(DIST_DIR)/litecomics-linux-amd64-$(VERSION)/litecomics
	@chmod +x $(DIST_DIR)/litecomics-linux-amd64-$(VERSION)/install.sh
	cd $(DIST_DIR) && tar czf litecomics-linux-amd64-$(VERSION).tar.gz litecomics-linux-amd64-$(VERSION)
	@rm -rf $(DIST_DIR)/litecomics-linux-amd64-$(VERSION)
	
	# Linux ARM64 (Raspberry Pi)
	@mkdir -p $(DIST_DIR)/litecomics-linux-arm64-$(VERSION)
	@cp $(BUILD_DIR)/litecomics-linux-arm64 $(DIST_DIR)/litecomics-linux-arm64-$(VERSION)/litecomics
	@cp config.json.example $(DIST_DIR)/litecomics-linux-arm64-$(VERSION)/config.json.example
	@cp install.sh $(DIST_DIR)/litecomics-linux-arm64-$(VERSION)/
	@chmod +x $(DIST_DIR)/litecomics-linux-arm64-$(VERSION)/litecomics
	@chmod +x $(DIST_DIR)/litecomics-linux-arm64-$(VERSION)/install.sh
	cd $(DIST_DIR) && tar czf litecomics-linux-arm64-$(VERSION).tar.gz litecomics-linux-arm64-$(VERSION)
	@rm -rf $(DIST_DIR)/litecomics-linux-arm64-$(VERSION)
	
	# macOS .app bundle
	@mkdir -p $(DIST_DIR)/LiteComics.app/Contents/MacOS
	@mkdir -p $(DIST_DIR)/LiteComics.app/Contents/Resources
	@cp $(BUILD_DIR)/litecomics-darwin-arm64 $(DIST_DIR)/LiteComics.app/Contents/MacOS/litecomics
	@chmod +x $(DIST_DIR)/LiteComics.app/Contents/MacOS/litecomics
	@cp config.json.example $(DIST_DIR)/LiteComics.app/Contents/Resources/config.json.example
	@cp src/icons/dist/icon.icns $(DIST_DIR)/LiteComics.app/Contents/Resources/icon.icns
	@echo '<?xml version="1.0" encoding="UTF-8"?>\n\
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n\
<plist version="1.0">\n\
<dict>\n\
	<key>CFBundleExecutable</key>\n\
	<string>litecomics</string>\n\
	<key>CFBundleIconFile</key>\n\
	<string>icon.icns</string>\n\
	<key>CFBundleIdentifier</key>\n\
	<string>com.github.asaday.litecomics</string>\n\
	<key>CFBundleName</key>\n\
	<string>LiteComics</string>\n\
	<key>CFBundleVersion</key>\n\
	<string>$(VERSION)</string>\n\
	<key>CFBundleShortVersionString</key>\n\
	<string>$(VERSION)</string>\n\
	<key>CFBundlePackageType</key>\n\
	<string>APPL</string>\n\
	<key>LSUIElement</key>\n\
	<true/>\n\
</dict>\n\
</plist>' > $(DIST_DIR)/LiteComics.app/Contents/Info.plist
	
	# Ad-hoc code signing (removes "unidentified developer" warning)
	@echo "Signing macOS app..."
	@codesign --force --deep --sign - $(DIST_DIR)/LiteComics.app 2>/dev/null || echo "  Warning: codesign failed (continuing anyway)"
	
	# Create zip for direct download
	@cd $(DIST_DIR) && zip -r litecomics-mac-$(VERSION).zip LiteComics.app
	
	# Create DMG for installer
	@mkdir -p $(DIST_DIR)/dmg-staging
	@cp -r $(DIST_DIR)/LiteComics.app $(DIST_DIR)/dmg-staging/
	@ln -s /Applications $(DIST_DIR)/dmg-staging/Applications
	@echo "Creating styled DMG..."
	@hdiutil create -volname "LiteComics" -srcfolder $(DIST_DIR)/dmg-staging -ov -format UDZO $(DIST_DIR)/litecomics-mac-$(VERSION).dmg
# 	@hdiutil create -volname "LiteComics" -srcfolder $(DIST_DIR)/dmg-staging -ov -format UDRW $(DIST_DIR)/tmp.dmg
# 	@hdiutil attach $(DIST_DIR)/tmp.dmg -mountpoint /Volumes/LiteComics
# 	@sleep 2
# 	@osascript -e 'tell application "Finder"' \
# 		-e 'tell disk "LiteComics"' \
# 		-e 'open' \
# 		-e 'set current view of container window to icon view' \
# 		-e 'set toolbar visible of container window to false' \
# 		-e 'set statusbar visible of container window to false' \
# 		-e 'set bounds of container window to {100, 100, 700, 450}' \
# 		-e 'set viewOptions to the icon view options of container window' \
# 		-e 'set arrangement of viewOptions to not arranged' \
# 		-e 'set icon size of viewOptions to 128' \
# 		-e 'set position of item "LiteComics.app" of container window to {150, 150}' \
# 		-e 'set position of item "Applications" of container window to {450, 150}' \
# 		-e 'update without registering applications' \
# 		-e 'delay 2' \
# 		-e 'close' \
# 		-e 'end tell' \
# 		-e 'end tell'
# 	@hdiutil detach /Volumes/LiteComics
# 	@hdiutil convert $(DIST_DIR)/tmp.dmg -format UDZO -o $(DIST_DIR)/litecomics-mac-$(VERSION).dmg
# 	@rm -f $(DIST_DIR)/tmp.dmg
	@rm -rf $(DIST_DIR)/LiteComics.app $(DIST_DIR)/dmg-staging
	
	@echo "\n✓ Distribution packages created in $(DIST_DIR)/"
	@echo "  macOS: .zip (direct use) + .dmg (installer)"
	@echo "  Linux: .tar.gz"
	@echo "  Note: Windows package requires Windows environment to build"
	@ls -lh $(DIST_DIR)/*.{tar.gz,zip,dmg} 2>/dev/null || true

# Windows配布パッケージ作成（Windows環境でのみ実行）
dist-windows: build-windows
	@echo "Creating Windows distribution package (version: $(VERSION))..."
	@if not exist $(DIST_DIR) mkdir $(DIST_DIR)
	@echo "Creating ZIP package..."
	@powershell -Command "Compress-Archive -Force -Path '$(BUILD_DIR)/litecomics-windows-amd64.exe' -DestinationPath '$(DIST_DIR)/litecomics-windows-$(VERSION).zip'"
	@echo "Building Windows installer with Inno Setup..."
	@set VERSION=$(VERSION)
	@if exist "$(LOCALAPPDATA)\Programs\Inno Setup 6\iscc.exe" ( \
		"$(LOCALAPPDATA)\Programs\Inno Setup 6\iscc.exe" installer.iss \
	) else if exist "C:\Program Files (x86)\Inno Setup 6\iscc.exe" ( \
		"C:\Program Files (x86)\Inno Setup 6\iscc.exe" installer.iss \
	) else ( \
		echo Warning: Inno Setup not found. Skipping installer creation. && \
		echo Install from: https://jrsoftware.org/isdl.php \
	)
	@echo.
	@echo Distribution packages created in $(DIST_DIR)/
	@dir /B $(DIST_DIR)\litecomics-windows-*

run:
	cd src && go run .

install: build
	@echo "Installing litecomics to $(BINDIR)..."
	@mkdir -p $(BINDIR)
	@install -m 755 src/litecomics $(BINDIR)/litecomics
	@echo "✓ Installed to $(BINDIR)/litecomics"
	@echo ""
	@echo "To uninstall, run: make uninstall"

uninstall:
	@echo "Uninstalling litecomics from $(BINDIR)..."
	@rm -f $(BINDIR)/litecomics
	@echo "✓ Uninstalled"

install-service: install
	@echo "Installing systemd service..."
	@if [ ! -f $(BINDIR)/litecomics ]; then \
		echo "Error: litecomics not found in $(BINDIR). Run 'make install' first."; \
		exit 1; \
	fi
	@echo "Creating config directory..."
	@sudo mkdir -p $(CONFIG_DIR)
	@if [ ! -f $(CONFIG_DIR)/config.json ] && [ -f config.json.example ]; then \
		sudo cp config.json.example $(CONFIG_DIR)/config.json; \
		echo "✓ Created default config at $(CONFIG_DIR)/config.json"; \
	fi
	@echo "[Unit]" > /tmp/litecomics.service
	@echo "Description=LiteComics Server" >> /tmp/litecomics.service
	@echo "After=network.target" >> /tmp/litecomics.service
	@echo "" >> /tmp/litecomics.service
	@echo "[Service]" >> /tmp/litecomics.service
	@echo "Type=simple" >> /tmp/litecomics.service
	@echo "Environment=CONFIG_PATH=$(CONFIG_DIR)/config.json" >> /tmp/litecomics.service
	@echo "ExecStart=$(BINDIR)/litecomics" >> /tmp/litecomics.service
	@echo "Restart=on-failure" >> /tmp/litecomics.service
	@echo "User=$(USER)" >> /tmp/litecomics.service
	@echo "" >> /tmp/litecomics.service
	@echo "[Install]" >> /tmp/litecomics.service
	@echo "WantedBy=multi-user.target" >> /tmp/litecomics.service
	@sudo mv /tmp/litecomics.service $(SERVICE_FILE)
	@sudo systemctl daemon-reload
	@sudo systemctl enable litecomics
	@sudo systemctl start litecomics
	@echo "✓ Service installed and started"
	@echo "✓ Config location: $(CONFIG_DIR)/config.json"
	@echo ""
	@echo "Useful commands:"
	@echo "  sudo systemctl status litecomics   # Check status"
	@echo "  sudo systemctl restart litecomics  # Restart"
	@echo "  sudo journalctl -u litecomics -f   # View logs"
	@echo "  sudo nano $(CONFIG_DIR)/config.json # Edit config"

uninstall-service:
	@echo "Uninstalling systemd service..."
	@sudo systemctl stop litecomics 2>/dev/null || true
	@sudo systemctl disable litecomics 2>/dev/null || true
	@sudo rm -f $(SERVICE_FILE)
	@sudo systemctl daemon-reload
	@echo "✓ Service uninstalled"

clean:
	cd src && rm -f litecomics litecomics-*
	rm -rf src/.cache/ $(BUILD_DIR)/ $(DIST_DIR)/

mod:
	cd src && go mod tidy
