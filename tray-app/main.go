package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"github.com/getlantern/systray"
	"github.com/skratchdot/open-golang/open"
)

var (
	serverCmd *exec.Cmd
	serverURL = "http://localhost:8539"
)

func main() {
	systray.Run(onReady, onExit)
}

func onReady() {
	// アイコン設定（後でアイコンファイルに置き換え可能）
	icon := getIcon()
	if len(icon) > 0 {
		systray.SetIcon(icon)
	}
	systray.SetTitle("LiteComics")
	systray.SetTooltip("LiteComics Server")

	// メニュー項目
	mOpen := systray.AddMenuItem("ブラウザで開く", "Open in browser")
	systray.AddSeparator()
	mSettings := systray.AddMenuItem("設定", "Settings")
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("終了", "Quit")

	// サーバー起動
	if err := startServer(); err != nil {
		log.Printf("Failed to start server: %v", err)
		systray.Quit()
		return
	}

	// イベントループ
	go func() {
		for {
			select {
			case <-mOpen.ClickedCh:
				open.Run(serverURL)
			case <-mSettings.ClickedCh:
				openSettings()
			case <-mQuit.ClickedCh:
				systray.Quit()
			}
		}
	}()
}

func onExit() {
	// サーバー停止
	if serverCmd != nil && serverCmd.Process != nil {
		serverCmd.Process.Kill()
	}
}

func startServer() error {
	// 実行ファイルのディレクトリを取得
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	exeDir := filepath.Dir(exePath)

	// Node.jsバイナリのパス
	var nodeBinary string
	switch runtime.GOOS {
	case "darwin":
		nodeBinary = filepath.Join(exeDir, "node")
	case "windows":
		nodeBinary = filepath.Join(exeDir, "node.exe")
	case "linux":
		nodeBinary = filepath.Join(exeDir, "node")
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	// server.jsのパス
	serverJS := filepath.Join(exeDir, "server.js")

	// 設定ファイルのパス
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	configPath := filepath.Join(homeDir, ".litecomics", "config.json")

	// サーバー起動: node server.js -c configPath
	serverCmd = exec.Command(nodeBinary, serverJS, "-c", configPath)
	serverCmd.Stdout = os.Stdout
	serverCmd.Stderr = os.Stderr

	if err := serverCmd.Start(); err != nil {
		return err
	}

	log.Println("LiteComics server started")
	return nil
}

func openSettings() {
	// 設定ファイルをテキストエディタで開く
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Printf("Failed to get home directory: %v", err)
		return
	}
	configPath := filepath.Join(homeDir, ".litecomics", "config.json")
	
	// 設定ファイルが存在しない場合は作成
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		configDir := filepath.Dir(configPath)
		os.MkdirAll(configDir, 0755)
		
		defaultConfig := `{
  "port": 8539,
  "roots": []
}`
		os.WriteFile(configPath, []byte(defaultConfig), 0644)
	}
	
	// macOSならテキストエディットで開く
	if runtime.GOOS == "darwin" {
		exec.Command("open", "-a", "TextEdit", configPath).Start()
	} else {
		open.Run(configPath)
	}
}

func getIcon() []byte {
	// シンプルなアイコン（後でPNGアイコンに置き換え可能）
	// とりあえず空のバイト配列を返す
	return []byte{}
}
