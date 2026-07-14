package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestCopyPathCopiesDirectoryAndSymlink(t *testing.T) {
	base := t.TempDir()
	source := filepath.Join(base, "source")
	destination := filepath.Join(base, "destination")
	if err := os.Mkdir(source, 0750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, "comic.cbz"), []byte("pages"), 0640); err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" {
		if err := os.Symlink("comic.cbz", filepath.Join(source, "latest.cbz")); err != nil {
			t.Fatal(err)
		}
	}

	if err := copyPath(source, destination); err != nil {
		t.Fatalf("copyPath() error = %v", err)
	}
	data, err := os.ReadFile(filepath.Join(destination, "comic.cbz"))
	if err != nil || string(data) != "pages" {
		t.Fatalf("copied file = %q, %v", data, err)
	}
	if runtime.GOOS != "windows" {
		info, err := os.Lstat(filepath.Join(destination, "latest.cbz"))
		if err != nil || info.Mode()&os.ModeSymlink == 0 {
			t.Fatalf("copied symlink info = %v, %v", info, err)
		}
	}
}

func TestHandleTransferCopyAndMove(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "copy.txt"), []byte("copy"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "move.txt"), []byte("move"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(root, "target"), 0755); err != nil {
		t.Fatal(err)
	}
	enabled := true
	server := initServer(&Config{
		Roots:               []RootConfig{{Path: root, Name: "Root"}},
		AllowFileOperations: &enabled,
	})

	requestTransfer(t, server, "Root/copy.txt", "Root/target", "copy", http.StatusOK)
	if _, err := os.Stat(filepath.Join(root, "copy.txt")); err != nil {
		t.Fatalf("copy removed source: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "target", "copy.txt")); err != nil {
		t.Fatalf("copy did not create destination: %v", err)
	}

	requestTransfer(t, server, "Root/move.txt", "Root/target", "move", http.StatusOK)
	if _, err := os.Stat(filepath.Join(root, "move.txt")); !os.IsNotExist(err) {
		t.Fatalf("move left source behind: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "target", "move.txt")); err != nil {
		t.Fatalf("move did not create destination: %v", err)
	}
}

func TestHandleTransferRejectsFolderIntoItself(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "folder", "child"), 0755); err != nil {
		t.Fatal(err)
	}
	enabled := true
	server := initServer(&Config{
		Roots:               []RootConfig{{Path: root, Name: "Root"}},
		AllowFileOperations: &enabled,
	})

	requestTransfer(t, server, "Root/folder", "Root/folder/child", "copy", http.StatusBadRequest)
}

func TestHandleMkdir(t *testing.T) {
	root := t.TempDir()
	enabled := true
	server := initServer(&Config{
		Roots:               []RootConfig{{Path: root, Name: "Root"}},
		AllowFileOperations: &enabled,
	})

	body, err := json.Marshal(map[string]string{"path": "Root", "name": "New Folder"})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/command/mkdir", bytes.NewReader(body))
	response := httptest.NewRecorder()
	server.handleMkdir(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body = %s", response.Code, http.StatusOK, response.Body.String())
	}
	info, err := os.Stat(filepath.Join(root, "New Folder"))
	if err != nil || !info.IsDir() {
		t.Fatalf("created folder info = %v, %v", info, err)
	}
}

func TestHandleMkdirRejectsInvalidNameAndDisabledConfig(t *testing.T) {
	root := t.TempDir()
	enabled := true
	server := initServer(&Config{
		Roots:               []RootConfig{{Path: root, Name: "Root"}},
		AllowFileOperations: &enabled,
	})

	body := bytes.NewBufferString(`{"path":"Root","name":"bad/name"}`)
	response := httptest.NewRecorder()
	server.handleMkdir(response, httptest.NewRequest(http.MethodPost, "/api/command/mkdir", body))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("invalid name status = %d, want %d", response.Code, http.StatusBadRequest)
	}

	disabled := false
	server = initServer(&Config{
		Roots:               []RootConfig{{Path: root, Name: "Root"}},
		AllowFileOperations: &disabled,
	})
	body = bytes.NewBufferString(`{"path":"Root","name":"Blocked"}`)
	response = httptest.NewRecorder()
	server.handleMkdir(response, httptest.NewRequest(http.MethodPost, "/api/command/mkdir", body))
	if response.Code != http.StatusForbidden {
		t.Fatalf("disabled status = %d, want %d", response.Code, http.StatusForbidden)
	}
}

func requestTransfer(t *testing.T, server *Server, source, destination, operation string, wantStatus int) {
	t.Helper()
	body, err := json.Marshal(map[string]string{
		"source": source, "destination": destination, "operation": operation,
	})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/command/transfer", bytes.NewReader(body))
	response := httptest.NewRecorder()
	server.handleTransfer(response, request)
	if response.Code != wantStatus {
		t.Fatalf("status = %d, want %d; body = %s", response.Code, wantStatus, response.Body.String())
	}
}
