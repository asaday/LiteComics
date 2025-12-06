//go:build (darwin || windows) && !cui

package main

import (
	_ "embed"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"github.com/ProtonMail/go-autostart"
	"github.com/getlantern/systray"
)

//go:embed icons/icon.icns
var iconDarwin []byte

//go:embed icons/icon.ico
var iconWindows []byte

var app *autostart.App

func getIconBytes() []byte {
	switch runtime.GOOS {
	case "darwin":
		return iconDarwin
	case "windows":
		return iconWindows
	default:
		return nil
	}
}

func main() {
	// Initialize autostart
	exePath, _ := os.Executable()
	exePath, _ = filepath.EvalSymlinks(exePath)
	app = &autostart.App{
		Name:        "LiteComics",
		DisplayName: "LiteComics Server",
		Exec:        []string{exePath},
	}

	systray.Run(onReady, onExit)
}

func onReady() {
	// Start main server
	cfg := parseArgsAndLoadConfig()
	currentServer = startServer(cfg)

	systray.SetTooltip("LiteComics Server")

	// Set icon from embedded file
	iconBytes := getIconBytes()
	if len(iconBytes) > 0 {
		systray.SetIcon(iconBytes)
		log.Printf("Icon set successfully (%d bytes)", len(iconBytes))
	} else {
		log.Printf("Warning: Icon data is empty")
	}

	// Menu items
	mOpen := systray.AddMenuItem("Open in Browser", "Open LiteComics in your browser")
	mSettings := systray.AddMenuItem("Settings...", "Open settings page")
	mRestart := systray.AddMenuItem("Restart Server", "Restart the server")
	systray.AddSeparator()
	mVersion := systray.AddMenuItem(fmt.Sprintf("Version: %s", version), "Application version")
	mVersion.Disable()
	systray.AddSeparator()
	// AutoOpen defaults to true if not set
	autoOpenEnabled := cfg.AutoOpen == nil || *cfg.AutoOpen
	mAutoOpen := systray.AddMenuItemCheckbox("Auto-open Browser", "Open browser on startup", autoOpenEnabled)
	mStartup := systray.AddMenuItemCheckbox("Start at Login", "Launch on startup", app.IsEnabled())
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Quit", "Stop server and quit")

	// Show config location
	log.Printf("LiteComics version: %s", version)
	log.Printf("Config location: %s\n", getConfigPath())
	log.Printf("Main server: http://localhost:%d\n", cfg.Port)

	// Auto-open browser if enabled
	if autoOpenEnabled {
		url := fmt.Sprintf("http://localhost:%d", cfg.Port)
		openBrowser(url)
	}

	// Handle menu clicks
	go func() {
		for {
			select {
			case <-mOpen.ClickedCh:
				// Reload config to get latest port
				cfg := loadConfig()
				openBrowser(fmt.Sprintf("http://localhost:%d", cfg.Port))
			case <-mSettings.ClickedCh:
				// Reload config to get latest port
				cfg := loadConfig()
				openBrowser(fmt.Sprintf("http://localhost:%d/settings.html", cfg.Port))
			case <-mRestart.ClickedCh:
				restartServer()
			case <-mAutoOpen.ClickedCh:
				serverMutex.Lock()
				cfg := loadConfig()
				if mAutoOpen.Checked() {
					mAutoOpen.Uncheck()
					falseVal := false
					cfg.AutoOpen = &falseVal
				} else {
					mAutoOpen.Check()
					trueVal := true
					cfg.AutoOpen = &trueVal
				}
				saveConfig(cfg)
				serverMutex.Unlock()
			case <-mStartup.ClickedCh:
				if mStartup.Checked() {
					mStartup.Uncheck()
					if err := app.Disable(); err != nil {
						log.Printf("Failed to disable autostart: %v", err)
					}
				} else {
					mStartup.Check()
					if err := app.Enable(); err != nil {
						log.Printf("Failed to enable autostart: %v", err)
					}
				}
			case <-mQuit.ClickedCh:
				serverMutex.Lock()
				shutdownServer(currentServer)
				serverMutex.Unlock()
				systray.Quit()
			}
		}
	}()
}

func onExit() {
	fmt.Println("Server stopped")
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	}
	if cmd != nil {
		cmd.Run()
	}
}
