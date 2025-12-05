//go:build darwin || windows

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
	"strconv"
	"sync"
	"time"

	"github.com/ProtonMail/go-autostart"
	"github.com/getlantern/systray"
	"github.com/gorilla/mux"
)

const settingsPort = 28539

var (
	currentServer   *http.Server
	settingsServer  *http.Server
	currentConfig   *Config
	serverMutex     sync.Mutex
	app             *autostart.App
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
	systray.SetTitle("LiteComics")
	systray.SetTooltip("LiteComics Server")
	
	// Set icon (if iconData is populated)
	if len(iconData) > 0 {
		systray.SetIcon(iconData)
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
	// AutoOpen defaults to true if not set
	autoOpenEnabled := cfg.AutoOpen == nil || *cfg.AutoOpen
	mAutoOpen := systray.AddMenuItemCheckbox("Auto-open Browser", "Open browser on startup", autoOpenEnabled)
	mStartup := systray.AddMenuItemCheckbox("Start at Login", "Launch on startup", app.IsEnabled())
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Quit", "Stop server and quit")
	
	// Show config location
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
	// Initialize caches
	cacheDir := ".thumbnail-cache"
	os.MkdirAll(cacheDir, 0755)

	srv := &Server{
		config:     cfg,
		router:     mux.NewRouter(),
		nameToPath: make(map[string]string),
		pathToName: make(map[string]string),
		thumbnailCache: &ThumbnailCache{
			dir:      cacheDir,
			metadata: make(map[string]*CacheMetadata),
			maxSize:  4096,
		},
		imageListCache: &ImageListCache{
			cache:   make(map[string]*ImageListEntry),
			maxSize: 256,
		},
		restartFunc: restartServer,
	}

	srv.thumbnailCache.loadExisting()

	for i := range cfg.Roots {
		srv.nameToPath[cfg.Roots[i].Name] = cfg.Roots[i].Path
		srv.pathToName[cfg.Roots[i].Path] = cfg.Roots[i].Name
	}

	srv.setupRoutes()

	httpServer := &http.Server{
		Addr:         net.JoinHostPort("", strconv.Itoa(cfg.Port)),
		Handler:      srv.router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

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
		http.ServeFile(w, r, "../public/settings.html")
	})
	
	// Config API
	router.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		serverMutex.Lock()
		cfg := currentConfig
		serverMutex.Unlock()
		
		switch r.Method {
		case http.MethodGet:
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(cfg)
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
		cfg := loadConfigFromFile(getConfigPath())
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
