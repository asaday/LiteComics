//go:build linux

package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gorilla/mux"
)

func main() {
	cfg := loadConfig()

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
	}

	// Load existing cache metadata
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
		fmt.Println("\nLiteComics Server Started!\n")
		fmt.Println("Access URLs:")
		fmt.Printf("  http://localhost:%d\n", cfg.Port)
		fmt.Printf("  http://127.0.0.1:%d\n", cfg.Port)

		for _, ip := range getLocalIPs() {
			fmt.Printf("  http://%s:%d\n", ip, cfg.Port)
		}

		fmt.Println("\nRoot Directories:")
		for _, root := range cfg.Roots {
			fmt.Printf("  %s > %s\n", root.Name, root.Path)
		}
		fmt.Println()

		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	fmt.Println("\nShutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	fmt.Println("Server stopped gracefully")
}
