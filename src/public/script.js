
// demo URLを生成
function fixUrl(path) {
  const pathParts = window.location.pathname.split('/');
  const demoIndex = pathParts.indexOf('__demo__');
  if (demoIndex === -1) return path;
  const demoPrefix = pathParts.slice(0, demoIndex + 1).join('/');

  if (path.startsWith('/api/roots') || path.startsWith('/api/dir'))
    return `${demoPrefix}/../__data__/roots.json`;

  if (path.startsWith('/#'))
    return `${demoPrefix}`;

  const thumbnailMatch = path.match(/^\/api\/book\/([^\/]+)\/thumbnail$/);
  if (thumbnailMatch) return `${demoPrefix}/../__data__/thumbnail/${decodeURIComponent(thumbnailMatch[1])}.webp`;

  if (path.startsWith('/viewer/')) return `${demoPrefix}${path}`;
  if (path.startsWith('/media/')) return `${demoPrefix}${path}`;
  if (path.startsWith('/settings/')) return `${demoPrefix}`;

  return path;
}

let files = [];
let currentIndex = 0;
let currentRootName = null;
let currentRelativePath = '';
let allowRename = false;
let allowRemove = false;
let allowArchive = false;
let disableGUI = false;

// 履歴管理
const MAX_HISTORY_ITEMS = 256;
const HISTORY_KEY = 'file_history';

// 履歴を取得
function getHistory() {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (e) {
    console.error('Failed to load history:', e);
    return [];
  }
}

// 履歴を保存
function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

// 履歴に追加
function addToHistory(file) {
  const history = getHistory();

  // 既存のエントリを削除（重複を避ける）
  const filteredHistory = history.filter(h => h.path !== file.path);

  // 新しいエントリを先頭に追加
  const newEntry = {
    path: file.path,
    name: file.name,
    type: file.type,
    timestamp: Date.now()
  };

  filteredHistory.unshift(newEntry);

  // 最大数を超えた分を削除
  if (filteredHistory.length > MAX_HISTORY_ITEMS) {
    filteredHistory.splice(MAX_HISTORY_ITEMS);
  }

  saveHistory(filteredHistory);
}

// カスタムダイアログを表示
function showConfirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-dialog');
    const messageDiv = dialog.querySelector('.confirm-dialog-message');
    const okBtn = dialog.querySelector('.confirm-dialog-ok');
    const cancelBtn = dialog.querySelector('.confirm-dialog-cancel');

    messageDiv.textContent = message;

    // destructiveオプションの場合はOKボタンを赤くする
    if (options.destructive) {
      okBtn.classList.add('destructive');
    } else {
      okBtn.classList.remove('destructive');
    }

    dialog.classList.add('visible');

    setTimeout(() => cancelBtn.focus(), 0);

    const handleOk = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleOk();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      }
    };

    const cleanup = () => {
      dialog.classList.remove('visible');
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeyDown);
    };

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeyDown);
  });
}

// カスタムプロンプトダイアログを表示
function showPromptDialog(message, defaultValue = '') {
  return new Promise((resolve) => {
    const dialog = document.getElementById('prompt-dialog');
    const messageDiv = dialog.querySelector('.prompt-dialog-message');
    const input = dialog.querySelector('.prompt-dialog-input');
    const okBtn = dialog.querySelector('.prompt-dialog-ok');
    const cancelBtn = dialog.querySelector('.prompt-dialog-cancel');

    messageDiv.textContent = message;
    input.value = defaultValue;

    dialog.classList.add('visible');

    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);

    const handleOk = () => {
      const value = input.value.trim();
      cleanup();
      resolve(value);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleOk();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      }
    };

    const cleanup = () => {
      dialog.classList.remove('visible');
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      input.removeEventListener('keydown', handleKeyDown);
    };

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    input.addEventListener('keydown', handleKeyDown);
  });
}

// 履歴をクリア
async function clearHistory() {
  if (await showConfirmDialog('Are you sure you want to clear all history?')) {
    localStorage.removeItem(HISTORY_KEY);
    showHistoryOverlay();
  }
}

// 履歴オーバーレイを表示
function showHistoryOverlay() {
  const overlay = document.getElementById('history-overlay');
  const listDiv = document.getElementById('history-list');

  overlay.classList.add('visible');

  const history = getHistory();

  if (history.length === 0) {
    listDiv.innerHTML = '<div class="history-empty">No history yet</div>';
    return;
  }

  listDiv.innerHTML = '';

  history.forEach(item => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';

    // コンテンツへのリンク部分
    const contentDiv = document.createElement('div');
    contentDiv.className = 'history-item-content';

    const icon = document.createElement('div');
    icon.className = 'history-item-icon';
    icon.textContent = item.type === 'book' ? '📚' : item.type === 'video' ? '🎬' : '🎵';

    const info = document.createElement('div');
    info.className = 'history-item-info';

    const name = document.createElement('div');
    name.className = 'history-item-name';
    name.textContent = item.name;

    const path = document.createElement('div');
    path.className = 'history-item-path';
    // ファイル名を除いたディレクトリパスのみ表示
    const dirPath = item.path.substring(0, item.path.lastIndexOf('/'));
    path.textContent = dirPath || '/';

    info.appendChild(name);
    info.appendChild(path);

    const time = document.createElement('div');
    time.className = 'history-item-time';
    time.textContent = formatTime(item.timestamp);

    contentDiv.appendChild(icon);
    contentDiv.appendChild(info);
    contentDiv.appendChild(time);

    contentDiv.addEventListener('click', () => {
      if (item.type === 'book') {
        window.location.href = fixUrl(`/viewer/#${encodeURIComponent(item.path)}`);
      } else if (item.type === 'video' || item.type === 'audio') {
        window.location.href = fixUrl(`/media/#${encodeURIComponent(item.path)}`);
      }
    });

    // フォルダボタン
    const folderBtn = document.createElement('button');
    folderBtn.className = 'history-item-folder-btn';
    folderBtn.textContent = ' 📁 ';
    folderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // パスから親ディレクトリを取得
      const parentPath = item.path.substring(0, item.path.lastIndexOf('/'));
      hideHistoryOverlay();
      window.location.hash = `#${encodeURIComponent(parentPath)}`;
    });

    historyItem.appendChild(contentDiv);
    historyItem.appendChild(folderBtn);
    listDiv.appendChild(historyItem);
  });
}

// 履歴オーバーレイを非表示
function hideHistoryOverlay() {
  const overlay = document.getElementById('history-overlay');
  overlay.classList.remove('visible');
}

// 時刻をフォーマット
function formatTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

// コンテキストメニュー
let contextMenuFile = null;

// コンテキストメニューを生成
function createContextMenu(file) {
  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.className = 'context-menu';

  // ファイル情報セクション
  const info = document.createElement('div');
  info.className = 'context-menu-info';

  const infoName = document.createElement('div');
  infoName.className = 'context-menu-info-name';
  infoName.textContent = file.name;
  info.appendChild(infoName);

  const infoDetails = document.createElement('div');
  infoDetails.className = 'context-menu-info-details';

  // フォルダとファイルで表示内容を分ける
  if (file.type !== 'directory') {
    const infoSize = document.createElement('div');
    infoSize.className = 'context-menu-info-size';
    if (file.size !== undefined && file.size !== null) {
      infoSize.textContent = formatFileSize(file.size);
    }
    infoDetails.appendChild(infoSize);
  }

  if (file.modified) {
    const infoDate = document.createElement('div');
    infoDate.className = 'context-menu-info-date';
    const date = new Date(file.modified);
    infoDate.textContent = formatFileDate(date);
    infoDetails.appendChild(infoDate);
  }

  info.appendChild(infoDetails);
  menu.appendChild(info);

  // メニュー項目を追加
  const addMenuItem = (label, callback) => {
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.textContent = label;
    item.addEventListener('click', () => {
      hideContextMenu();
      callback();
    });
    menu.appendChild(item);
  };

  const addSeparator = () => {
    const sep = document.createElement('div');
    sep.className = 'context-menu-separator';
    menu.appendChild(sep);
  };

  // メニュー項目を追加
  if (file.type !== 'directory') {
    addMenuItem('Download', () => {
      const apiUrl = `/api/file/${encodeURIComponent(file.path)}`;
      const link = document.createElement('a');
      link.href = fixUrl(apiUrl);
      link.download = file.name;
      link.click();
    });
    addMenuItem('Copy URL', async () => {
      try {
        const apiUrl = `/api/file/${encodeURIComponent(file.path)}`;
        const pathToCopy = window.location.origin + fixUrl(apiUrl);

        // Clipboard API fallback for non-HTTPS environments
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(pathToCopy);
          alert('URL copied to clipboard');
        } else {
          // Fallback: show prompt with URL
          showPromptDialog('Copy this URL:', pathToCopy);
        }
      } catch (err) {
        console.error('Failed to copy URL:', err);
        // Fallback on error
        showPromptDialog('Copy this URL:', window.location.origin + fixUrl(`/api/file/${encodeURIComponent(file.path)}`));
      }
    });
  }

  // Rename
  if (allowRename) {
    addMenuItem('Rename', async () => {
      const newName = await showPromptDialog('Enter new name:', file.name);
      if (!newName || newName === file.name) {
        return;
      }

      try {
        const response = await fetch('/api/command/rename', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: file.path,
            newName: newName,
          }),
        });

        const result = await response.json();

        if (result.error) {
          alert(`Error: ${result.error}`);
        } else if (result.success) {
          // リネーム成功、ファイルリストをリロード
          await loadFileList(getCurrentDirParam());
        }
      } catch (err) {
        console.error('Failed to rename:', err);
        alert(`Failed to rename: ${err.message}`);
      }
    });
  }

  // ZIP Archive (フォルダのみ)
  if (allowArchive && file.type === 'directory') {
    addMenuItem('Create ZIP archive', async () => {
      if (!await showConfirmDialog(`Create ZIP archive of this folder?\n\n${file.name}\n\nThis may take some time for large folders.`)) {
        return;
      }

      try {
        const response = await fetch('/api/command/archive', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: file.path,
          }),
        });

        const result = await response.json();

        if (result.error) {
          alert(`Error: ${result.error}`);
        } else if (result.success) {
          alert(`Archive created: ${result.archiveName}`);
          // ファイルリストをリロード
          await loadFileList(getCurrentDirParam());
        }
      } catch (err) {
        console.error('Failed to archive:', err);
        alert(`Failed to archive: ${err.message}`);
      }
    });
  }

  if (allowRemove) {
    addMenuItem('Delete', async () => {
      const fileType = file.type === 'directory' ? 'folder' : 'file';
      if (!await showConfirmDialog(`Are you sure you want to delete this ${fileType}?\n\n${file.name}`, { destructive: true })) {
        return;
      }

      try {
        const response = await fetch('/api/command/remove', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: file.path,
          }),
        });

        const result = await response.json();

        if (result.error) {
          alert(`Error: ${result.error}`);
        } else {
          // 削除成功、ファイルリストをリロード
          await loadFileList(getCurrentDirParam());
        }
      } catch (err) {
        console.error('Failed to delete:', err);
        alert(`Failed to delete: ${err.message}`);
      }
    });
  }

  return menu;
}

function showContextMenu(x, y, file) {
  contextMenuFile = file;

  // 既存のメニューを削除
  const oldMenu = document.getElementById('context-menu');
  if (oldMenu) {
    oldMenu.remove();
  }

  // 新しいメニューを生成
  const menu = createContextMenu(file);
  document.body.appendChild(menu);

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.add('visible');

  // 画面外に出る場合の調整
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - rect.width - 5}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - rect.height - 5}px`;
  }
}

function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  menu.classList.remove('visible');
  contextMenuFile = null;
}

// ファイルサイズをフォーマット
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ファイル日付をフォーマット
function formatFileDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// ファイル種類の判定
function isImageFile(filename) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif'];
  const ext = filename.toLowerCase().split('.').pop();
  return imageExtensions.includes('.' + ext);
}

function isTextFile(filename) {
  const textExtensions = ['.txt', '.md', '.json', '.xml', '.log', '.csv', '.nfo'];
  const ext = filename.toLowerCase().split('.').pop();
  return textExtensions.includes('.' + ext);
}

function isPreviewableFile(filename) {
  return isImageFile(filename) || isTextFile(filename);
}

// プレビュー表示
async function showPreview(file) {
  const overlay = document.getElementById('preview-overlay');
  const content = document.getElementById('preview-content');

  content.innerHTML = '<p>Loading...</p>';
  overlay.classList.add('visible');

  try {
    const filePath = fixUrl(`/api/file/${encodeURIComponent(file.path)}`);

    if (isImageFile(file.name)) {
      const img = document.createElement('img');
      img.src = filePath;
      img.alt = file.name;
      content.innerHTML = '';
      content.appendChild(img);
    } else if (isTextFile(file.name)) {
      const response = await fetch(filePath);
      const text = await response.text();
      const pre = document.createElement('pre');
      pre.textContent = text;
      content.innerHTML = '';
      content.appendChild(pre);
    }
  } catch (err) {
    content.innerHTML = `<p>Error: ${err.message}</p>`;
  }
}

function hidePreview() {
  const overlay = document.getElementById('preview-overlay');
  overlay.classList.remove('visible');
}

// フォントサイズ(zoom)の初期化
let zoomLevel = 100;

function initZoom() {
  const savedZoom = localStorage.getItem('zoomLevel');
  if (savedZoom) {
    zoomLevel = parseInt(savedZoom);
  }
  applyZoom();
}

function applyZoom() {
  const container = document.querySelector('.container');
  if (container) {
    container.style.zoom = zoomLevel + '%';
  }
}

function changeZoom(delta) {
  zoomLevel = Math.max(50, Math.min(200, zoomLevel + delta));
  applyZoom();
  localStorage.setItem('zoomLevel', zoomLevel);
}

function resetZoom() {
  zoomLevel = 100;
  applyZoom();
  localStorage.setItem('zoomLevel', zoomLevel);
}

// テーマの初期化
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
  } else if (!prefersDark) {
    document.body.setAttribute('data-theme', 'light');
  }

  updateThemeIcon();
}

// テーマアイコンの更新
function updateThemeIcon() {
  const theme = document.body.getAttribute('data-theme');
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.textContent = theme === 'light' ? '🌙' : '☀️';
  }
}

// テーマ切り替え
function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon();
}

// メニューの表示/非表示
function toggleMenu() {
  const menu = document.getElementById('menu-popup');
  menu.classList.toggle('visible');
}

function hideMenu() {
  const menu = document.getElementById('menu-popup');
  menu.classList.remove('visible');
}

// 現在のディレクトリパラメータを取得
function getCurrentDirParam() {
  const hash = window.location.hash;
  return hash ? decodeURIComponent(hash.substring(1)) : null;
}

// ファイル一覧を取得して表示
async function loadFileList(dirPath = null) {
  const fileListDiv = document.getElementById('file-list');

  // ローディング表示
  fileListDiv.innerHTML = '<p>Loading...</p>';

  try {
    // API call: /api/dir with optional path
    const apiUrl = `/api/dir${dirPath ? `/${encodeURIComponent(dirPath)}` : ''}`;
    const response = await fetch(fixUrl(apiUrl));
    const data = await response.json();

    // Handle error response
    if (data.error) {
      throw new Error(data.error);
    }

    // Parse response: directory listing or root listing
    files = data.files;
    currentRootName = data.rootName || null;
    currentRelativePath = data.relativePath || '';
    allowRename = data.allowRename || false;
    allowRemove = data.allowRemove || false;
    allowArchive = data.allowArchive || false;
    disableGUI = data.disableGUI || false;

    // Update settings menu visibility
    const settingsMenu = document.getElementById('menu-settings');
    if (settingsMenu) {
      settingsMenu.style.display = disableGUI ? 'none' : '';
    }

    fileListDiv.innerHTML = '';

    if (files.length === 0) {
      fileListDiv.innerHTML = '<p>No files found.</p>';
      return;
    }

    // タイプ別にファイルを分類
    const filesByType = {
      directory: files.filter(f => f.type === 'directory'),
      book: files.filter(f => f.type === 'book'),
      video: files.filter(f => f.type === 'video'),
      audio: files.filter(f => f.type === 'audio'),
      file: files.filter(f => f.type === 'file')
    };

    // 表示順に並べた配列を作成（これがカーソル移動の順序になる）
    files = [...filesByType.directory, ...filesByType.book, ...filesByType.video, ...filesByType.audio, ...filesByType.file];

    let displayIndex = 0;

    // リスト表示のヘルパー関数
    const createListSection = (fileList) => {
      if (fileList.length === 0) return;

      const section = document.createElement('div');
      section.className = 'list-section';
      const ul = document.createElement('ul');
      ul.className = 'file-list-view';

      fileList.forEach((file) => {
        ul.appendChild(createListItem(file, displayIndex++));
      });

      section.appendChild(ul);
      fileListDiv.appendChild(section);
    };

    // タイル表示のヘルパー関数
    const createTileSection = (fileList) => {
      if (fileList.length === 0) return;

      const section = document.createElement('div');
      section.className = 'tile-section';

      fileList.forEach((file) => {
        section.appendChild(createTileItem(file, displayIndex++));
      });

      fileListDiv.appendChild(section);
    };

    // 各タイプのファイルを表示
    createListSection(filesByType.directory);
    createTileSection(filesByType.book);
    createListSection(filesByType.video);
    createListSection(filesByType.audio);
    createListSection(filesByType.file);

    // パンくずリストを更新
    updateBreadcrumb();

    // カーソル位置を復元
    // 1. sessionStorageから（ビューアから戻ってきた場合）
    const savedIndexSession = sessionStorage.getItem('fileListIndex');
    const savedPathSession = sessionStorage.getItem('fileListPath');
    // 2. localStorageから（リロードした場合）
    const storageKey = currentRootName ? `${currentRootName}/${currentRelativePath}` : '';
    const savedIndexLocal = localStorage.getItem(`fileList_index_${storageKey}`);

    if (savedIndexSession && savedPathSession === currentRelativePath) {
      currentIndex = parseInt(savedIndexSession);
      sessionStorage.removeItem('fileListIndex');
      sessionStorage.removeItem('fileListPath');
    } else if (savedIndexLocal !== null) {
      currentIndex = parseInt(savedIndexLocal);
    } else {
      currentIndex = 0;
    }

    updateSelection();
  } catch (err) {
    document.getElementById('file-list').innerHTML =
      `<p class="error">Error: ${err.message}</p>`;
  }
}

// リスト形式のアイテムを作成
function createListItem(file, index) {
  const li = document.createElement('li');

  // クラス名を設定（CSSでアイコンを表示）
  let className = file.type;
  if (file.type === 'file') {
    // ファイルタイプをさらに細分化
    if (isImageFile(file.name)) {
      className = 'image';
    } else if (isTextFile(file.name)) {
      className = 'text';
    }
  }
  li.className = className;
  li.dataset.index = index;

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'file-item-content';

  if (file.type === 'directory') {
    const link = document.createElement('a');
    link.href = fixUrl(`/#${encodeURIComponent(file.path)}`);
    link.textContent = file.name;
    contentWrapper.appendChild(link);
  } else if (file.type === 'video' || file.type === 'audio') {
    const link = document.createElement('a');
    link.href = fixUrl(`/media/#${encodeURIComponent(file.path)}`);
    link.textContent = file.name;
    link.addEventListener('click', (e) => {
      // リンククリック時もsessionStorageに保存
      sessionStorage.setItem('fileListIndex', index);
      sessionStorage.setItem('fileListPath', currentRelativePath);
      // 履歴に追加
      addToHistory(file);
    });
    contentWrapper.appendChild(link);
  } else if (isPreviewableFile(file.name)) {
    // プレビュー可能なファイルもリンクとして扱う
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = file.name;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showPreview(file);
    });
    contentWrapper.appendChild(link);
  } else {
    // その他のファイルはテキストのみ表示（アイコンはCSSで）
    const span = document.createElement('span');
    span.textContent = file.name;
    contentWrapper.appendChild(span);
  }

  li.appendChild(contentWrapper);

  li.addEventListener('click', (e) => {
    currentIndex = index;
    updateSelection(false);
    if (e.target.tagName !== 'A') {
      e.preventDefault();
    }
  });

  // 右クリックメニュー
  li.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, file);
  });

  return li;
}

// タイル形式のアイテムを作成
function createTileItem(file, index) {
  const tile = document.createElement('div');
  tile.className = 'tile-item';
  tile.dataset.index = index;

  const link = document.createElement('a');
  link.href = fixUrl(`/viewer/#${encodeURIComponent(file.path)}`);

  const thumbnail = document.createElement('img');
  thumbnail.className = 'tile-thumbnail';
  thumbnail.src = fixUrl(`/api/book/${encodeURIComponent(file.path)}/thumbnail`);
  thumbnail.alt = file.name;
  thumbnail.loading = 'lazy';

  const title = document.createElement('div');
  title.className = 'tile-title';
  title.textContent = file.name;

  link.appendChild(thumbnail);
  link.appendChild(title);
  tile.appendChild(link);

  // クリック時に履歴に追加
  link.addEventListener('click', (e) => {
    addToHistory(file);
  });

  tile.addEventListener('click', (e) => {
    currentIndex = index;
    updateSelection(false);
  });

  // 右クリックメニュー
  tile.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, file);
  });

  return tile;
}

// パンくずリストを更新
function updateBreadcrumb() {
  const breadcrumbDiv = document.getElementById('breadcrumb');
  const menuContainer = breadcrumbDiv.querySelector('.menu-container');

  breadcrumbDiv.innerHTML = '';

  const breadcrumbContent = document.createElement('div');
  breadcrumbContent.style.cssText = 'display:flex;align-items:center;gap:4px;flex:1;min-width:0;overflow:hidden';

  // パンくず要素を作成するヘルパー
  const addItem = (text, href = null, isCurrent = false) => {
    const elem = document.createElement(href ? 'a' : 'span');
    elem.textContent = text;
    elem.className = isCurrent ? 'breadcrumb-current' : 'breadcrumb-item';
    if (href) elem.href = href;
    breadcrumbContent.appendChild(elem);
  };

  const addSeparator = () => {
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-separator';
    sep.textContent = '›';
    breadcrumbContent.appendChild(sep);
  };

  // ホーム
  const homeLink = document.createElement('a');
  const homeImg = document.createElement('img');
  homeImg.src = 'favicon.svg';
  homeImg.alt = 'Home';
  homeImg.style.cssText = 'width:21x;height:21px;display:block';
  homeLink.appendChild(homeImg);
  homeLink.className = 'breadcrumb-item breadcrumb-home';
  homeLink.href = fixUrl('/');
  breadcrumbContent.appendChild(homeLink);

  if (currentRootName) {
    addSeparator();
    addItem(currentRootName, currentRelativePath ? `/#${encodeURIComponent(currentRootName)}` : null, !currentRelativePath);

    // 相対パスの各階層
    if (currentRelativePath) {
      const pathParts = currentRelativePath.split('/').filter(p => p);
      let accumulatedPath = currentRootName;

      pathParts.forEach((part, i) => {
        addSeparator();
        accumulatedPath += '/' + part;
        const isLast = i === pathParts.length - 1;
        addItem(part, isLast ? null : `/#${encodeURIComponent(accumulatedPath)}`, isLast);
      });
    }
  } else {
    // パンくずが空の時はタイトルを表示
    const titleSpan = document.createElement('span');
    titleSpan.className = 'breadcrumb-title';
    titleSpan.textContent = 'LiteComics';
    breadcrumbContent.appendChild(titleSpan);
  }

  breadcrumbDiv.appendChild(breadcrumbContent);
  breadcrumbDiv.appendChild(menuContainer);
}

// 選択状態を更新
function updateSelection(scroll = true) {
  const allItems = document.querySelectorAll('[data-index]');
  allItems.forEach((item) => {
    const index = parseInt(item.dataset.index);
    if (index === currentIndex) {
      item.classList.add('selected');
      if (scroll) {
        item.scrollIntoView({ block: 'center' });
      }
    } else {
      item.classList.remove('selected');
    }
  });

  // カーソル位置をlocalStorageに保存
  const storageKey = currentRootName ? `${currentRootName}/${currentRelativePath}` : '';
  localStorage.setItem(`fileList_index_${storageKey}`, currentIndex);
}

// 選択中のアイテムを開く
function openSelected() {
  if (currentIndex < 0 || currentIndex >= files.length) return;
  document.querySelector(`[data-index="${currentIndex}"]`)?.querySelector('a')?.click();
}

// キーボードイベントハンドラ
document.addEventListener('keydown', async (e) => {
  // ダイアログが開いている場合は何もしない
  const confirmDialog = document.getElementById('confirm-dialog');
  const promptDialog = document.getElementById('prompt-dialog');
  if ((confirmDialog && confirmDialog.classList.contains('visible')) ||
    (promptDialog && promptDialog.classList.contains('visible'))) {
    return;
  }

  // オーバーレイが開いている場合の共通処理
  const checkAndCloseOverlays = () => {
    const historyOverlay = document.getElementById('history-overlay');
    if (historyOverlay.classList.contains('visible')) {
      hideHistoryOverlay();
      return true;
    }
    const overlay = document.getElementById('preview-overlay');
    if (overlay.classList.contains('visible')) {
      hidePreview();
      return true;
    }
    return false;
  };

  // タイル表示の列数を計算
  const getTileColumnsPerRow = () => {
    const tileSection = document.querySelector('.tile-section');
    if (!tileSection || files[currentIndex]?.type !== 'book') {
      return 0;
    }
    const tiles = tileSection.querySelectorAll('[data-index]');
    if (tiles.length === 0) return 0;

    const firstTile = tiles[0];
    const tileWidth = firstTile.offsetWidth;
    const sectionWidth = tileSection.offsetWidth;
    const gap = 16; // grid gap
    return Math.floor((sectionWidth + gap) / (tileWidth + gap));
  };

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      // タイル表示の場合は列数分移動
      const columnsPerRow = getTileColumnsPerRow();
      if (columnsPerRow > 0) {
        const nextIndex = currentIndex + columnsPerRow;
        if (nextIndex < files.length) {
          currentIndex = nextIndex;
          updateSelection();
          break;
        }
      }
      // リスト表示または最後の行の場合は1つ下に移動
      if (currentIndex < files.length - 1) {
        currentIndex++;
        updateSelection();
      }
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (currentIndex < files.length - 1) {
        currentIndex++;
        updateSelection();
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      // タイル表示の場合は列数分移動
      const columnsPerRowUp = getTileColumnsPerRow();
      if (columnsPerRowUp > 0) {
        const prevIndex = currentIndex - columnsPerRowUp;
        if (prevIndex >= 0) {
          currentIndex = prevIndex;
          updateSelection();
          break;
        }
      }
      // リスト表示または最初の行の場合は1つ上に移動
      if (currentIndex > 0) {
        currentIndex--;
        updateSelection();
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (currentIndex > 0) {
        currentIndex--;
        updateSelection();
      }
      break;
    case 'PageDown':
      e.preventDefault();
      // 10件下に移動
      currentIndex = Math.min(currentIndex + 10, files.length - 1);
      updateSelection();
      break;
    case 'PageUp':
      e.preventDefault();
      // 10件上に移動
      currentIndex = Math.max(currentIndex - 10, 0);
      updateSelection();
      break;
    case 'Enter':
      e.preventDefault();
      openSelected();
      break;
    case 'Escape':
      e.preventDefault();
      // オーバーレイを閉じる
      if (checkAndCloseOverlays()) {
        break;
      }
      // ルートレベルでは何もしない
      if (!currentRootName && !currentRelativePath) {
        break;
      }
      // localStorageの位置をクリア（戻る操作時）
      const storageKey = currentRootName ? `${currentRootName}/${currentRelativePath}` : '';
      localStorage.removeItem(`fileList_index_${storageKey}`);
      history.back();
      break;
    case 'Backspace':
      e.preventDefault();
      // オーバーレイを閉じる
      if (checkAndCloseOverlays()) {
        break;
      }
      // ルートレベルでは何もしない
      if (!currentRootName && !currentRelativePath) {
        break;
      }
      // 一つ上のフォルダに移動
      if (currentRelativePath) {
        // 相対パスがある場合は、一つ上の階層へ
        const pathParts = currentRelativePath.split('/').filter(p => p);
        pathParts.pop();
        const parentPath = pathParts.length > 0
          ? `${currentRootName}/${pathParts.join('/')}`
          : currentRootName;
        window.location.hash = `#${encodeURIComponent(parentPath)}`;
      } else if (currentRootName) {
        // ルート名のみの場合は、ルート一覧に戻る
        window.location.hash = '';
      }
      break;
  }
});

// ページ読み込み時にファイル一覧を取得
initTheme();
initZoom();

document.getElementById('menu-button').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMenu();
});
document.getElementById('menu-history').addEventListener('click', () => {
  hideMenu();
  showHistoryOverlay();
});
document.getElementById('menu-settings').addEventListener('click', () => {
  hideMenu();
  window.location.href = fixUrl('/settings/');
});
document.getElementById('history-close').addEventListener('click', hideHistoryOverlay);
document.getElementById('history-clear').addEventListener('click', clearHistory);
document.getElementById('menu-theme').addEventListener('click', toggleTheme);
document.getElementById('font-size-decrease').addEventListener('click', () => changeZoom(-10));
document.getElementById('font-size-reset').addEventListener('click', resetZoom);
document.getElementById('font-size-increase').addEventListener('click', () => changeZoom(10));
document.getElementById('preview-close').addEventListener('click', hidePreview);
document.getElementById('preview-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'preview-overlay') {
    hidePreview();
  }
});
document.getElementById('history-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'history-overlay') {
    hideHistoryOverlay();
  }
});

// 右クリックメニューを閉じる（Escキー）
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideContextMenu();
  }
});

// メニュー外クリックで閉じる
document.addEventListener('click', (e) => {
  const menu = document.getElementById('menu-popup');
  const button = document.getElementById('menu-button');
  if (!menu.contains(e.target) && e.target !== button) {
    hideMenu();
  }
  // コンテキストメニューを閉じる
  hideContextMenu();
});

loadFileList(getCurrentDirParam());

// ハッシュ変更時の処理
window.addEventListener('hashchange', () => {
  loadFileList(getCurrentDirParam());
});
