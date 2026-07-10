package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestHandleUploadFilesFoldersAndConflict(t *testing.T) {
	root := t.TempDir()
	enabled := true
	server := initServer(&Config{
		Roots:       []RootConfig{{Path: root, Name: "Root"}},
		AllowUpload: &enabled,
	})

	upload := uploadRequest{
		destination: "Root",
		directories: []string{"collection", "collection/empty"},
		files: []uploadFile{
			{path: "collection/one.cbz", data: "one"},
			{path: "loose.txt", data: "loose"},
		},
	}
	requestUpload(t, server, upload, http.StatusOK)

	data, err := os.ReadFile(filepath.Join(root, "collection", "one.cbz"))
	if err != nil || string(data) != "one" {
		t.Fatalf("nested uploaded file = %q, %v", data, err)
	}
	if info, err := os.Stat(filepath.Join(root, "collection", "empty")); err != nil || !info.IsDir() {
		t.Fatalf("empty uploaded directory = %v, %v", info, err)
	}
	if data, err := os.ReadFile(filepath.Join(root, "loose.txt")); err != nil || string(data) != "loose" {
		t.Fatalf("loose uploaded file = %q, %v", data, err)
	}

	requestUpload(t, server, upload, http.StatusConflict)
	data, err = os.ReadFile(filepath.Join(root, "collection", "one.cbz"))
	if err != nil || string(data) != "one" {
		t.Fatalf("conflicting upload changed existing file = %q, %v", data, err)
	}
}

func TestHandleUploadRejectsTraversal(t *testing.T) {
	root := t.TempDir()
	enabled := true
	server := initServer(&Config{
		Roots:       []RootConfig{{Path: root, Name: "Root"}},
		AllowUpload: &enabled,
	})

	requestUpload(t, server, uploadRequest{
		destination: "Root",
		files:       []uploadFile{{path: "../outside.txt", data: "no"}},
	}, http.StatusBadRequest)
	if _, err := os.Stat(filepath.Join(filepath.Dir(root), "outside.txt")); !os.IsNotExist(err) {
		t.Fatalf("traversal created a file outside the root: %v", err)
	}
}

type uploadFile struct {
	path string
	data string
}

type uploadRequest struct {
	destination string
	directories []string
	files       []uploadFile
}

func requestUpload(t *testing.T, server *Server, upload uploadRequest, wantStatus int) {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("destination", upload.destination); err != nil {
		t.Fatal(err)
	}
	directories, err := json.Marshal(upload.directories)
	if err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("directories", string(directories)); err != nil {
		t.Fatal(err)
	}
	for _, file := range upload.files {
		if err := writer.WriteField("paths", file.path); err != nil {
			t.Fatal(err)
		}
		part, err := writer.CreateFormFile("files", filepath.Base(file.path))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write([]byte(file.data)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/command/upload", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response := httptest.NewRecorder()
	server.handleUpload(response, request)
	if response.Code != wantStatus {
		t.Fatalf("status = %d, want %d; body = %s", response.Code, wantStatus, response.Body.String())
	}
}
