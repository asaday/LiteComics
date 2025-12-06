package main

import (
	"context"
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

var version = "dev" // Set via -ldflags at build time

const configFileName = "config.json"

var (
	configPath    string // Global config path set by parseArgsAndLoadConfig
	currentServer *http.Server
	serverMutex   sync.Mutex
)

//go:embed public
var embeddedPublic embed.FS

// Config represents the application configuration
type Config struct {
	Port       int                                 `json:"port"`
	Roots      []RootConfig                        `json:"roots"`
	AutoOpen   *bool                               `json:"autoOpen,omitempty"`   // Auto-open browser on startup (GUI only)
	DisableGUI *bool                               `json:"disableGUI,omitempty"` // Disable GUI mode (tray icon)
	Handlers   map[string]map[string]HandlerConfig `json:"handlers,omitempty"`
}

// RootConfig represents a root directory configuration
type RootConfig struct {
	Path string `json:"path"`
	Name string `json:"name,omitempty"`
}

// HandlerConfig represents external player handler configuration
type HandlerConfig struct {
	Ext []string `json:"ext"`
	URL string   `json:"url"`
}

// Server represents the HTTP server
type Server struct {
	config         *Config
	router         *mux.Router
	nameToPath     map[string]string
	pathToName     map[string]string
	thumbnailCache *ThumbnailCache
	imageListCache *ImageListCache
	restartFunc    func() // Function to call for restart
}

// initServer initializes a new Server with caches
func initServer(cfg *Config, restartFunc func()) *Server {
	// Initialize caches
	// Use CACHE_DIR env var for Docker, otherwise use user cache dir
	cacheDir := os.Getenv("CACHE_DIR")
	if cacheDir == "" {
		userCache, err := os.UserCacheDir()
		if err != nil {
			cacheDir = ".cache"
		} else {
			cacheDir = filepath.Join(userCache, "LiteComics")
		}
	}
	cacheDir = filepath.Join(cacheDir, "thumbnail")
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
		restartFunc: restartFunc,
	}

	// Load existing cache metadata
	srv.thumbnailCache.loadExisting()

	// Build name/path maps
	for i := range cfg.Roots {
		srv.nameToPath[cfg.Roots[i].Name] = cfg.Roots[i].Path
		srv.pathToName[cfg.Roots[i].Path] = cfg.Roots[i].Name
	}

	return srv
}

// createHTTPServer creates an HTTP server with the Server's router
func createHTTPServer(srv *Server) *http.Server {
	return &http.Server{
		Addr:         net.JoinHostPort("", strconv.Itoa(srv.config.Port)),
		Handler:      srv.router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}
}

// saveConfig saves the current config to file
func saveConfig(cfg *Config) error {
	configData, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath, configData, 0644)
}

// UnmarshalJSON handles both string and object formats for roots
func (r *RootConfig) UnmarshalJSON(data []byte) error {
	var str string
	if json.Unmarshal(data, &str) == nil {
		r.Path, r.Name = str, filepath.Base(str)
		return nil
	}
	type Alias RootConfig
	if err := json.Unmarshal(data, &struct{ *Alias }{(*Alias)(r)}); err != nil {
		return err
	}
	if r.Name == "" {
		r.Name = filepath.Base(r.Path)
	}
	return nil
}

func (s *Server) setupRoutes() {
	// API routes (must be defined before static files)
	api := s.router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/roots", s.handleRoots).Methods("GET")
	api.HandleFunc("/dir/{path:.*}", s.handleDir).Methods("GET")
	api.HandleFunc("/book/{path:.*}/list", s.handleBookList).Methods("GET")
	api.HandleFunc("/book/{path:.*}/image/{index:[0-9]+}", s.handleBookImage).Methods("GET")
	api.HandleFunc("/book/{path:.*}/thumbnail", s.handleThumbnail).Methods("GET")
	api.HandleFunc("/media/{path:.*}", s.handleMedia).Methods("GET")
	api.HandleFunc("/media-url/{path:.*}", s.handleMediaURL).Methods("GET")
	api.HandleFunc("/file/{path:.*}", s.handleFile).Methods("GET")

	// GUI control APIs (disabled when disableGUI is true)
	if s.config.DisableGUI == nil || !*s.config.DisableGUI {
		api.HandleFunc("/settings/config", s.handleConfig).Methods("GET", "POST")
		api.HandleFunc("/settings/restart", s.handleRestart).Methods("POST")
	}

	// Block settings.html if GUI is disabled
	if s.config.DisableGUI != nil && *s.config.DisableGUI {
		s.router.HandleFunc("/settings.html", func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "Settings are disabled", http.StatusForbidden)
		})
	}

	// Serve static files (must be last)
	// Try external public directory first (for development/customization)
	var fileHandler http.Handler
	publicDir := "public"
	if _, err := os.Stat(publicDir); err == nil {
		log.Printf("Using external public directory: %s", publicDir)
		fileHandler = http.FileServer(http.Dir(publicDir))
	} else {
		log.Printf("Using embedded public files")
		publicFS, _ := fs.Sub(embeddedPublic, "public")
		fileHandler = http.FileServer(http.FS(publicFS))
	}
	s.router.PathPrefix("/").Handler(fileHandler)
}

func defaultConfig() *Config {
	// Get user's home directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}

	return &Config{
		Port:  8539,
		Roots: []RootConfig{{Path: homeDir, Name: "Home"}},
		Handlers: map[string]map[string]HandlerConfig{
			"ios": {
				"VLC": {
					Ext: []string{".mkv", ".avi", ".flac", ".m2ts", ".ts", ".wmv"},
					URL: "vlc-x-callback://x-callback-url/stream?url={url}",
				},
			},
			"android": {
				"VLC": {
					Ext: []string{".mkv", ".m2ts", ".ts"},
					URL: "vlc://x-callback-url/stream?url={url}",
				},
			},
			"mac": {
				"IINA": {
					Ext: []string{".avi", ".flac", ".m2ts", ".ts", ".wmv"},
					URL: "iina://weblink?url={url}",
				},
			},
			"windows": {
				"VLC": {
					Ext: []string{".avi", ".flac", ".m2ts", ".ts", ".wmv"},
					URL: "vlc://{url}",
				},
			},
		},
	}
}

func getConfigPath() string {
	// 環境変数で指定されていればそれを使う（Docker用）
	if envPath := os.Getenv("CONFIG_PATH"); envPath != "" {
		// ディレクトリを確認・作成
		dir := filepath.Dir(envPath)
		os.MkdirAll(dir, 0755)
		return envPath
	}

	// カレントディレクトリに config.json があればそれを使う（開発用）
	if _, err := os.Stat(configFileName); err == nil {
		return configFileName
	}

	// ユーザー設定ディレクトリを取得
	configDir, err := os.UserConfigDir()
	if err != nil {
		// フォールバック: カレントディレクトリ
		return configFileName
	}

	// LiteComics専用ディレクトリを作成
	appConfigDir := filepath.Join(configDir, "LiteComics")
	os.MkdirAll(appConfigDir, 0755)

	return filepath.Join(appConfigDir, configFileName)
}

func loadConfig() *Config {
	config := defaultConfig()
	if data, err := os.ReadFile(configPath); err == nil {
		if err := json.Unmarshal(data, config); err != nil {
			log.Printf("Warning: Failed to parse config file: %v\n", err)
			log.Printf("Using default settings.\n")
			return defaultConfig()
		}
		log.Printf("Config loaded from: %s\n", configPath)
	}
	return config
}

func parseArgsAndLoadConfig() *Config {
	var (
		configPathArg string
		showVersion   bool
	)

	defaultConfigPath := getConfigPath()
	flag.BoolVar(&showVersion, "v", false, "Show version")
	flag.BoolVar(&showVersion, "version", false, "Show version")
	flag.StringVar(&configPathArg, "c", defaultConfigPath, "Config file path")
	flag.StringVar(&configPathArg, "config", defaultConfigPath, "Config file path")
	flag.Parse()

	if showVersion {
		fmt.Printf("LiteComics version %s\n", version)
		os.Exit(0)
	}

	// Set global config path
	configPath = configPathArg

	return loadConfig()
}

// handleConfig handles GET and POST requests for /api/config
func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		// Read current config
		data, err := os.ReadFile(configPath)
		if err != nil {
			// If config doesn't exist, return default config
			if os.IsNotExist(err) {
				response := map[string]interface{}{
					"config":     defaultConfig(),
					"configPath": configPath,
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(response)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Parse config and include path
		var config Config
		if err := json.Unmarshal(data, &config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		response := map[string]interface{}{
			"config":     config,
			"configPath": configPath,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)

	case "POST":
		// Save new config
		var newConfig Config
		if err := json.NewDecoder(r.Body).Decode(&newConfig); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if err := saveConfig(&newConfig); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

// handleRestart handles POST requests for /api/restart
func (s *Server) handleRestart(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if s.restartFunc != nil {
		// GUI mode: call the restart function
		s.restartFunc()
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	} else {
		// CUI mode: restart not supported
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "restart_not_supported",
			"message": "Please restart the server manually",
		})
	}
}

// startServer creates and starts a new HTTP server
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

// shutdownServer gracefully shuts down the HTTP server
func shutdownServer(server *http.Server) {
	if server == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}
}

// restartServer restarts the HTTP server with reloaded configuration
func restartServer() {
	serverMutex.Lock()
	defer serverMutex.Unlock()

	log.Println("Restarting server...")
	shutdownServer(currentServer)

	cfg := loadConfig()
	currentServer = startServer(cfg)
	log.Printf("Server restarted on port %d\n", cfg.Port)
}
