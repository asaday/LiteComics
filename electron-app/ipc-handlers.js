const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

function setupIpcHandlers(app, restartServerCallback) {
    const configPath = path.join(app.getPath('userData'), 'config.json');

    // 設定を読み込む
    ipcMain.handle('load-config', async () => {
        try {
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8');
                return JSON.parse(configData);
            }
        } catch (error) {
            console.error('Config load error:', error);
        }
        // デフォルト設定を返す
        return {
            port: 8539,
            roots: [app.getPath('documents')]
        };
    });

    // 設定を保存する
    ipcMain.handle('save-config', async (event, config) => {
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

            // サーバーを再起動
            if (restartServerCallback) {
                await restartServerCallback();
            }

            return { success: true };
        } catch (error) {
            console.error('Config save error:', error);
            return { success: false, error: error.message };
        }
    });

    // フォルダ選択ダイアログ
    ipcMain.handle('select-folder', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'ルートディレクトリを選択'
        });
        return result.canceled ? null : result.filePaths[0];
    });
}

module.exports = { setupIpcHandlers };
