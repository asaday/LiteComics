let config = { port: 8539, roots: [] };

// 設定を読み込む
async function loadConfig() {
    try {
        config = await window.electronAPI.loadConfig();
        document.getElementById('port').value = config.port || 8539;
        renderRoots();
    } catch (error) {
        console.error('Failed to load config:', error);
        alert('設定の読み込みに失敗しました');
    }
}

// ルートリストを表示
function renderRoots() {
    const rootList = document.getElementById('rootList');
    rootList.innerHTML = '';

    if (!config.roots || config.roots.length === 0) {
        rootList.innerHTML = '<div class="empty-message">ルートディレクトリが設定されていません</div>';
        return;
    }

    config.roots.forEach((root, index) => {
        const path = typeof root === 'string' ? root : root.path;
        const name = typeof root === 'string' ? '' : root.name;

        const div = document.createElement('div');
        div.className = 'root-item';
        div.innerHTML = `
      <span>${path}${name ? ` (${name})` : ''}</span>
      <button class="btn-danger" data-index="${index}">削除</button>
    `;
        rootList.appendChild(div);
    });

    // 削除ボタンのイベントリスナーを追加
    rootList.querySelectorAll('.btn-danger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            removeRoot(index);
        });
    });
}

// ルートを削除
function removeRoot(index) {
    if (confirm('このルートディレクトリを削除しますか？')) {
        config.roots.splice(index, 1);
        renderRoots();
    }
}

// フォルダ追加
document.getElementById('addRoot').addEventListener('click', async () => {
    try {
        const path = await window.electronAPI.selectFolder();
        if (path) {
            // 重複チェック
            const exists = config.roots.some(root => {
                const rootPath = typeof root === 'string' ? root : root.path;
                return rootPath === path;
            });

            if (exists) {
                alert('このフォルダは既に追加されています');
                return;
            }

            config.roots.push(path);
            renderRoots();
        }
    } catch (error) {
        console.error('Failed to select folder:', error);
        alert('フォルダの選択に失敗しました');
    }
});

// 保存
document.getElementById('save').addEventListener('click', async () => {
    try {
        // ポート番号の検証
        const port = parseInt(document.getElementById('port').value);
        if (isNaN(port) || port < 1024 || port > 65535) {
            alert('ポート番号は 1024 から 65535 の間で指定してください');
            return;
        }

        config.port = port;

        const result = await window.electronAPI.saveConfig(config);
        if (result.success) {
            alert('設定を保存しました。\nサーバーを再起動しています...');
            window.close();
        } else {
            alert(`設定の保存に失敗しました: ${result.error}`);
        }
    } catch (error) {
        console.error('Failed to save config:', error);
        alert('設定の保存に失敗しました');
    }
});

// キャンセル
document.getElementById('cancel').addEventListener('click', () => {
    if (confirm('変更を破棄しますか？')) {
        window.close();
    }
});

// ESCキーでキャンセル
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.getElementById('cancel').click();
    }
});

// 初期化
loadConfig();
