package main

import (
	"context"
	"embed"
	"encoding/json"
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

var (
	currentServer *http.Server
	serverMutex   sync.Mutex
)

//go:embed public
var embeddedPublic embed.FS

// Server represents the HTTP server
type Server struct {
	config         *Config
	router         *mux.Router
	nameToPath     map[string]string
	pathToName     map[string]string
	thumbnailCache *ThumbnailCache
	imageListCache *ImageListCache
}

// initServer initializes a new Server with caches
func initServer(cfg *Config) *Server {
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
	}

	// Load existing cache metadata
	srv.thumbnailCache.loadExisting() // Build name/path maps
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

// handleRestart handles POST requests for /api/restart
func (s *Server) handleRestart(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	restartServer()
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// startServer creates and starts a new HTTP server
func startServer(cfg *Config) *http.Server {
	srv := initServer(cfg)
	srv.setupRoutes()
	httpServer := createHTTPServer(srv)

	go func() {
		var err error
		if cfg.TLS != nil && cfg.TLS.CertFile != "" && cfg.TLS.KeyFile != "" {
			log.Printf("LiteComics Server started (HTTPS) on port %d\n", cfg.Port)
			err = httpServer.ListenAndServeTLS(cfg.TLS.CertFile, cfg.TLS.KeyFile)
		} else {
			log.Printf("LiteComics Server started (HTTP) on port %d\n", cfg.Port)
			err = httpServer.ListenAndServe()
		}
		if err != nil && err != http.ErrServerClosed {
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
