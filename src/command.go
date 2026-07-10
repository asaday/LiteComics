package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// handleTransfer copies or moves a file or directory into another configured directory.
func (s *Server) handleTransfer(w http.ResponseWriter, r *http.Request) {
	if s.config.AllowTransfer == nil || !*s.config.AllowTransfer {
		respondError(w, "File transfer is disabled", http.StatusForbidden)
		return
	}
	s.transferMutex.Lock()
	defer s.transferMutex.Unlock()

	var req struct {
		Source      string `json:"source"`
		Destination string `json:"destination"`
		Operation   string `json:"operation"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Source == "" || req.Destination == "" || (req.Operation != "copy" && req.Operation != "move") {
		respondError(w, "Source, destination, and a valid operation are required", http.StatusBadRequest)
		return
	}

	source, err := s.resolveRequestPath(req.Source)
	if err != nil {
		respondError(w, "Invalid source path", http.StatusBadRequest)
		return
	}
	destination, err := s.resolveRequestPath(req.Destination)
	if err != nil {
		respondError(w, "Invalid destination path", http.StatusBadRequest)
		return
	}
	// Configured roots are containers, not transferable items.
	if source.RelativePath == "" {
		respondError(w, "A root directory cannot be transferred", http.StatusBadRequest)
		return
	}

	sourceInfo, err := os.Lstat(source.FullPath)
	if err != nil {
		if os.IsNotExist(err) {
			respondError(w, "Source file or directory not found", http.StatusNotFound)
		} else {
			respondError(w, err.Error(), http.StatusInternalServerError)
		}
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

	targetPath := filepath.Join(destination.FullPath, filepath.Base(source.FullPath))
	realSource, sourceErr := filepath.EvalSymlinks(source.FullPath)
	realTargetPath := filepath.Join(realDestination, filepath.Base(source.FullPath))
	if samePath(source.FullPath, targetPath) {
		respondError(w, "Source and destination are the same", http.StatusBadRequest)
		return
	}
	if sourceInfo.IsDir() && (pathContains(source.FullPath, targetPath) ||
		(sourceErr == nil && pathContains(realSource, realTargetPath))) {
		respondError(w, "A folder cannot be transferred into itself", http.StatusBadRequest)
		return
	}
	if _, err := os.Lstat(targetPath); err == nil {
		respondError(w, "An item with the same name already exists in the destination", http.StatusConflict)
		return
	} else if !os.IsNotExist(err) {
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if req.Operation == "copy" {
		err = copyPath(source.FullPath, targetPath)
	} else {
		err = os.Rename(source.FullPath, targetPath)
		if err != nil {
			// os.Rename cannot cross filesystem boundaries. Copy first and only
			// remove the source after the complete copy succeeds.
			if copyErr := copyPath(source.FullPath, targetPath); copyErr != nil {
				err = fmt.Errorf("rename failed: %v; copy fallback failed: %w", err, copyErr)
			} else if removeErr := removeTransferredSource(source.FullPath, sourceInfo); removeErr != nil {
				err = fmt.Errorf("copy succeeded but the source could not be removed: %w", removeErr)
			} else {
				err = nil
			}
		}
	}
	if err != nil {
		respondError(w, fmt.Sprintf("Failed to %s: %v", req.Operation, err), http.StatusInternalServerError)
		return
	}

	targetRelative := filepath.Base(source.FullPath)
	if destination.RelativePath != "" {
		targetRelative = filepath.Join(destination.RelativePath, targetRelative)
	}
	respondJSON(w, struct {
		Success   bool   `json:"success"`
		Operation string `json:"operation"`
		NewPath   string `json:"newPath"`
	}{true, req.Operation, filepath.Join(destination.RootName, targetRelative)})
}

func samePath(a, b string) bool {
	absA, errA := filepath.Abs(a)
	absB, errB := filepath.Abs(b)
	return errA == nil && errB == nil && filepath.Clean(absA) == filepath.Clean(absB)
}

func pathContains(parent, child string) bool {
	absParent, err := filepath.Abs(parent)
	if err != nil {
		return false
	}
	absChild, err := filepath.Abs(child)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(absParent, absChild)
	return err == nil && rel != "." && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func copyPath(source, destination string) (err error) {
	info, err := os.Lstat(source)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = os.RemoveAll(destination)
		}
	}()

	if info.Mode()&os.ModeSymlink != 0 {
		target, readErr := os.Readlink(source)
		if readErr != nil {
			return readErr
		}
		return os.Symlink(target, destination)
	}
	if info.IsDir() {
		if err = os.Mkdir(destination, info.Mode().Perm()); err != nil {
			return err
		}
		entries, readErr := os.ReadDir(source)
		if readErr != nil {
			return readErr
		}
		for _, entry := range entries {
			if err = copyPath(filepath.Join(source, entry.Name()), filepath.Join(destination, entry.Name())); err != nil {
				return err
			}
		}
		return os.Chtimes(destination, info.ModTime(), info.ModTime())
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("unsupported file type: %s", info.Mode().String())
	}

	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_EXCL, info.Mode().Perm())
	if err != nil {
		return err
	}
	if _, err = io.Copy(output, input); err != nil {
		_ = output.Close()
		return err
	}
	if err = output.Close(); err != nil {
		return err
	}
	return os.Chtimes(destination, info.ModTime(), info.ModTime())
}

func removeTransferredSource(path string, info os.FileInfo) error {
	if info.IsDir() && info.Mode()&os.ModeSymlink == 0 {
		return os.RemoveAll(path)
	}
	return os.Remove(path)
}

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
