package main

import (
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// CacheMetadata represents cache entry metadata
type CacheMetadata struct {
	Path       string
	LastAccess int64
	Size       int64
}

// ImageListEntry represents cached image list
type ImageListEntry struct {
	Images     []string
	LastAccess int64
}

// ThumbnailCache manages thumbnail caching
type ThumbnailCache struct {
	dir      string
	metadata map[string]*CacheMetadata
	mu       sync.RWMutex
	maxSize  int
}

// ImageListCache manages image list caching
type ImageListCache struct {
	cache   map[string]*ImageListEntry
	mu      sync.RWMutex
	maxSize int
}

// ThumbnailCache methods
func (c *ThumbnailCache) loadExisting() {
	c.mu.Lock()
	defer c.mu.Unlock()

	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if info, err := entry.Info(); err == nil {
			c.metadata[entry.Name()] = &CacheMetadata{
				Path:       filepath.Join(c.dir, entry.Name()),
				LastAccess: info.ModTime().UnixMilli(),
				Size:       info.Size(),
			}
		}
	}
}

func (c *ThumbnailCache) Get(key string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	meta, ok := c.metadata[key]
	if !ok {
		return nil, false
	}

	data, err := os.ReadFile(meta.Path)
	if err != nil {
		delete(c.metadata, key)
		return nil, false
	}

	meta.LastAccess = time.Now().UnixMilli()
	return data, true
}

func (c *ThumbnailCache) Set(key string, data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()

	cachePath := filepath.Join(c.dir, key)
	if err := os.WriteFile(cachePath, data, 0644); err != nil {
		return
	}

	c.metadata[key] = &CacheMetadata{
		Path:       cachePath,
		LastAccess: time.Now().UnixMilli(),
		Size:       int64(len(data)),
	}

	c.cleanup()
}

func (c *ThumbnailCache) cleanup() {
	if len(c.metadata) <= c.maxSize {
		return
	}

	// Sort by access time
	type kv struct {
		key  string
		time int64
	}
	entries := make([]kv, 0, len(c.metadata))
	for k, v := range c.metadata {
		entries = append(entries, kv{k, v.LastAccess})
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].time < entries[j].time })

	// Delete oldest entries
	for _, e := range entries[:len(entries)-c.maxSize] {
		os.Remove(c.metadata[e.key].Path)
		delete(c.metadata, e.key)
	}
}

// ImageListCache methods
func (c *ImageListCache) Get(path string) ([]string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.cache[path]
	if !ok {
		return nil, false
	}

	entry.LastAccess = time.Now().UnixMilli()
	return entry.Images, true
}

func (c *ImageListCache) Set(path string, images []string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache[path] = &ImageListEntry{
		Images:     images,
		LastAccess: time.Now().UnixMilli(),
	}

	c.cleanup()
}

func (c *ImageListCache) cleanup() {
	if len(c.cache) <= c.maxSize {
		return
	}

	type kv struct {
		key  string
		time int64
	}
	entries := make([]kv, 0, len(c.cache))
	for k, v := range c.cache {
		entries = append(entries, kv{k, v.LastAccess})
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].time < entries[j].time })

	for _, e := range entries[:len(entries)-c.maxSize] {
		delete(c.cache, e.key)
	}
}
