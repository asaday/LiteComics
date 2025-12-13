package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// decodePathRequest decodes a JSON request with a path field and resolves it
func (s *Server) decodePathRequest(w http.ResponseWriter, r *http.Request) (*ResolvedPath, bool) {
	var req struct {
		Path string `json:"path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return nil, false
	}

	if req.Path == "" {
		respondError(w, "Path is required", http.StatusBadRequest)
		return nil, false
	}

	resolved, err := s.resolveRequestPath(req.Path)
	if err != nil {
		respondError(w, err.Error(), http.StatusBadRequest)
		return nil, false
	}

	return resolved, true
}

// checkPathExists checks if the resolved path exists and returns its FileInfo
func checkPathExists(w http.ResponseWriter, fullPath string) (os.FileInfo, bool) {
	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			respondError(w, "File or directory not found", http.StatusNotFound)
			return nil, false
		}
		respondError(w, err.Error(), http.StatusInternalServerError)
		return nil, false
	}
	return info, true
}

// handleRename handles POST requests for /api/rename
// Renames files or directories
func (s *Server) handleRename(w http.ResponseWriter, r *http.Request) {
	if s.config.AllowRename == nil || !*s.config.AllowRename {
		respondError(w, "File renaming is disabled", http.StatusForbidden)
		return
	}

	var req struct {
		Path    string `json:"path"`
		NewName string `json:"newName"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Path == "" || req.NewName == "" {
		respondError(w, "Path and new name are required", http.StatusBadRequest)
		return
	}

	// Check for invalid filename characters (cross-platform)
	// Windows: < > : " / \ | ? *
	// Unix/Linux: /
	// Also check for control characters and null
	if strings.ContainsAny(req.NewName, "<>:\"/\\|?*") {
		respondError(w, "New name contains invalid characters", http.StatusBadRequest)
		return
	}

	// Check for control characters (0x00-0x1F) and DEL (0x7F)
	for _, r := range req.NewName {
		if r < 0x20 || r == 0x7F {
			respondError(w, "New name contains invalid characters", http.StatusBadRequest)
			return
		}
	}

	// Check for leading/trailing spaces or dots (problematic on Windows)
	trimmed := strings.TrimSpace(req.NewName)
	if trimmed != req.NewName || strings.HasPrefix(req.NewName, ".") || strings.HasSuffix(req.NewName, ".") {
		respondError(w, "New name cannot start or end with spaces or dots", http.StatusBadRequest)
		return
	}

	// Check for Windows reserved names
	upperName := strings.ToUpper(strings.TrimSuffix(req.NewName, filepath.Ext(req.NewName)))
	reserved := []string{"CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"}
	for _, r := range reserved {
		if upperName == r {
			respondError(w, "New name is a reserved filename", http.StatusBadRequest)
			return
		}
	}

	resolved, err := s.resolveRequestPath(req.Path)
	if err != nil {
		respondError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if _, ok := checkPathExists(w, resolved.FullPath); !ok {
		return
	}

	// Create new path
	parentDir := filepath.Dir(resolved.FullPath)
	newPath := filepath.Join(parentDir, req.NewName)

	// Check if new path already exists
	if _, err := os.Stat(newPath); err == nil {
		respondError(w, "A file or directory with that name already exists", http.StatusConflict)
		return
	}

	// Rename
	if err := os.Rename(resolved.FullPath, newPath); err != nil {
		respondError(w, fmt.Sprintf("Failed to rename: %v", err), http.StatusInternalServerError)
		return
	}

	// Calculate new relative path
	var newRelativePath string
	if resolved.RelativePath != "" {
		// Replace the last component with new name
		pathParts := strings.Split(resolved.RelativePath, "/")
		if len(pathParts) > 0 {
			pathParts[len(pathParts)-1] = req.NewName
			newRelativePath = strings.Join(pathParts, "/")
		}
	} else {
		newRelativePath = req.NewName
	}

	respondJSON(w, struct {
		Success         bool   `json:"success"`
		NewName         string `json:"newName"`
		NewPath         string `json:"newPath"`
		NewRelativePath string `json:"newRelativePath"`
	}{
		Success:         true,
		NewName:         req.NewName,
		NewPath:         filepath.Join(resolved.RootName, newRelativePath),
		NewRelativePath: newRelativePath,
	})
}

// handleRemove handles POST requests for /api/remove
// Deletes files or directories based on the AllowRemove config setting
func (s *Server) handleRemove(w http.ResponseWriter, r *http.Request) {
	if s.config.AllowRemove == nil || !*s.config.AllowRemove {
		respondError(w, "File deletion is disabled", http.StatusForbidden)
		return
	}

	resolved, ok := s.decodePathRequest(w, r)
	if !ok {
		return
	}

	info, ok := checkPathExists(w, resolved.FullPath)
	if !ok {
		return
	}

	// Remove file or directory
	var err error
	if info.IsDir() {
		err = os.RemoveAll(resolved.FullPath)
	} else {
		err = os.Remove(resolved.FullPath)
	}

	if err != nil {
		respondError(w, fmt.Sprintf("Failed to delete: %v", err), http.StatusInternalServerError)
		return
	}

	respondJSON(w, struct {
		Success      bool   `json:"success"`
		RootName     string `json:"rootName"`
		RelativePath string `json:"relativePath"`
	}{
		Success:      true,
		RootName:     resolved.RootName,
		RelativePath: resolved.RelativePath,
	})
}

// handleArchive handles POST requests for /api/archive
// Creates a ZIP archive of the specified directory
func (s *Server) handleArchive(w http.ResponseWriter, r *http.Request) {
	if s.config.AllowArchive == nil || !*s.config.AllowArchive {
		respondError(w, "Folder archiving is disabled", http.StatusForbidden)
		return
	}

	resolved, ok := s.decodePathRequest(w, r)
	if !ok {
		return
	}

	info, ok := checkPathExists(w, resolved.FullPath)
	if !ok {
		return
	}

	if !info.IsDir() {
		respondError(w, "Path is not a directory", http.StatusBadRequest)
		return
	}

	// Create ZIP file in the parent directory
	parentDir := filepath.Dir(resolved.FullPath)
	baseName := filepath.Base(resolved.FullPath)
	zipFileName := baseName + ".zip"
	zipPath := filepath.Join(parentDir, zipFileName)

	// Check if ZIP already exists
	if _, err := os.Stat(zipPath); err == nil {
		// Add timestamp to make it unique
		zipFileName = fmt.Sprintf("%s_%d.zip", baseName, time.Now().Unix())
		zipPath = filepath.Join(parentDir, zipFileName)
	}

	// Create the archive
	if err := createZipArchive(resolved.FullPath, zipPath); err != nil {
		respondError(w, fmt.Sprintf("Failed to create archive: %v", err), http.StatusInternalServerError)
		return
	}

	respondJSON(w, struct {
		Success     bool   `json:"success"`
		ArchiveName string `json:"archiveName"`
		ArchivePath string `json:"archivePath"`
	}{
		Success:     true,
		ArchiveName: zipFileName,
		ArchivePath: zipPath,
	})
}
