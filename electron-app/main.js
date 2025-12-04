const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const net = require('net');

// アプリ名を設定
app.name = 'LiteComics';

let mainWindow;
let settingsWindow;
let serverProcess = null;
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
    return new Promise(async (resolve, reject) => {
        try {
            // 設定ファイルのパス
            const configPath = path.join(app.getPath('userData'), 'config.json');

            // 初回起動チェック
            const isFirstRun = !fs.existsSync(configPath);

            // デフォルト設定を作成
            if (isFirstRun) {
                const defaultConfig = {
                    port: PORT,
                    roots: [
                        app.getPath('documents')
                    ]
                };
                fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));

                // 初回起動メッセージを表示
                dialog.showMessageBox({
                    type: 'info',
                    title: 'LiteComics へようこそ',
                    message: '初回起動です',
                    detail: `デフォルトの閲覧フォルダとして「${app.getPath('documents')}」が設定されました。\n\n設定を変更する場合は、メニューの「設定」から変更できます。`,
                    buttons: ['OK']
                });
            }

            // server.jsをメインプロセスで直接実行する
            // コマンドライン引数を設定
            process.argv = ['electron', 'server.js', '-c', configPath, '-p', PORT.toString()];

            // パッケージ化されたアプリかどうかで処理を分岐
            let serverPath;
            let publicDir;

            if (app.isPackaged) {
                // パッケージ化されたアプリの場合
                serverPath = path.join(process.resourcesPath, 'server.js');
                publicDir = path.join(process.resourcesPath, 'public');
            } else {
                // 開発環境の場合
                serverPath = path.join(__dirname, '..', 'server.js');
                publicDir = path.join(__dirname, '..', 'public');
            }

            // 既存のサーバープロセスがあれば終了
            if (serverProcess) {
                // プロセスが完全に終了するまで待つ
                await new Promise((resolveKill) => {
                    const killTimer = setTimeout(() => {
                        if (serverProcess) {
                            console.log('Force killing server process (timeout)');
                            serverProcess.kill('SIGKILL');
                            serverProcess = null;
                        }
                        resolveKill();
                    }, 5000);

                    serverProcess.once('exit', () => {
                        clearTimeout(killTimer);
                        serverProcess = null;
                        resolveKill();
                    });

                    serverProcess.kill();
                });
            }

            // server.jsを子プロセスとして起動
            const workDir = path.dirname(publicDir);

            // 開発環境ではnode、パッケージ化されたアプリではElectronのnodeを使用
            let nodeExec;
            if (app.isPackaged) {
                // プラットフォーム別にnodeバイナリのパスを決定
                if (process.platform === 'darwin') {
                    nodeExec = path.join(path.dirname(process.execPath), '..', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Resources', 'node');
                } else if (process.platform === 'win32') {
                    nodeExec = path.join(path.dirname(process.execPath), 'node.exe');
                } else {
                    // Linux
                    nodeExec = path.join(path.dirname(process.execPath), 'node');
                }

                // フォールバック: nodeバイナリが見つからない場合はメインプロセスで実行
                if (!fs.existsSync(nodeExec)) {
                    console.error('Node binary not found, using main process');
                    process.chdir(workDir);
                    require(serverPath);
                    setTimeout(() => resolve(), 1000);
                    return;
                }
            } else {
                nodeExec = 'node';
            }

            console.log('Starting server with:');
            console.log('  nodeExec:', nodeExec);
            console.log('  serverPath:', serverPath);
            console.log('  configPath:', configPath);
            console.log('  workDir:', workDir);

            serverProcess = spawn(nodeExec, [serverPath, '-c', configPath, '-p', PORT.toString()], {
                cwd: workDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            serverProcess.stdout.on('data', (data) => {
                console.log(`Server: ${data}`);
            });

            serverProcess.stderr.on('data', (data) => {
                console.error(`Server Error: ${data}`);
            });

            serverProcess.on('error', (error) => {
                console.error(`Failed to start server process: ${error}`);
            });

            serverProcess.on('exit', (code, signal) => {
                console.log(`Server process exited with code ${code}, signal ${signal}`);
                serverProcess = null;
            });

            // サーバーが起動したことをチェック（ポートがリッスン状態になるまで待つ）
            const net = require('net');
            let attempts = 0;
            const maxAttempts = 20; // 最大2秒（100ms × 20）

            const checkServer = () => {
                const client = net.createConnection({ port: PORT }, () => {
                    client.end();
                    resolve();
                });

                client.on('error', () => {
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkServer, 100);
                    } else {
                        // タイムアウト
                        resolve();
                    }
                });
            };

            setTimeout(checkServer, 100);

        } catch (error) {
            reject(error);
        }
    });
}

app.on('ready', async () => {
    // IPC ハンドラーを設定
    const { setupIpcHandlers } = require('./ipc-handlers');
    setupIpcHandlers(app, restartServer);

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
    // サーバープロセスを終了
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
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
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
});

// サーバー再起動関数
async function restartServer() {
    await startServer();
    // メインウィンドウをリロード
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
    }
}

module.exports = { createSettingsWindow, restartServer };
