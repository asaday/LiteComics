const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let settingsWindow;
let server;
const PORT = 8539;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: path.join(__dirname, 'build', 'icon.png')
    });

    // メニューを設定
    const menu = require('./menu');
    menu.setMenu(mainWindow);

    mainWindow.loadURL(`http://localhost:${PORT}`);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 900,
        height: 700,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

function startServer() {
    return new Promise((resolve, reject) => {
        try {
            // 設定ファイルのパス
            const configPath = path.join(app.getPath('userData'), 'config.json');

            // デフォルト設定を作成
            if (!fs.existsSync(configPath)) {
                const defaultConfig = {
                    port: PORT,
                    roots: [
                        app.getPath('documents')
                    ]
                };
                fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            }

            // 環境変数で設定ファイルのパスを指定
            process.env.CONFIG_PATH = configPath;

            // 親ディレクトリのserver.jsを実行
            const serverPath = path.join(__dirname, '..', 'server.js');

            // サーバーを起動（server.jsが直接実行される形式なので、child_processで実行）
            const { spawn } = require('child_process');

            // Node.jsでserver.jsを実行
            server = spawn(process.execPath, [serverPath], {
                env: {
                    ...process.env,
                    PORT: PORT.toString(),
                    CONFIG_PATH: configPath
                },
                cwd: path.join(__dirname, '..')
            });

            server.stdout.on('data', (data) => {
                console.log(`Server: ${data}`);
            });

            server.stderr.on('data', (data) => {
                console.error(`Server Error: ${data}`);
            });

            server.on('close', (code) => {
                console.log(`Server process exited with code ${code}`);
            });

            // サーバーが起動するまで少し待つ
            setTimeout(() => {
                resolve();
            }, 2000);

        } catch (error) {
            reject(error);
        }
    });
}

app.on('ready', async () => {
    // IPC ハンドラーを設定
    const { setupIpcHandlers } = require('./ipc-handlers');
    setupIpcHandlers(app);

    try {
        await startServer();
        createWindow();
    } catch (error) {
        console.error('Failed to start server:', error);
        dialog.showErrorBox('起動エラー', `サーバーの起動に失敗しました: ${error.message}`);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (server) {
        server.kill();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('before-quit', () => {
    if (server) {
        server.kill();
    }
});

module.exports = { createSettingsWindow };
