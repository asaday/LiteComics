
// demo URLを生成
function fixUrl(path) {
  const pathParts = window.location.pathname.split('/');
  const demoIndex = pathParts.indexOf('__demo__');
  if (demoIndex === -1) {
    // Keep the right-hand file list inside its iframe while navigating folders.
    if (new URLSearchParams(window.location.search).has('embedded')) {
      if (path === '/') return '/?embedded=1';
      if (path.startsWith('/#')) return `/?embedded=1${path.substring(1)}`;
    }
    return path;
  }
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
let allowFileOperations = false;
let allowUpload = false;
let disableGUI = false;

const TRANSFER_MIME = 'application/x-litecomics-item';
const TRANSFER_TEXT_PREFIX = 'litecomics-transfer:';
const transferChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('litecomics-transfer')
  : null;
const TWO_PANE_KEY = 'fileList_twoPane';
const SECOND_PANE_PATH_KEY = 'fileList_secondPanePath';
const isEmbeddedPane = new URLSearchParams(window.location.search).has('embedded');

if (transferChannel) {
  transferChannel.addEventListener('message', () => {
    loadFileList(getCurrentDirParam());
  });
}

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
    okBtn.textContent = options.confirmLabel || 'OK';

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
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        cancelBtn.focus();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        okBtn.focus();
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

function showTransferDialog(sourceName, destinationName) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('transfer-dialog');
    const messageDiv = dialog.querySelector('.transfer-dialog-message');
    const copyBtn = dialog.querySelector('.transfer-dialog-copy');
    const moveBtn = dialog.querySelector('.transfer-dialog-move');
    const cancelBtn = dialog.querySelector('.transfer-dialog-cancel');

    messageDiv.textContent = `Transfer “${sourceName}” to “${destinationName}”`;
    dialog.classList.add('visible');
    setTimeout(() => cancelBtn.focus(), 0);

    const finish = (operation) => {
      cleanup();
      resolve(operation);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(null);
      }
    };
    const handleCopy = () => finish('copy');
    const handleMove = () => finish('move');
    const handleCancel = () => finish(null);
    const cleanup = () => {
      dialog.classList.remove('visible');
      copyBtn.removeEventListener('click', handleCopy);
      moveBtn.removeEventListener('click', handleMove);
      cancelBtn.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeyDown);
    };

    copyBtn.addEventListener('click', handleCopy);
    moveBtn.addEventListener('click', handleMove);
    cancelBtn.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeyDown);
  });
}

function showTransferProgress(operation, sourceName) {
  const dialog = document.getElementById('transfer-dialog');
  dialog.querySelector('.transfer-dialog-message').textContent =
    `${operation === 'copy' ? 'Copying' : 'Moving'} “${sourceName}”…`;
  dialog.querySelector('.transfer-dialog-buttons').classList.add('hidden');
  dialog.classList.add('visible');
}

function hideTransferProgress() {
  const dialog = document.getElementById('transfer-dialog');
  dialog.classList.remove('visible');
  dialog.querySelector('.transfer-dialog-buttons').classList.remove('hidden');
}

function showUploadDialog(itemCount, destinationName) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('upload-dialog');
    const message = dialog.querySelector('.upload-dialog-message');
    const uploadBtn = dialog.querySelector('.upload-dialog-upload');
    const cancelBtn = dialog.querySelector('.upload-dialog-cancel');

    message.textContent = `Upload ${itemCount} item${itemCount === 1 ? '' : 's'} to “${destinationName}”?`;
    dialog.classList.add('visible');
    setTimeout(() => cancelBtn.focus(), 0);

    const finish = (confirmed) => {
      cleanup();
      resolve(confirmed);
    };
    const handleUpload = () => finish(true);
    const handleCancel = () => finish(false);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      }
    };
    const cleanup = () => {
      dialog.classList.remove('visible');
      uploadBtn.removeEventListener('click', handleUpload);
      cancelBtn.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeyDown);
    };

    uploadBtn.addEventListener('click', handleUpload);
    cancelBtn.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeyDown);
  });
}

function showUploadProgress(percent) {
  const dialog = document.getElementById('upload-dialog');
  const progress = dialog.querySelector('.upload-progress');
  dialog.querySelector('.upload-dialog-message').textContent = `Uploading… ${percent}%`;
  dialog.querySelector('.upload-dialog-buttons').classList.add('hidden');
  progress.hidden = false;
  progress.querySelector('.upload-progress-bar').style.width = `${percent}%`;
  dialog.classList.add('visible');
}

function hideUploadProgress() {
  const dialog = document.getElementById('upload-dialog');
  dialog.classList.remove('visible');
  dialog.querySelector('.upload-dialog-buttons').classList.remove('hidden');
  dialog.querySelector('.upload-progress').hidden = true;
}

function currentDirectoryPath() {
  if (!currentRootName) return null;
  return currentRelativePath ? `${currentRootName}/${currentRelativePath}` : currentRootName;
}

function setupDraggableItem(element, file) {
  if (!allowFileOperations || !currentRootName) return;
  element.draggable = true;
  element.addEventListener('dragstart', (e) => {
    const payload = JSON.stringify({ path: file.path, name: file.name });

    // Links and images have native URL drag data. Remove it so dropping in
    // another LiteComics window cannot navigate to the dragged URL.
    e.dataTransfer.clearData();
    e.dataTransfer.setData(TRANSFER_MIME, payload);
    e.dataTransfer.setData('text/plain', TRANSFER_TEXT_PREFIX + payload);
    e.dataTransfer.effectAllowed = 'copyMove';
    element.classList.add('dragging');
  });
  element.addEventListener('dragend', () => {
    element.classList.remove('dragging');
    document.querySelectorAll('.drop-target').forEach(item => item.classList.remove('drop-target'));
  });
}

function hasLiteComicsDrag(dataTransfer) {
  const types = Array.from(dataTransfer?.types || []);
  return types.includes(TRANSFER_MIME) || types.includes('text/plain');
}

function hasLocalFiles(dataTransfer) {
  return Array.from(dataTransfer?.types || []).includes('Files');
}

function setupCurrentDirectoryDropTarget(element) {
  element.addEventListener('dragover', (e) => {
    const localUpload = hasLocalFiles(e.dataTransfer);
    const allowed = localUpload ? allowUpload : (allowFileOperations && hasLiteComicsDrag(e.dataTransfer));
    if (!allowed || !currentDirectoryPath()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    element.classList.add('drop-target');
  });
  element.addEventListener('dragleave', (e) => {
    if (!element.contains(e.relatedTarget)) element.classList.remove('drop-target');
  });
  element.addEventListener('drop', async (e) => {
    const localUpload = hasLocalFiles(e.dataTransfer);
    const allowed = localUpload ? allowUpload : (allowFileOperations && hasLiteComicsDrag(e.dataTransfer));
    if (!allowed || !currentDirectoryPath()) return;
    e.preventDefault();
    element.classList.remove('drop-target');
    const destinationName = currentRelativePath
      ? currentRelativePath.split('/').filter(Boolean).pop()
      : currentRootName;
    if (localUpload) {
      try {
        const upload = await collectLocalDrop(e.dataTransfer);
        await handleLocalUpload(upload, currentDirectoryPath(), destinationName);
      } catch (err) {
        console.error('Failed to prepare upload:', err);
        alert(`Failed to prepare upload: ${err.message}`);
      }
    } else {
      await handleItemDrop(e.dataTransfer, currentDirectoryPath(), destinationName);
    }
  });
}

async function collectLocalDrop(dataTransfer) {
  const upload = { files: [], directories: [] };
  const items = Array.from(dataTransfer.items || []).filter(item => item.kind === 'file');

  if (items.length > 0) {
    for (const item of items) {
      const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
      if (entry) {
        await collectFileSystemEntry(entry, upload);
      } else {
        const file = item.getAsFile();
        if (file) upload.files.push({ file, path: file.name });
      }
    }
  } else {
    for (const file of Array.from(dataTransfer.files || [])) {
      upload.files.push({ file, path: file.webkitRelativePath || file.name });
    }
  }

  upload.directories = [...new Set(upload.directories)];
  if (upload.files.length === 0 && upload.directories.length === 0) {
    throw new Error('No readable files or folders were dropped');
  }
  return upload;
}

async function collectFileSystemEntry(entry, upload) {
  const relativePath = entry.fullPath.replace(/^\/+/, '');
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    upload.files.push({ file, path: relativePath || file.name });
    return;
  }
  if (!entry.isDirectory) return;

  upload.directories.push(relativePath);
  const reader = entry.createReader();
  while (true) {
    const entries = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (entries.length === 0) break;
    for (const child of entries) {
      await collectFileSystemEntry(child, upload);
    }
  }
}

async function handleLocalUpload(upload, destinationPath, destinationName) {
  const topLevelItems = new Set([
    ...upload.files.map(item => item.path.split('/')[0]),
    ...upload.directories.map(directory => directory.split('/')[0]),
  ]);
  if (!await showUploadDialog(topLevelItems.size, destinationName)) return;

  const formData = new FormData();
  formData.append('destination', destinationPath);
  formData.append('directories', JSON.stringify(upload.directories));
  for (const item of upload.files) {
    formData.append('paths', item.path);
    formData.append('files', item.file, item.file.name);
  }

  showUploadProgress(0);
  try {
    const result = await uploadFormData(formData, percent => showUploadProgress(percent));
    if (result.error) throw new Error(result.error);
    await loadFileList(getCurrentDirParam());
    transferChannel?.postMessage({ operation: 'upload', destination: destinationPath });
  } catch (err) {
    console.error('Upload failed:', err);
    alert(`Upload failed: ${err.message}`);
  } finally {
    hideUploadProgress();
  }
}

function uploadFormData(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/command/upload');
    request.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    request.addEventListener('load', () => {
      let result;
      try {
        result = JSON.parse(request.responseText);
      } catch {
        reject(new Error(`HTTP ${request.status}`));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(result.error || `HTTP ${request.status}`));
        return;
      }
      resolve(result);
    });
    request.addEventListener('error', () => reject(new Error('Network error')));
    request.addEventListener('abort', () => reject(new Error('Upload cancelled')));
    request.send(formData);
  });
}

async function handleItemDrop(dataTransfer, destinationPath, destinationName) {
  let item;
  try {
    let payload = dataTransfer.getData(TRANSFER_MIME);
    if (!payload) {
      const plainText = dataTransfer.getData('text/plain');
      if (!plainText.startsWith(TRANSFER_TEXT_PREFIX)) return;
      payload = plainText.substring(TRANSFER_TEXT_PREFIX.length);
    }
    item = JSON.parse(payload);
  } catch (err) {
    console.error('Invalid drag data:', err);
    return;
  }
  if (!item?.path || !item?.name) return;

  const operation = await showTransferDialog(item.name, destinationName);
  if (!operation) return;

  await transferItem(item, destinationPath, operation);
}

async function transferItem(item, destinationPath, operation) {
  showTransferProgress(operation, item.name);
  try {
    const response = await fetch('/api/command/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: item.path, destination: destinationPath, operation }),
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    await loadFileList(getCurrentDirParam());
    transferChannel?.postMessage({ operation, source: item.path, destination: destinationPath });
  } catch (err) {
    console.error(`Failed to ${operation}:`, err);
    alert(`Failed to ${operation}: ${err.message}`);
  } finally {
    hideTransferProgress();
  }
}

function getOtherPaneWindow() {
  if (isEmbeddedPane) {
    return window.parent !== window && window.parent.document.body.classList.contains('two-pane')
      ? window.parent
      : null;
  }
  return document.querySelector('.second-pane')?.contentWindow || null;
}

function focusOtherPane() {
  const otherPane = getOtherPaneWindow();
  if (!otherPane) return false;
  otherPane.document.getElementById('file-list')?.focus();
  return true;
}

function canAcceptKeyboardTransfer() {
  return allowFileOperations && Boolean(currentDirectoryPath());
}

async function transferSelectedToOtherPane(operation) {
  const item = files[currentIndex];
  const otherPane = getOtherPaneWindow();
  if (!item || !allowFileOperations || !otherPane || !otherPane.canAcceptKeyboardTransfer()) return;

  const destinationPath = otherPane.currentDirectoryPath();
  if (item.path === destinationPath || destinationPath.startsWith(`${item.path}/`)) {
    alert('A folder cannot be transferred into itself');
    return;
  }
  await transferItem({ path: item.path, name: item.name }, destinationPath, operation);
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

function showKeyboardHelp() {
  hideMenu();
  document.getElementById('keyboard-help-overlay').classList.add('visible');
  setTimeout(() => document.getElementById('keyboard-help-close').focus(), 0);
}

function hideKeyboardHelp() {
  document.getElementById('keyboard-help-overlay').classList.remove('visible');
  document.getElementById('file-list').focus({ preventScroll: true });
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

async function renameFile(file) {
  if (!allowFileOperations || !file) return;
  const newName = await showPromptDialog('Enter new name:', file.name);
  if (!newName || newName === file.name) return;

  try {
    const response = await fetch('/api/command/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: file.path, newName }),
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    await loadFileList(getCurrentDirParam());
  } catch (err) {
    console.error('Failed to rename:', err);
    alert(`Failed to rename: ${err.message}`);
  }
}

async function createFolder() {
  const destinationPath = currentDirectoryPath();
  if (!allowFileOperations || !destinationPath) return;
  const name = await showPromptDialog('Enter new folder name:');
  if (!name) return;

  try {
    const response = await fetch('/api/command/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: destinationPath, name }),
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    await loadFileList(getCurrentDirParam());
    transferChannel?.postMessage({ operation: 'mkdir', destination: destinationPath });
  } catch (err) {
    console.error('Failed to create folder:', err);
    alert(`Failed to create folder: ${err.message}`);
  }
}

async function deleteFile(file) {
  if (!allowFileOperations || !file) return;
  const fileType = file.type === 'directory' ? 'folder' : 'file';
  if (!await showConfirmDialog(`Are you sure you want to delete this ${fileType}?\n\n${file.name}`, {
    destructive: true,
    confirmLabel: 'Delete',
  })) return;

  try {
    const response = await fetch('/api/command/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: file.path }),
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    await loadFileList(getCurrentDirParam());
  } catch (err) {
    console.error('Failed to delete:', err);
    alert(`Failed to delete: ${err.message}`);
  }
}

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
  if (allowFileOperations) {
    addMenuItem('Rename', () => renameFile(file));
  }

  // ZIP Archive (フォルダのみ)
  if (allowFileOperations && file.type === 'directory') {
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

  if (allowFileOperations) {
    addMenuItem('Delete', () => deleteFile(file));
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
  if (menu) menu.classList.remove('visible');
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

function createEmbeddedPaneUrl(path) {
  const url = new URL(window.location.href);
  url.searchParams.set('embedded', '1');
  url.hash = path ? `#${encodeURIComponent(path)}` : '';
  return url.href;
}

function rememberSecondPanePath(frame) {
  try {
    const hash = frame.contentWindow.location.hash;
    const path = hash ? decodeURIComponent(hash.substring(1)) : '';
    localStorage.setItem(SECOND_PANE_PATH_KEY, path);
  } catch (err) {
    console.warn('Failed to remember second pane path:', err);
  }
}

function updateTwoPaneMenu() {
  const item = document.getElementById('menu-two-pane');
  if (isEmbeddedPane) {
    item.hidden = true;
    return;
  }

  const enabled = document.body.classList.contains('two-pane');
  document.getElementById('two-pane-icon').textContent = enabled ? '◧' : '◫';
  document.getElementById('two-pane-label').textContent = enabled ? 'Single Pane' : 'Two Panes';
}

function enableTwoPane() {
  if (isEmbeddedPane || document.querySelector('.second-pane')) return;

  const savedPath = localStorage.getItem(SECOND_PANE_PATH_KEY);
  const frame = document.createElement('iframe');
  frame.className = 'second-pane';
  frame.title = 'Second file pane';
  frame.src = createEmbeddedPaneUrl(savedPath === null ? getCurrentDirParam() : savedPath);
  frame.addEventListener('load', () => {
    rememberSecondPanePath(frame);
    try {
      frame.contentWindow.addEventListener('hashchange', () => rememberSecondPanePath(frame));
    } catch (err) {
      console.warn('Failed to watch second pane navigation:', err);
    }
  });
  document.body.appendChild(frame);
  document.body.classList.add('two-pane');
  localStorage.setItem(TWO_PANE_KEY, 'true');
  updateTwoPaneMenu();
}

function disableTwoPane() {
  document.querySelector('.second-pane')?.remove();
  document.body.classList.remove('two-pane');
  localStorage.setItem(TWO_PANE_KEY, 'false');
  updateTwoPaneMenu();
}

function toggleTwoPane() {
  hideMenu();
  if (document.body.classList.contains('two-pane')) {
    disableTwoPane();
  } else {
    enableTwoPane();
  }
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
    allowFileOperations = data.allowFileOperations || false;
    allowUpload = data.allowUpload || false;
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

  // Always disable native link/image dragging. When transfers are enabled,
  // the draggable parent row handles the gesture instead.
  contentWrapper.querySelectorAll('a, img').forEach(child => {
    child.draggable = false;
  });

  setupDraggableItem(li, file);

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
  link.draggable = false;

  const thumbnail = document.createElement('img');
  thumbnail.className = 'tile-thumbnail';
  thumbnail.src = fixUrl(`/api/book/${encodeURIComponent(file.path)}/thumbnail`);
  thumbnail.alt = file.name;
  thumbnail.loading = 'lazy';
  thumbnail.draggable = false;

  const title = document.createElement('div');
  title.className = 'tile-title';
  title.textContent = file.name;

  link.appendChild(thumbnail);
  link.appendChild(title);
  tile.appendChild(link);

  setupDraggableItem(tile, file);

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
  if (e.target.matches('input, textarea, select, [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) {
    return;
  }

  const keyboardHelp = document.getElementById('keyboard-help-overlay');
  if (keyboardHelp.classList.contains('visible')) {
    e.preventDefault();
    if (e.key === 'Escape') hideKeyboardHelp();
    return;
  }

  // ダイアログが開いている場合は何もしない
  const confirmDialog = document.getElementById('confirm-dialog');
  const promptDialog = document.getElementById('prompt-dialog');
  const transferDialog = document.getElementById('transfer-dialog');
  const uploadDialog = document.getElementById('upload-dialog');
  if ((confirmDialog && confirmDialog.classList.contains('visible')) ||
    (promptDialog && promptDialog.classList.contains('visible')) ||
    (transferDialog && transferDialog.classList.contains('visible')) ||
    (uploadDialog && uploadDialog.classList.contains('visible'))) {
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
      if (getOtherPaneWindow()) {
        if (currentIndex < files.length - 1) {
          currentIndex++;
          updateSelection();
        }
        break;
      }
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
      if (!focusOtherPane() && currentIndex < files.length - 1) {
        currentIndex++;
        updateSelection();
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (getOtherPaneWindow()) {
        if (currentIndex > 0) {
          currentIndex--;
          updateSelection();
        }
        break;
      }
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
      if (!focusOtherPane() && currentIndex > 0) {
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
    case 'c':
    case 'C':
      if (e.repeat) break;
      e.preventDefault();
      await transferSelectedToOtherPane('copy');
      break;
    case 'm':
    case 'M':
      if (e.repeat) break;
      e.preventDefault();
      await transferSelectedToOtherPane('move');
      break;
    case 'r':
    case 'R':
      if (e.repeat) break;
      e.preventDefault();
      await renameFile(files[currentIndex]);
      break;
    case 'n':
    case 'N':
      if (e.repeat) break;
      e.preventDefault();
      await createFolder();
      break;
    case 'd':
    case 'D':
      if (e.repeat) break;
      e.preventDefault();
      await deleteFile(files[currentIndex]);
      break;
    case 'w':
    case 'W':
      if (e.repeat) break;
      e.preventDefault();
      if (isEmbeddedPane) {
        window.parent.toggleTwoPane();
      } else {
        toggleTwoPane();
      }
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
document.body.classList.toggle('embedded-pane', isEmbeddedPane);
setupCurrentDirectoryDropTarget(document.getElementById('file-list'));
updateTwoPaneMenu();
if (!isEmbeddedPane && localStorage.getItem(TWO_PANE_KEY) === 'true') {
  enableTwoPane();
}

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
document.getElementById('menu-two-pane').addEventListener('click', toggleTwoPane);
document.getElementById('menu-keyboard-help').addEventListener('click', showKeyboardHelp);
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
document.getElementById('keyboard-help-close').addEventListener('click', hideKeyboardHelp);
document.getElementById('keyboard-help-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'keyboard-help-overlay') hideKeyboardHelp();
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
