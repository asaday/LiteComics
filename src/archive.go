package main

import (
	"archive/zip"
	"fmt"
	"io"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/bodgit/sevenzip"
	"github.com/maruel/natural"
	"github.com/nwaples/rardecode/v2"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/transform"
)

func (s *Server) getImagesFromBook(bookPath string) ([]string, error) {
	// Check cache
	if images, ok := s.imageListCache.Get(bookPath); ok {
		return images, nil
	}

	ext := strings.ToLower(filepath.Ext(bookPath))
	var images []string
	var err error

	switch ext {
	case ".zip", ".cbz", ".epub":
		images, err = getImagesFromZip(bookPath)
	case ".rar", ".cbr":
		images, err = getImagesFromRar(bookPath)
	case ".7z", ".cb7":
		images, err = getImagesFrom7z(bookPath)
	default:
		return nil, fmt.Errorf("unsupported archive format: %s", ext)
	}

	if err != nil {
		return nil, err
	}

	// Sort naturally
	sort.Slice(images, func(i, j int) bool {
		return natural.Less(images[i], images[j])
	})

	// Cache result
	s.imageListCache.Set(bookPath, images)

	return images, nil
}

// getDisplayNames converts original filenames to UTF-8 for safe JSON transmission
func getDisplayNames(originalNames []string) []string {
	displayNames := make([]string, len(originalNames))
	for i, name := range originalNames {
		displayNames[i] = toUTF8(name)
	}
	return displayNames
}

// toUTF8 converts a filename to UTF-8, attempting Shift_JIS decoding if invalid UTF-8
func toUTF8(name string) string {
	if utf8.ValidString(name) {
		return name
	}
	// Try Shift_JIS decoding
	decoder := japanese.ShiftJIS.NewDecoder()
	decoded, _, err := transform.String(decoder, name)
	if err == nil && utf8.ValidString(decoded) {
		return decoded
	}
	// If conversion fails, return as-is (will be replaced in JSON)
	return name
}

func getImagesFromZip(zipPath string) ([]string, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	var images []string
	for _, f := range r.File {
		if f.FileInfo().IsDir() {
			continue
		}
		if isImageFile(f.Name) {
			images = append(images, f.Name)
		}
	}

	return images, nil
}

func getImagesFromRar(rarPath string) ([]string, error) {
	r, err := rardecode.OpenReader(rarPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open RAR archive: %w", err)
	}
	defer r.Close()

	var images []string
	for {
		header, err := r.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if !header.IsDir && isImageFile(header.Name) {
			images = append(images, header.Name)
		}
	}

	return images, nil
}

func getImagesFrom7z(sevenZPath string) ([]string, error) {
	r, err := sevenzip.OpenReader(sevenZPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open 7Z archive: %w", err)
	}
	defer r.Close()

	var images []string
	for _, f := range r.File {
		if !f.FileInfo().IsDir() && isImageFile(f.Name) {
			images = append(images, f.Name)
		}
	}

	return images, nil
}

func (s *Server) extractFileFromBook(bookPath, fileName string) ([]byte, error) {
	ext := strings.ToLower(filepath.Ext(bookPath))

	switch ext {
	case ".zip", ".cbz", ".epub":
		return extractFileFromZip(bookPath, fileName)
	case ".rar", ".cbr":
		return extractFileFromRar(bookPath, fileName)
	case ".7z", ".cb7":
		return extractFileFrom7z(bookPath, fileName)
	default:
		return nil, fmt.Errorf("unsupported archive format: %s", ext)
	}
}

func extractFileFromZip(zipPath, fileName string) ([]byte, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name == fileName {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			defer rc.Close()
			return io.ReadAll(rc)
		}
	}
	return nil, fmt.Errorf("file not found in archive: %s", fileName)
}

func extractFileFromRar(rarPath, fileName string) ([]byte, error) {
	r, err := rardecode.OpenReader(rarPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open RAR archive: %w", err)
	}
	defer r.Close()

	for {
		header, err := r.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if header.Name == fileName {
			return io.ReadAll(r)
		}
	}

	return nil, fmt.Errorf("file not found in archive: %s", fileName)
}

func extractFileFrom7z(sevenZPath, fileName string) ([]byte, error) {
	r, err := sevenzip.OpenReader(sevenZPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open 7Z archive: %w", err)
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name == fileName {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			defer rc.Close()
			return io.ReadAll(rc)
		}
	}

	return nil, fmt.Errorf("file not found in archive: %s", fileName)
}
