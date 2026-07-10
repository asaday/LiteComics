package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const maxUploadSize = int64(20 << 30) // 20 GiB per request

// handleUpload stores locally dropped files and folders in a configured directory.
func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if s.config.AllowUpload == nil || !*s.config.AllowUpload {
		respondError(w, "File upload is disabled", http.StatusForbidden)
		return
	}
	deadline := time.Now().Add(24 * time.Hour)
	controller := http.NewResponseController(w)
	_ = controller.SetReadDeadline(deadline)
	_ = controller.SetWriteDeadline(deadline)

	s.transferMutex.Lock()
	defer s.transferMutex.Unlock()

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		respondError(w, fmt.Sprintf("Invalid upload: %v", err), http.StatusBadRequest)
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

	destinationPath := r.FormValue("destination")
	destination, err := s.resolveRequestPath(destinationPath)
	if err != nil {
		respondError(w, "Invalid destination path", http.StatusBadRequest)
		return
	}
	if !s.isUploadAllowed(destination.RootName) {
		respondError(w, "File upload is disabled for this root", http.StatusForbidden)
		return
	}
	destinationInfo, err := os.Stat(destination.FullPath)
	if err != nil || !destinationInfo.IsDir() {
		respondError(w, "Destination is not a directory", http.StatusBadRequest)
		return
	}
	realRoot, rootErr := filepath.EvalSymlinks(destination.RootPath)
	realDestination, destinationErr := filepath.EvalSymlinks(destination.FullPath)
	if rootErr != nil || destinationErr != nil || !isPathSafe(realRoot, realDestination) {
		respondError(w, "Destination resolves outside its configured root", http.StatusBadRequest)
		return
	}

	fileHeaders := r.MultipartForm.File["files"]
	rawPaths := r.MultipartForm.Value["paths"]
	if len(fileHeaders) != len(rawPaths) {
		respondError(w, "Each uploaded file must have a relative path", http.StatusBadRequest)
		return
	}
	var rawDirectories []string
	if value := r.FormValue("directories"); value != "" {
		if err := json.Unmarshal([]byte(value), &rawDirectories); err != nil {
			respondError(w, "Invalid directory list", http.StatusBadRequest)
			return
		}
	}
	if len(fileHeaders) == 0 && len(rawDirectories) == 0 {
		respondError(w, "No files or folders were provided", http.StatusBadRequest)
		return
	}

	cleanPaths := make([]string, len(rawPaths))
	topLevels := make(map[string]struct{})
	seenFiles := make(map[string]struct{})
	for i, rawPath := range rawPaths {
		clean, err := cleanUploadPath(rawPath)
		if err != nil {
			respondError(w, err.Error(), http.StatusBadRequest)
			return
		}
		if _, exists := seenFiles[clean]; exists {
			respondError(w, "The upload contains duplicate file paths", http.StatusBadRequest)
			return
		}
		seenFiles[clean] = struct{}{}
		cleanPaths[i] = clean
		topLevels[strings.Split(clean, "/")[0]] = struct{}{}
	}
	cleanDirectories := make([]string, 0, len(rawDirectories))
	for _, rawDirectory := range rawDirectories {
		clean, err := cleanUploadPath(rawDirectory)
		if err != nil {
			respondError(w, err.Error(), http.StatusBadRequest)
			return
		}
		cleanDirectories = append(cleanDirectories, clean)
		topLevels[strings.Split(clean, "/")[0]] = struct{}{}
	}

	for topLevel := range topLevels {
		if _, err := os.Lstat(filepath.Join(destination.FullPath, filepath.FromSlash(topLevel))); err == nil {
			respondError(w, fmt.Sprintf("An item named %q already exists in the destination", topLevel), http.StatusConflict)
			return
		} else if !os.IsNotExist(err) {
			respondError(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	staging, err := os.MkdirTemp(destination.FullPath, ".litecomics-upload-")
	if err != nil {
		respondError(w, fmt.Sprintf("Failed to prepare upload: %v", err), http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(staging)

	sort.Slice(cleanDirectories, func(i, j int) bool {
		return strings.Count(cleanDirectories[i], "/") < strings.Count(cleanDirectories[j], "/")
	})
	for _, directory := range cleanDirectories {
		if err := os.MkdirAll(filepath.Join(staging, filepath.FromSlash(directory)), 0755); err != nil {
			respondError(w, fmt.Sprintf("Failed to create uploaded folder: %v", err), http.StatusInternalServerError)
			return
		}
	}

	for i, header := range fileHeaders {
		targetPath := filepath.Join(staging, filepath.FromSlash(cleanPaths[i]))
		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			respondError(w, fmt.Sprintf("Failed to create upload directory: %v", err), http.StatusInternalServerError)
			return
		}
		input, err := header.Open()
		if err != nil {
			respondError(w, fmt.Sprintf("Failed to read upload: %v", err), http.StatusInternalServerError)
			return
		}
		output, err := os.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
		if err != nil {
			input.Close()
			respondError(w, fmt.Sprintf("Failed to create uploaded file: %v", err), http.StatusInternalServerError)
			return
		}
		_, copyErr := io.Copy(output, input)
		closeErr := output.Close()
		input.Close()
		if copyErr != nil || closeErr != nil {
			if copyErr == nil {
				copyErr = closeErr
			}
			respondError(w, fmt.Sprintf("Failed to save uploaded file: %v", copyErr), http.StatusInternalServerError)
			return
		}
	}

	topLevelNames := make([]string, 0, len(topLevels))
	for name := range topLevels {
		topLevelNames = append(topLevelNames, name)
	}
	sort.Strings(topLevelNames)
	moved := make([]string, 0, len(topLevelNames))
	for _, name := range topLevelNames {
		from := filepath.Join(staging, filepath.FromSlash(name))
		to := filepath.Join(destination.FullPath, filepath.FromSlash(name))
		if err := os.Rename(from, to); err != nil {
			for i := len(moved) - 1; i >= 0; i-- {
				_ = os.Rename(filepath.Join(destination.FullPath, moved[i]), filepath.Join(staging, moved[i]))
			}
			respondError(w, fmt.Sprintf("Failed to finish upload: %v", err), http.StatusInternalServerError)
			return
		}
		moved = append(moved, filepath.FromSlash(name))
	}

	respondJSON(w, struct {
		Success   bool `json:"success"`
		FileCount int  `json:"fileCount"`
	}{true, len(fileHeaders)})
}

func (s *Server) isUploadAllowed(rootName string) bool {
	if s.config.AllowUpload == nil || !*s.config.AllowUpload {
		return false
	}
	// Match initServer's nameToPath behavior when duplicate root names exist:
	// the last configured entry wins.
	for i := len(s.config.Roots) - 1; i >= 0; i-- {
		if s.config.Roots[i].Name == rootName {
			return !s.config.Roots[i].UploadDisabled
		}
	}
	return false
}

func cleanUploadPath(raw string) (string, error) {
	if raw == "" || strings.ContainsRune(raw, '\x00') || strings.Contains(raw, "\\") {
		return "", fmt.Errorf("invalid upload path")
	}
	clean := path.Clean(raw)
	if clean == "." || path.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", fmt.Errorf("invalid upload path")
	}
	converted := filepath.FromSlash(clean)
	if filepath.IsAbs(converted) || filepath.VolumeName(converted) != "" {
		return "", fmt.Errorf("invalid upload path")
	}
	return clean, nil
}
