//go:build (darwin || windows) && !cui

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/ProtonMail/go-autostart"
	"github.com/getlantern/systray"
	"github.com/gorilla/mux"
)

const settingsPort = 28539

var (
	currentServer  *http.Server
	settingsServer *http.Server
	currentConfig  *Config
	serverMutex    sync.Mutex
	app            *autostart.App
)

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
	systray.SetTooltip("LiteComics Server")

	// Set icon from embedded ICO file
	if len(iconBytes) > 0 {
		systray.SetIcon(iconBytes)
		log.Printf("Icon set successfully (%d bytes, ICO format)", len(iconBytes))
	} else {
		log.Printf("Warning: Icon data is empty")
	}

	// Start settings server (always on port 28539)
	settingsServer = startSettingsServer()

	// Start main server
	cfg := loadConfig()
	currentConfig = cfg
	currentServer = startServer(cfg)

	// Menu items
	mOpen := systray.AddMenuItem("Open in Browser", "Open LiteComics in your browser")
	mSettings := systray.AddMenuItem("Settings...", "Open settings page")
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
	log.Printf("Settings server: http://localhost:%d\n", settingsPort)

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
				serverMutex.Lock()
				port := currentConfig.Port
				serverMutex.Unlock()
				openBrowser(fmt.Sprintf("http://localhost:%d", port))
			case <-mSettings.ClickedCh:
				openBrowser(fmt.Sprintf("http://localhost:%d/settings.html", settingsPort))
			case <-mAutoOpen.ClickedCh:
				serverMutex.Lock()
				if mAutoOpen.Checked() {
					mAutoOpen.Uncheck()
					falseVal := false
					currentConfig.AutoOpen = &falseVal
				} else {
					mAutoOpen.Check()
					trueVal := true
					currentConfig.AutoOpen = &trueVal
				}
				saveConfig(currentConfig)
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
				shutdownServer(settingsServer)
				serverMutex.Unlock()
				systray.Quit()
			}
		}
	}()
}

func onExit() {
	fmt.Println("Server stopped")
}

func startServer(cfg *Config) *http.Server {
	srv := initServer(cfg, restartServer)

	srv.setupRoutes()

	httpServer := createHTTPServer(srv)

	go func() {
		log.Printf("LiteComics Server started on port %d\n", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("Server error: %v", err)
		}
	}()

	return httpServer
}

func startSettingsServer() *http.Server {
	router := mux.NewRouter()

	// Serve settings.html
	router.HandleFunc("/settings.html", func(w http.ResponseWriter, r *http.Request) {
		// Try external file first
		if _, err := os.Stat("public/settings.html"); err == nil {
			http.ServeFile(w, r, "public/settings.html")
			return
		}
		// Use embedded file
		data, err := embeddedPublic.ReadFile("public/settings.html")
		if err != nil {
			http.Error(w, "Settings page not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(data)
	})

	// Config API
	router.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			// Read config file directly to avoid sending default values
			configPath := getConfigPath()
			configData, err := os.ReadFile(configPath)
			if err != nil {
				// If config doesn't exist, return default empty config
				if os.IsNotExist(err) {
					w.Header().Set("Content-Type", "application/json")
					w.Write([]byte(`{"port":8539,"roots":[]}`))
					return
				}
				http.Error(w, "Failed to read config", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.Write(configData)
		case http.MethodPost:
			var newConfig Config
			if err := json.NewDecoder(r.Body).Decode(&newConfig); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			serverMutex.Lock()
			currentConfig = &newConfig
			if err := saveConfig(&newConfig); err != nil {
				serverMutex.Unlock()
				http.Error(w, "Failed to save config", http.StatusInternalServerError)
				return
			}
			serverMutex.Unlock()

			w.WriteHeader(http.StatusOK)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}).Methods("GET", "POST", "OPTIONS")

	// Restart API
	router.HandleFunc("/api/restart", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.WriteHeader(http.StatusOK)
		restartServer()
	}).Methods("POST", "OPTIONS")

	addr := fmt.Sprintf(":%d", settingsPort)
	httpServer := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("Failed to start settings server: %v", err)
	}

	go func() {
		if err := httpServer.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Printf("Settings server error: %v", err)
		}
	}()

	return httpServer
}

func shutdownServer(srv *http.Server) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func restartServer() {
	go func() {
		serverMutex.Lock()
		defer serverMutex.Unlock()

		log.Println("Restarting server...")

		// Shutdown current server
		if currentServer != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			currentServer.Shutdown(ctx)
			cancel()
		}

		// Reload config and start new server
		cfg := loadConfigFromFile(getConfigPath(), false)
		currentConfig = cfg
		currentServer = startServer(cfg)

		log.Printf("Server restarted on port %d\n", cfg.Port)
	}()
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
