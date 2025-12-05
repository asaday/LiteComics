package main

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
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

	imageMimeTypes = map[string]string{
		".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
		".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp", ".avif": "image/avif",
	}
	videoMimeTypes = map[string]string{
		".mp4": "video/mp4", ".mkv": "video/x-matroska", ".webm": "video/webm",
		".avi": "video/x-msvideo", ".mov": "video/quicktime", ".m2ts": "video/mp2t",
		".ts": "video/mp2t", ".wmv": "video/x-ms-wmv", ".flv": "video/x-flv",
		".mpg": "video/mpeg", ".mpeg": "video/mpeg",
	}
	audioMimeTypes = map[string]string{
		".mp3": "audio/mpeg", ".flac": "audio/flac", ".wav": "audio/wav",
		".ogg": "audio/ogg", ".m4a": "audio/mp4", ".aac": "audio/aac",
		".wma": "audio/x-ms-wma", ".opus": "audio/opus",
	}
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

func getMimeType(ext string, mimeMap map[string]string) string {
	if mime, ok := mimeMap[ext]; ok {
		return mime
	}
	return "application/octet-stream"
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

func (s *Server) serveFile(w http.ResponseWriter, path string, size int64, mimeType string) {
	file, err := os.Open(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer file.Close()

	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	w.WriteHeader(http.StatusOK)
	io.Copy(w, file)
}

func (s *Server) serveFileRange(w http.ResponseWriter, r *http.Request, path string, size int64, mimeType string) {
	rangeHeader := r.Header.Get("Range")
	if !strings.HasPrefix(rangeHeader, "bytes=") {
		s.serveFile(w, path, size, mimeType)
		return
	}

	rangeStr := strings.TrimPrefix(rangeHeader, "bytes=")
	parts := strings.Split(rangeStr, "-")
	if len(parts) != 2 {
		http.Error(w, "Invalid Range header", http.StatusBadRequest)
		return
	}

	start, _ := strconv.ParseInt(parts[0], 10, 64)
	end := size - 1
	if parts[1] != "" {
		end, _ = strconv.ParseInt(parts[1], 10, 64)
	}

	if start < 0 || start >= size || end >= size || start > end {
		http.Error(w, "Invalid Range", http.StatusRequestedRangeNotSatisfiable)
		return
	}

	file, err := os.Open(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer file.Close()

	file.Seek(start, 0)
	length := end - start + 1

	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Content-Length", strconv.FormatInt(length, 10))
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, size))
	w.Header().Set("Accept-Ranges", "bytes")
	w.WriteHeader(http.StatusPartialContent)

	io.CopyN(w, file, length)
}

func getLocalIPs() []string {
	var ips []string
	interfaces, _ := net.Interfaces()
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip != nil && ip.To4() != nil {
				ips = append(ips, ip.String())
			}
		}
	}
	return ips
}
