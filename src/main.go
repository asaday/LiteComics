//go:build linux || cui

package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	cfg := parseArgsAndLoadConfig()
	currentServer = startServer(cfg)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	fmt.Println("\nShutting down server...")
	serverMutex.Lock()
	shutdownServer(currentServer)
	serverMutex.Unlock()

	fmt.Println("Server stopped gracefully")
}
