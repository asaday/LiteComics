const { Menu, dialog, shell } = require('electron');
const path = require('path');

function setMenu(mainWindow) {
    const template = [
        {
            label: 'ファイル',
            submenu: [
                {
                    label: '⚙️ 設定',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        const { createSettingsWindow } = require('./main');
                        createSettingsWindow();
                    }
                },
                {
                    label: '設定フォルダを開く',
                    click: () => {
                        const configPath = path.join(require('electron').app.getPath('userData'), 'config.json');
                        shell.showItemInFolder(configPath);
                    }
                },
                { type: 'separator' },
                {
                    label: '終了',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        require('electron').app.quit();
                    }
                }
            ]
        },
        {
            label: '表示',
            submenu: [
                {
                    label: '再読み込み',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        mainWindow.reload();
                    }
                },
                {
                    label: 'フルスクリーン切替',
                    accelerator: 'F11',
                    click: () => {
                        mainWindow.setFullScreen(!mainWindow.isFullScreen());
                    }
                },
                { type: 'separator' },
                {
                    label: '開発者ツール',
                    accelerator: 'CmdOrCtrl+Shift+I',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                }
            ]
        },
        {
            label: 'ヘルプ',
            submenu: [
                {
                    label: 'GitHub を開く',
                    click: () => {
                        shell.openExternal('https://github.com/asaday/LiteComics');
                    }
                },
                { type: 'separator' },
                {
                    label: 'バージョン情報',
                    click: () => {
                        const pkg = require('./package.json');
                        dialog.showMessageBox(mainWindow, {
                            title: 'バージョン情報',
                            message: `${pkg.productName || pkg.name}`,
                            detail: `バージョン: ${pkg.version}\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode.js: ${process.versions.node}`,
                            type: 'info'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

module.exports = { setMenu };
