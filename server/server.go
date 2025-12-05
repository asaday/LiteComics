package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gorilla/mux"
)

// Config represents the application configuration
type Config struct {
	Port     int          `json:"port"`
	Roots    []RootConfig `json:"roots"`
	AutoOpen *bool        `json:"autoOpen,omitempty"` // Auto-open browser on startup (GUI only)
	Handlers map[string]map[string]HandlerConfig `json:"handlers,omitempty"`
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

// saveConfig saves the current config to file
func saveConfig(cfg *Config) error {
	configData, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	configPath := getConfigPath()
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
	// Determine public directory path (relative to current dir)
	publicDir := "public"
	if _, err := os.Stat(publicDir); os.IsNotExist(err) {
		publicDir = "../public"
	}

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

	// Serve static files (must be last)
	s.router.PathPrefix("/").Handler(http.FileServer(http.Dir(publicDir)))
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
					Ext: []string{".avi", ".flac", ".mkv", ".m2ts", ".ts", ".wmv"},
					URL: "iina://weblink?url={url}",
				},
			},
			"windows": {
				"VLC": {
					Ext: []string{".avi", ".flac", ".mkv", ".m2ts", ".ts", ".wmv"},
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
	if _, err := os.Stat("config.json"); err == nil {
		return "config.json"
	}
	
	// ユーザー設定ディレクトリを取得
	configDir, err := os.UserConfigDir()
	if err != nil {
		// フォールバック: カレントディレクトリ
		return "config.json"
	}
	
	// LiteComics専用ディレクトリを作成
	appConfigDir := filepath.Join(configDir, "LiteComics")
	os.MkdirAll(appConfigDir, 0755)
	
	return filepath.Join(appConfigDir, "config.json")
}

func loadConfigFromFile(configPath string) *Config {
	config := defaultConfig()
	if data, err := os.ReadFile(configPath); err == nil {
		json.Unmarshal(data, config)
		fmt.Printf("Config loaded from: %s\n", configPath)
	} else {
		fmt.Printf("Config file not found at %s. Using default settings.\n", configPath)
	}
	return config
}

func loadConfig() *Config {
	var (
		configPath string
		port       int
		roots      []string
	)

	defaultConfigPath := getConfigPath()
	flag.StringVar(&configPath, "c", defaultConfigPath, "Config file path")
	flag.StringVar(&configPath, "config", defaultConfigPath, "Config file path")
	flag.IntVar(&port, "p", 0, "Port number")
	flag.IntVar(&port, "port", 0, "Port number")
	flag.Func("r", "Root directory", func(s string) error { roots = append(roots, s); return nil })
	flag.Func("root", "Root directory", func(s string) error { roots = append(roots, s); return nil })
	flag.Parse()

	config := defaultConfig()

	if len(roots) == 0 {
		if data, err := os.ReadFile(configPath); err == nil {
			json.Unmarshal(data, config)
			fmt.Printf("Config loaded from: %s\n", configPath)
		} else {
			fmt.Println("config.json not found. Using default settings.")
		}
	}

	if port != 0 {
		config.Port = port
	}
	if len(roots) > 0 {
		config.Roots = make([]RootConfig, 0, len(roots))
		for _, root := range roots {
			config.Roots = append(config.Roots, RootConfig{Path: root, Name: filepath.Base(root)})
		}
	}
	if envPort := os.Getenv("PORT"); envPort != "" {
		fmt.Sscanf(envPort, "%d", &config.Port)
	}

	return config
}
