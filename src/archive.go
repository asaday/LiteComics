package main

import (
	"archive/zip"
	"fmt"
	"io"
	"path/filepath"
	"sort"
	"strings"

	"github.com/bodgit/sevenzip"
	"github.com/nwaples/rardecode/v2"
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
		return strings.ToLower(images[i]) < strings.ToLower(images[j])
	})

	// Cache result
	s.imageListCache.Set(bookPath, images)

	return images, nil
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
