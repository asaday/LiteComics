package main

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
)

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// ResolvedPath represents a resolved request path
type ResolvedPath struct {
	RootName     string
	RelativePath string
	RootPath     string
	FullPath     string
}

var (
	archiveExtensions = []string{".cbz", ".zip", ".cbr", ".rar", ".cb7", ".7z", ".epub"}
	videoExtensions   = []string{".mp4", ".mkv", ".webm", ".avi", ".mov", ".m2ts", ".ts", ".wmv", ".flv", ".mpg", ".mpeg"}
	audioExtensions   = []string{".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac", ".wma", ".opus"}
	imageExtensions   = []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif"}
)

func isArchiveFile(filename string) bool { return hasExt(filename, archiveExtensions) }
func isVideoFile(filename string) bool   { return hasExt(filename, videoExtensions) }
func isAudioFile(filename string) bool   { return hasExt(filename, audioExtensions) }
func isImageFile(filename string) bool   { return hasExt(filename, imageExtensions) }

func hasExt(filename string, exts []string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	for i := range exts {
		if ext == exts[i] {
			return true
		}
	}
	return false
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(ErrorResponse{Error: message})
}

func getMimeType(ext string) string {
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		return "application/octet-stream"
	}
	return mimeType
}

func generateCacheKey(path string) string {
	hash := md5.Sum([]byte(path))
	return hex.EncodeToString(hash[:])
}

func (s *Server) resolveRequestPath(requestPath string) (*ResolvedPath, error) {
	parts := strings.FieldsFunc(filepath.Clean(requestPath), func(r rune) bool {
		return r == filepath.Separator
	})

	if len(parts) == 0 {
		return nil, fmt.Errorf("invalid path")
	}

	rootPath, ok := s.nameToPath[parts[0]]
	if !ok {
		return nil, fmt.Errorf("invalid root name")
	}

	relativePath := ""
	if len(parts) > 1 {
		relativePath = filepath.Join(parts[1:]...)
	}

	fullPath := filepath.Join(rootPath, relativePath)
	if !isPathSafe(rootPath, fullPath) {
		return nil, fmt.Errorf("invalid path: path traversal detected")
	}

	return &ResolvedPath{
		RootName: parts[0], RelativePath: relativePath,
		RootPath: rootPath, FullPath: fullPath,
	}, nil
}

func isPathSafe(root, path string) bool {
	absRoot, _ := filepath.Abs(root)
	absPath, _ := filepath.Abs(path)
	rel, err := filepath.Rel(absRoot, absPath)
	return err == nil && !strings.HasPrefix(rel, "..") && rel != ".."
}
