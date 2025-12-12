package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
)

var version = "dev" // Set via -ldflags at build time

const configFileName = "config.json"

var configPath string // Global config path set by parseArgsAndLoadConfig

// Config represents the application configuration
type Config struct {
	Port         int                                 `json:"port"`
	Roots        []RootConfig                        `json:"roots"`
	AutoOpen     *bool                               `json:"autoOpen,omitempty"`     // Auto-open browser on startup (GUI only)
	DisableGUI   *bool                               `json:"disableGUI,omitempty"`   // Disable GUI mode (tray icon)
	AllowRemove  *bool                               `json:"allowRemove,omitempty"`  // Allow file/folder deletion
	AllowArchive *bool                               `json:"allowArchive,omitempty"` // Allow folder archiving
	TLS          *TLSConfig                          `json:"tls,omitempty"`          // TLS/HTTPS configuration
	Handlers     map[string]map[string]HandlerConfig `json:"handlers,omitempty"`
}

// TLSConfig represents TLS/HTTPS configuration
type TLSConfig struct {
	CertFile string `json:"certFile"` // Path to certificate file
	KeyFile  string `json:"keyFile"`  // Path to key file
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
					Ext: []string{".mkv", ".avi", ".m2ts", ".ts", ".wmv"},
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
					Ext: []string{".avi", ".m2ts", ".ts", ".wmv"},
					URL: "iina://weblink?url={url}",
				},
			},
			"windows": {
				"VLC": {
					Ext: []string{".avi", ".m2ts", ".ts", ".wmv"},
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

func saveConfig(cfg *Config) error {
	// Check if handlers match default config
	defaultCfg := defaultConfig()
	if reflect.DeepEqual(cfg.Handlers, defaultCfg.Handlers) {
		// Remove handlers if they match default
		cfgCopy := *cfg
		cfgCopy.Handlers = nil
		cfg = &cfgCopy
	}

	configData, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath, configData, 0644)
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

		// Validate port range
		if newConfig.Port < 1024 || newConfig.Port > 32767 {
			http.Error(w, "Port must be between 1024 and 32767", http.StatusBadRequest)
			return
		}

		// Validate root directories exist
		for i, root := range newConfig.Roots {
			if _, err := os.Stat(root.Path); os.IsNotExist(err) {
				http.Error(w, fmt.Sprintf("Root directory does not exist: %s (index %d)", root.Path, i), http.StatusBadRequest)
				return
			}
		}

		// Validate TLS certificate files if provided
		if newConfig.TLS != nil {
			if newConfig.TLS.CertFile != "" {
				if _, err := os.Stat(newConfig.TLS.CertFile); os.IsNotExist(err) {
					http.Error(w, fmt.Sprintf("TLS certificate file does not exist: %s", newConfig.TLS.CertFile), http.StatusBadRequest)
					return
				}
			}
			if newConfig.TLS.KeyFile != "" {
				if _, err := os.Stat(newConfig.TLS.KeyFile); os.IsNotExist(err) {
					http.Error(w, fmt.Sprintf("TLS key file does not exist: %s", newConfig.TLS.KeyFile), http.StatusBadRequest)
					return
				}
			}
			// Both cert and key must be provided together
			if (newConfig.TLS.CertFile == "") != (newConfig.TLS.KeyFile == "") {
				http.Error(w, "Both certificate file and key file must be provided for TLS", http.StatusBadRequest)
				return
			}
		}

		// Load current config to preserve handlers
		currentConfig := loadConfig()
		newConfig.Handlers = currentConfig.Handlers

		if err := saveConfig(&newConfig); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}
