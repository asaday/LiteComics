package main

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"net/http"

	"github.com/gorilla/mux"
	"github.com/maruel/natural"
)

func (s *Server) handleDir(w http.ResponseWriter, r *http.Request) {
	type fileItem struct {
		Name     string    `json:"name"`
		Path     string    `json:"path"`
		Type     string    `json:"type"`
		Size     int64     `json:"size"`
		Modified time.Time `json:"modified"`
	}

	requestPath := mux.Vars(r)["path"]

	// If path is empty, return roots list
	if requestPath == "" {
		items := make([]fileItem, 0, len(s.config.Roots))
		for i := range s.config.Roots {
			if info, err := os.Stat(s.config.Roots[i].Path); err == nil {
				items = append(items, fileItem{
					Name: s.config.Roots[i].Name, Path: s.config.Roots[i].Name, Type: "directory",
					Size: info.Size(), Modified: info.ModTime(),
				})
			}
		}
		respondJSON(w, struct {
			Files        []fileItem `json:"files"`
			AllowRename  bool       `json:"allowRename"`
			AllowRemove  bool       `json:"allowRemove"`
			AllowArchive bool       `json:"allowArchive"`
			DisableGUI   bool       `json:"disableGUI"`
		}{
			Files:        items,
			AllowRename:  s.config.AllowRename != nil && *s.config.AllowRename,
			AllowRemove:  s.config.AllowRemove != nil && *s.config.AllowRemove,
			AllowArchive: s.config.AllowArchive != nil && *s.config.AllowArchive,
			DisableGUI:   s.config.DisableGUI != nil && *s.config.DisableGUI,
		})
		return
	}

	resolved, err := s.resolveRequestPath(requestPath)
	if err != nil {
		respondError(w, err.Error(), http.StatusNotFound)
		return
	}

	info, err := os.Stat(resolved.FullPath)
	if err != nil || !info.IsDir() {
		respondError(w, "dir is none", http.StatusBadRequest)
		return
	}

	entries, err := os.ReadDir(resolved.FullPath)
	if err != nil {
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	files := make([]fileItem, 0, len(entries))
	for _, entry := range entries {
		info, _ := entry.Info()
		itemRelativePath := entry.Name()
		if resolved.RelativePath != "" {
			itemRelativePath = filepath.Join(resolved.RelativePath, entry.Name())
		}
		itemPath := filepath.Join(resolved.RootName, itemRelativePath)

		fileType := "file"
		if entry.IsDir() {
			fileType = "directory"
		} else if isArchiveFile(entry.Name()) {
			fileType = "book"
		} else if isVideoFile(entry.Name()) {
			fileType = "video"
		} else if isAudioFile(entry.Name()) {
			fileType = "audio"
		}

		files = append(files, fileItem{
			Name: entry.Name(), Path: itemPath, Type: fileType,
			Size: info.Size(), Modified: info.ModTime(),
		})
	}

	sort.Slice(files, func(i, j int) bool {
		if files[i].Type == "directory" && files[j].Type != "directory" {
			return true
		}
		if files[i].Type != "directory" && files[j].Type == "directory" {
			return false
		}
		return natural.Less(files[i].Name, files[j].Name)
	})

	respondJSON(w, struct {
		RootName     string     `json:"rootName"`
		RelativePath string     `json:"relativePath"`
		Files        []fileItem `json:"files"`
		AllowRename  bool       `json:"allowRename"`
		AllowRemove  bool       `json:"allowRemove"`
		AllowArchive bool       `json:"allowArchive"`
		DisableGUI   bool       `json:"disableGUI"`
	}{
		RootName:     resolved.RootName,
		RelativePath: resolved.RelativePath,
		Files:        files,
		AllowRename:  s.config.AllowRename != nil && *s.config.AllowRename,
		AllowRemove:  s.config.AllowRemove != nil && *s.config.AllowRemove,
		AllowArchive: s.config.AllowArchive != nil && *s.config.AllowArchive,
		DisableGUI:   s.config.DisableGUI != nil && *s.config.DisableGUI,
	})
}

func (s *Server) handleBookList(w http.ResponseWriter, r *http.Request) {
	requestPath, _ := url.PathUnescape(mux.Vars(r)["path"])
	resolved, err := s.resolveRequestPath(requestPath)
	if err != nil {
		respondError(w, err.Error(), http.StatusNotFound)
		return
	}

	if _, err := os.Stat(resolved.FullPath); err != nil {
		respondError(w, "file not found", http.StatusNotFound)
		return
	}

	images, err := s.getImagesFromBook(resolved.FullPath)
	if err != nil {
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Convert to UTF-8 display names for safe JSON transmission
	displayNames := getDisplayNames(images)

	respondJSON(w, struct {
		Filename   string   `json:"filename"`
		Images     []string `json:"images"`
		Count      int      `json:"count"`
		DefaultLTR bool     `json:"defaultLTR"`
	}{
		Filename:   filepath.Base(resolved.FullPath),
		Images:     displayNames,
		Count:      len(displayNames),
		DefaultLTR: s.config.DefaultLTR != nil && *s.config.DefaultLTR,
	})
}

func (s *Server) handleBookImage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestPath, _ := url.PathUnescape(vars["path"])
	index, _ := strconv.Atoi(vars["index"])

	resolved, err := s.resolveRequestPath(requestPath)
	if err != nil {
		respondError(w, err.Error(), http.StatusNotFound)
		return
	}

	images, err := s.getImagesFromBook(resolved.FullPath)
	if err != nil {
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if index < 0 || index >= len(images) {
		respondError(w, "index out of range", http.StatusNotFound)
		return
	}

	imageName := images[index]
	data, err := s.extractFileFromBook(resolved.FullPath, imageName)
	if err != nil {
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	ext := strings.ToLower(filepath.Ext(imageName))
	w.Header().Set("Content-Type", getMimeType(ext))
	w.Write(data)
}

func (s *Server) handleThumbnail(w http.ResponseWriter, r *http.Request) {
	requestPath, _ := url.PathUnescape(mux.Vars(r)["path"])
	resolved, err := s.resolveRequestPath(requestPath)
	if err != nil {
		respondError(w, err.Error(), http.StatusNotFound)
		return
	}

	cacheKey := generateCacheKey(resolved.FullPath)

	// Get first image name for MIME type detection
	images, err := s.getImagesFromBook(resolved.FullPath)
	if err != nil || len(images) == 0 {
		respondError(w, "images not found", http.StatusNotFound)
		return
	}
	firstImage := images[0]

	// Check cache
	data, cacheHit := s.thumbnailCache.Get(cacheKey)
	if !cacheHit {
		// Generate thumbnail
		data, err = s.extractFileFromBook(resolved.FullPath, firstImage)
		if err != nil {
			respondError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// Save to cache
		s.thumbnailCache.Set(cacheKey, data)
	}

	// Send response
	ext := strings.ToLower(filepath.Ext(firstImage))
	w.Header().Set("Content-Type", getMimeType(ext))
	w.Header().Set("Cache-Control", "public, max-age=86400")
	if cacheHit {
		w.Header().Set("X-Cache", "HIT")
	} else {
		w.Header().Set("X-Cache", "MISS")
	}
	w.Write(data)
}

func (s *Server) handleFile(w http.ResponseWriter, r *http.Request) {
	requestPath, _ := url.PathUnescape(mux.Vars(r)["path"])
	resolved, err := s.resolveRequestPath(requestPath)
	if err != nil {
		respondError(w, err.Error(), http.StatusNotFound)
		return
	}

	file, err := os.Open(resolved.FullPath)
	if err != nil {
		respondError(w, "file not found", http.StatusNotFound)
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil || !stat.Mode().IsRegular() {
		respondError(w, "file not found", http.StatusNotFound)
		return
	}

	// ServeContent handles Range requests, ETag, Last-Modified, and Content-Type automatically
	http.ServeContent(w, r, filepath.Base(resolved.FullPath), stat.ModTime(), file)
}

func (s *Server) handleMediaURL(w http.ResponseWriter, r *http.Request) {
	requestPath, _ := url.PathUnescape(mux.Vars(r)["path"])
	resolved, err := s.resolveRequestPath(requestPath)
	if err != nil {
		respondError(w, err.Error(), http.StatusNotFound)
		return
	}

	stat, err := os.Stat(resolved.FullPath)
	if err != nil || !stat.Mode().IsRegular() {
		respondError(w, "file not found", http.StatusNotFound)
		return
	}

	userAgent := r.Header.Get("User-Agent")
	ext := strings.ToLower(filepath.Ext(resolved.FullPath))

	// Detect device
	var handlers map[string]HandlerConfig
	if strings.Contains(userAgent, "iPhone") || strings.Contains(userAgent, "iPad") || strings.Contains(userAgent, "iPod") {
		handlers = s.config.Handlers["ios"]
	} else if strings.Contains(userAgent, "Android") {
		handlers = s.config.Handlers["android"]
	} else if strings.Contains(userAgent, "Macintosh") || strings.Contains(userAgent, "Mac OS X") {
		if !strings.Contains(userAgent, "iPhone") && !strings.Contains(userAgent, "iPad") {
			handlers = s.config.Handlers["mac"]
		}
	} else if strings.Contains(userAgent, "Windows") {
		handlers = s.config.Handlers["windows"]
	}

	// Check for custom handler
	var customURL, handlerName string
	for name, handler := range handlers {
		if slices.Contains(handler.Ext, ext) {
			customURL = handler.URL
			handlerName = name
		}
		if customURL != "" {
			break
		}
	}

	filePath := "/api/file/" + url.PathEscape(requestPath)
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	fullURL := fmt.Sprintf("%s://%s%s", scheme, r.Host, filePath)

	if customURL != "" {
		finalURL := strings.ReplaceAll(customURL, "{url}", url.QueryEscape(fullURL))
		respondJSON(w, struct {
			URL    string `json:"url"`
			Custom bool   `json:"custom,omitempty"`
			Name   string `json:"name,omitempty"`
		}{URL: finalURL, Custom: true, Name: handlerName})
	} else {
		respondJSON(w, struct {
			URL string `json:"url"`
		}{URL: fullURL})
	}
}
