// ============================================================================
// ユーティリティ関数
// ============================================================================

// demo API URLを生成
function fixUrl(path) {
  const pathParts = window.location.pathname.split('/');
  const demoIndex = pathParts.indexOf('__demo__');
  if (demoIndex === -1) return path;
  const demoPrefix = pathParts.slice(0, demoIndex + 1).join('/');

  if (path.match(/^\/api\/book\/.*\/list$/))
    return `${demoPrefix}/../__data__/list.json`;

  const imageMatch = path.match(/^\/api\/book\/[^\/]+\/image\/(\d+)$/);
  if (imageMatch)
    return `${demoPrefix}/../__data__/image/${imageMatch[1]}.webp`;
  return path;
}

// ビューアの状態管理
let currentFile = '';
let images = [];
let imageCount = 0; // 画像数
let currentPage = 0; // 表示開始ページのインデックス
let offset = 0; // 配置修正用のオフセット
let imageCache = {}; // 画像のキャッシュ
let forceSinglePageMode = false; // 強制1ページモード
let readingDirection = 'rtl'; // 読み方向: 'rtl' (right-to-left) or 'ltr' (left-to-right)
let pageInfoTimer = null; // ページ情報の自動非表示タイマー

// ============================================================================
// localStorage管理
// ============================================================================

const MAX_FILE_HISTORY = 512; // 保持する最大ファイル数
const HISTORY_KEY = 'viewer_file_history'; // 履歴管理用キー

// ファイル履歴を取得
function getFileHistory() {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (e) {
    console.error('Failed to load file history:', e);
    return [];
  }
}

// ファイル履歴を保存
function saveFileHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save file history:', e);
  }
}

// 古いファイルのデータを削除
function cleanupOldFiles(currentFile) {
  const history = getFileHistory();

  // 現在のファイルを履歴に追加（重複は削除）
  const filteredHistory = history.filter(f => f !== currentFile);
  filteredHistory.unshift(currentFile);

  // MAX_FILE_HISTORYを超えた分を削除
  if (filteredHistory.length > MAX_FILE_HISTORY) {
    const removedFiles = filteredHistory.slice(MAX_FILE_HISTORY);

    // 削除対象のファイルのlocalStorageエントリを削除
    removedFiles.forEach(file => {
      localStorage.removeItem(`viewer_page_${file}`);
      localStorage.removeItem(`viewer_offset_${file}`);
      localStorage.removeItem(`viewer_direction_${file}`);
    });

    // 履歴を更新
    saveFileHistory(filteredHistory.slice(0, MAX_FILE_HISTORY));
  } else {
    saveFileHistory(filteredHistory);
  }
}

// ============================================================================
// UI表示/非表示
// ============================================================================

// ページ一覧サイドバーの表示/非表示
let sidebarVisible = false;

function showPageSidebar() {
  const sidebar = document.getElementById('page-sidebar');
  if (sidebar) {
    sidebar.classList.add('visible');
    sidebarVisible = true;
  }
}

function hidePageSidebar() {
  const sidebar = document.getElementById('page-sidebar');
  if (sidebar) {
    sidebar.classList.remove('visible');
    sidebarVisible = false;
  }
}

function togglePageSidebar() {
  // 常に表示する（閉じるのは×ボタンのみ）
  showPageSidebar();
  generateDirectoryList();
  generatePageList();
}

// ============================================================================
// ディレクトリ/ページリスト生成
// ============================================================================

// ディレクトリ構造を抽出（共通処理）
function extractDirectories() {
  const directories = new Map(); // ディレクトリパス -> 最初のファイルのインデックス

  images.forEach((imagePath, index) => {
    const parts = imagePath.split('/');
    if (parts.length <= 1) return; // ディレクトリがない場合はスキップ

    const dirPath = parts.slice(0, -1).join('/');
    if (!directories.has(dirPath)) {
      directories.set(dirPath, index);
    }
  });

  return directories;
}

// ディレクトリリストを生成
function generateDirectoryList() {
  const directoryList = document.getElementById('directory-list');
  if (!directoryList || imageCount === 0) return;

  directoryList.innerHTML = '';

  const directories = extractDirectories();
  if (directories.size === 0) return;

  directories.forEach((firstIndex, dirPath) => {
    const dirItem = document.createElement('div');
    dirItem.className = 'directory-item';

    const dirIcon = document.createElement('span');
    dirIcon.className = 'page-number';
    dirIcon.textContent = '📁 ';

    const dirName = document.createElement('span');
    dirName.className = 'file-name';
    dirName.textContent = dirPath;

    dirItem.appendChild(dirIcon);
    dirItem.appendChild(dirName);

    dirItem.addEventListener('click', () => {
      currentPage = firstIndex;
      displayCurrentPages();
    });

    directoryList.appendChild(dirItem);
  });
}

// ページ一覧を生成
function generatePageList() {
  const pageList = document.getElementById('page-list');
  if (!pageList || imageCount === 0) return;

  pageList.innerHTML = '';

  for (let index = 0; index < imageCount; index++) {
    const pageItem = document.createElement('div');
    pageItem.className = 'page-item';
    if (index === currentPage) {
      pageItem.classList.add('current');
    }

    const pageNumber = document.createElement('span');
    pageNumber.className = 'page-number';
    pageNumber.textContent = `${index + 1}. `;

    const fileName = document.createElement('span');
    fileName.className = 'file-name';
    fileName.textContent = images[index] || `Page ${index + 1}`;

    pageItem.appendChild(pageNumber);
    pageItem.appendChild(fileName);

    pageItem.addEventListener('click', () => {
      currentPage = index;
      displayCurrentPages();
    });

    pageList.appendChild(pageItem);
  }
}

// ページ一覧オーバーレイの表示/非表示
function showPageOverlay() {
  const overlay = document.getElementById('page-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    generateDirectoryGrid();
    generatePageGrid();
  }
}

function hidePageOverlay() {
  const overlay = document.getElementById('page-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// ディレクトリグリッドを生成
function generateDirectoryGrid() {
  const gridContainer = document.getElementById('directory-grid');
  if (!gridContainer || imageCount === 0) return;

  gridContainer.innerHTML = '';

  const directories = extractDirectories();
  if (directories.size === 0) return;

  directories.forEach((firstIndex, dirPath) => {
    const gridItem = document.createElement('div');
    gridItem.className = 'directory-grid-item';

    const thumbnail = document.createElement('img');
    thumbnail.className = 'directory-grid-thumbnail';
    thumbnail.src = fixUrl(`/api/book/${encodeURIComponent(currentFile)}/image/${firstIndex}`);
    thumbnail.alt = dirPath;
    thumbnail.loading = 'lazy';

    const dirName = document.createElement('div');
    dirName.className = 'directory-grid-name';
    dirName.textContent = dirPath;

    gridItem.appendChild(thumbnail);
    gridItem.appendChild(dirName);

    gridItem.addEventListener('click', () => {
      currentPage = firstIndex;
      displayCurrentPages();
      hidePageOverlay();
    });

    gridContainer.appendChild(gridItem);
  });
}

// ページ一覧グリッドを生成
function generatePageGrid() {
  const gridContainer = document.getElementById('page-grid');
  if (!gridContainer || imageCount === 0) return;

  gridContainer.innerHTML = '';

  for (let index = 0; index < imageCount; index++) {
    const gridItem = document.createElement('div');
    gridItem.className = 'page-grid-item';
    if (index === currentPage) {
      gridItem.classList.add('current');
    }

    const thumbnail = document.createElement('img');
    thumbnail.className = 'page-grid-thumbnail';
    thumbnail.src = fixUrl(`/api/book/${encodeURIComponent(currentFile)}/image/${index}`);
    thumbnail.alt = `Page ${index + 1}`;
    thumbnail.loading = 'lazy';

    const pageNumber = document.createElement('div');
    pageNumber.className = 'page-grid-number';
    pageNumber.textContent = index + 1;

    gridItem.appendChild(thumbnail);
    gridItem.appendChild(pageNumber);

    gridItem.addEventListener('click', () => {
      currentPage = index;
      displayCurrentPages();
      hidePageOverlay();
    });

    gridContainer.appendChild(gridItem);
  }
}

// ローディング表示/非表示
function showLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.classList.remove('hidden');
}

function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('hidden');
}

// ページ情報の表示/非表示
function showPageInfo(autoHide = false, duration = 1000) {
  const pageInfo = document.getElementById('page-info');
  if (pageInfo) {
    pageInfo.style.opacity = '1';

    // 既存のタイマーをクリア
    if (pageInfoTimer) {
      clearTimeout(pageInfoTimer);
      pageInfoTimer = null;
    }

    // autoHideがtrueの場合のみ自動非表示
    if (autoHide) {
      pageInfoTimer = setTimeout(() => {
        pageInfo.style.opacity = '0';
      }, duration);
    }
  }
}

function hidePageInfo() {
  const pageInfo = document.getElementById('page-info');
  if (pageInfo) {
    pageInfo.style.opacity = '0';
    if (pageInfoTimer) {
      clearTimeout(pageInfoTimer);
      pageInfoTimer = null;
    }
  }
}

// URLパラメータからファイル名を取得
function getFileFromURL() {
  // #rootName/path/to/file.cbz 形式を解析
  const hash = window.location.hash;
  if (hash && hash.length > 1) {
    const fullPath = decodeURIComponent(hash.substring(1));
    const pathParts = fullPath.split('/').filter(p => p);
    if (pathParts.length < 2) return null;

    const rootName = pathParts[0];
    const relativePath = pathParts.slice(1).join('/');
    return { rootName, relativePath };
  }
  return null;
}

// ============================================================================
// 画像ロード/表示
// ============================================================================

// ファイルの画像リストを取得
async function loadImageList() {
  try {
    const fileInfo = getFileFromURL();
    console.log('fileInfo:', fileInfo);
    if (!fileInfo || !fileInfo.rootName || !fileInfo.relativePath) {
      throw new Error('File not specified');
    }

    currentFile = `${fileInfo.rootName}/${fileInfo.relativePath}`;

    // ファイル名をツールバーに表示
    const filenameDisplay = document.getElementById('filename-display');
    if (filenameDisplay) {
      const basename = fileInfo.relativePath.split('/').pop();
      filenameDisplay.textContent = basename;
    }

    const response = await fetch(fixUrl(`/api/book/${encodeURIComponent(fileInfo.rootName)}/${fileInfo.relativePath}/list`));
    const data = await response.json();
    console.log('画像リスト:', data);

    if (data.error) {
      throw new Error(data.error);
    }

    images = data.images;
    imageCount = data.count || images.length;
    console.log('画像数:', imageCount);

    if (imageCount === 0) {
      throw new Error('No images found');
    }

    // 保存されたページ位置を復元（検証付き）
    const savedPage = localStorage.getItem(`viewer_page_${currentFile}`);
    const savedOffset = localStorage.getItem(`viewer_offset_${currentFile}`);
    const savedDirection = localStorage.getItem(`viewer_direction_${currentFile}`);

    if (savedPage !== null) {
      const page = parseInt(savedPage);
      if (!isNaN(page) && page >= -1 && page <= imageCount) {
        currentPage = page;
        console.log('ページ位置を復元:', currentPage);
      }
    }

    if (savedOffset !== null) {
      const off = parseInt(savedOffset);
      if (!isNaN(off)) {
        offset = Math.max(-1, Math.min(1, off));
        console.log('オフセットを復元:', offset);
      }
    }

    if (savedDirection !== null && (savedDirection === 'rtl' || savedDirection === 'ltr')) {
      readingDirection = savedDirection;
      console.log('読み方向を復元:', readingDirection);
    } else if (data.defaultLTR === true) {
      // APIからのデフォルト値を使用（localStorageにないもの）
      readingDirection = 'ltr';
      console.log('APIのデフォルト(LTR)を適用:', readingDirection);
    }
    updateButtonStates();

    // 最初のページを表示
    await displayCurrentPages(true); // 初回読み込みフラグ
  } catch (err) {
    console.error('loadImageList error:', err);
    document.getElementById('page-info').textContent = `Error: ${err.message}`;
    hideLoading();
  }
}

// 画像を読み込み（キャッシュあり）
async function loadImage(index) {
  if (index < 0 || index >= imageCount) {
    return null;
  }

  // キャッシュにあればそれを返す
  if (imageCache[index]) {
    return imageCache[index];
  }

  const url = fixUrl(`/api/book/${encodeURIComponent(currentFile)}/image/${index}`);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      imageCache[index] = img;
      resolve(img);
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image ${index}`));
    };

    img.src = url;
  });
}

// 画像の横長判定（アスペクト比 >= 1.0）
function isWideImage(img) {
  if (!img) return false;
  return (img.naturalWidth / img.naturalHeight) >= 1.0;
}

// ブラウザが縦長かどうかを判定
function isPortraitViewport() {
  return window.innerHeight > window.innerWidth;
}

// オフセットを適用した表示ページを計算（範囲外も許容）
function getDisplayPage(page = currentPage) {
  return page + offset;
}

// 現在の表示モードを判定（1ページか見開きか）
function isForceOnePageMode() {
  return isPortraitViewport() || forceSinglePageMode;
}

// 現在のページを表示
async function displayCurrentPages(isInitialLoad = false) {
  console.log('displayCurrentPages 開始: currentPage=', currentPage, 'offset=', offset);
  showLoading();
  const displayDiv = document.getElementById('image-display');
  const pageInfoDiv = document.getElementById('page-info');

  const displayPage = getDisplayPage();
  console.log('displayPage:', displayPage);

  // ページ位置とオフセットと読み方向を保存
  localStorage.setItem(`viewer_page_${currentFile}`, currentPage);
  localStorage.setItem(`viewer_offset_${currentFile}`, offset);
  localStorage.setItem(`viewer_direction_${currentFile}`, readingDirection);

  // 古いファイルのデータをクリーンアップ
  cleanupOldFiles(currentFile);

  const forceOnePageMode = isForceOnePageMode();

  try {
    // 最初の画像を読み込み（範囲外はnull）
    console.log('Image loading started:', displayPage);
    const img1 = await loadImage(displayPage);
    console.log('Image loading completed:', displayPage, img1);

    // 横長画像の場合、またはブラウザが縦長の場合、または強制1ページモードの場合は1ページのみ表示
    if ((img1 && isWideImage(img1)) || forceOnePageMode) {
      const container = document.createElement('div');
      container.className = 'single-page';

      if (img1) {
        const imgClone = img1.cloneNode();
        container.appendChild(imgClone);
      }

      displayDiv.innerHTML = '';
      displayDiv.appendChild(container);

      if (!img1) {
        pageInfoDiv.textContent = 'Blank';
      } else {
        let suffix = '';
        if (isWideImage(img1)) suffix = ' (Wide)';
        else if (forceSinglePageMode) suffix = ' (Single page)';
        else if (isPortraitViewport()) suffix = ' (Portrait display)';
        pageInfoDiv.textContent = `${displayPage + 1} / ${imageCount}${suffix}`;
      }
    } else {
      // 2ページ表示
      const container = document.createElement('div');
      container.className = 'double-page';

      const firstDiv = document.createElement('div');
      firstDiv.className = 'page page-first';
      if (img1) {
        const imgClone1 = img1.cloneNode();
        firstDiv.appendChild(imgClone1);
      }

      // 次のページ
      const nextPage = displayPage + 1;
      const img2 = await loadImage(nextPage);

      if (img2 && !isWideImage(img2)) {
        const secondDiv = document.createElement('div');
        secondDiv.className = 'page page-second';
        const imgClone2 = img2.cloneNode();
        secondDiv.appendChild(imgClone2);

        // DOM追加順序で配置制御（RTL: 右→左、LTR: 左→右）
        if (readingDirection === 'ltr') {
          container.appendChild(firstDiv);
          container.appendChild(secondDiv);
        } else {
          container.appendChild(secondDiv);
          container.appendChild(firstDiv);
        }

        // ページ情報表示（RTL時は表示順に合わせて降順）
        const validPages = [];
        if (img1 && displayPage >= 0 && displayPage < imageCount) validPages.push(displayPage + 1);
        if (img2 && nextPage >= 0 && nextPage < imageCount) validPages.push(nextPage + 1);
        if (readingDirection === 'rtl') validPages.reverse();
        pageInfoDiv.textContent = validPages.length > 0 ? `${validPages.join('-')} / ${imageCount}` : 'Blank';
      } else {
        // 次のページが横長または範囲外の場合は1ページのみ
        container.appendChild(firstDiv);
        if (img1 && displayPage >= 0 && displayPage < imageCount) {
          pageInfoDiv.textContent = `${displayPage + 1} / ${imageCount}`;
        } else {
          pageInfoDiv.textContent = `Blank`;
        }
      }

      displayDiv.innerHTML = '';
      displayDiv.appendChild(container);
    }

    // 前後のページを先読み
    preloadAdjacentPages(displayPage);

    hideLoading();

    // 初回読み込み時のみページ情報を1秒表示
    if (isInitialLoad) {
      showPageInfo(true, 1000);
    }

  } catch (err) {
    pageInfoDiv.textContent = `Error: ${err.message}`;
    showPageInfo(true, 1000);
    hideLoading();
  }
}

// 前後のページを先読み
async function preloadAdjacentPages(currentIndex) {
  const preloadOffsets = [2, 3, -1, -2, 4, 5, 6, 7];

  for (const offset of preloadOffsets) {
    const index = currentIndex + offset;
    if (index >= 0 && index < imageCount && !imageCache[index]) {
      loadImage(index).catch(() => {
        // エラーは無視（バックグラウンドでの先読みのため）
      });
    }
  }
}

// ============================================================================
// ページ移動
// ============================================================================

// 移動後に表示可能な画像があるかチェック
function canMoveTo(newPage, newOffset) {
  const newDisplayPage = newPage + newOffset;
  const page1InRange = newDisplayPage >= 0 && newDisplayPage < imageCount;
  const page2InRange = (newDisplayPage + 1) >= 0 && (newDisplayPage + 1) < imageCount;

  const forceOnePageMode = isForceOnePageMode();
  if (forceOnePageMode) {
    return page1InRange;
  } else {
    return page1InRange || page2InRange;
  }
}

// ページ移動の共通処理
async function movePages(direction) {
  const displayPage = getDisplayPage();
  const forceOnePageMode = isForceOnePageMode();
  const img = imageCache[displayPage] || await loadImage(displayPage);

  let step;
  if (forceOnePageMode || (img && isWideImage(img))) {
    step = 1; // 1ページモードまたは横長は1ページ移動
  } else {
    // 隣接ページもチェック
    const adjacentPage = displayPage + direction;
    const img2 = imageCache[adjacentPage] || await loadImage(adjacentPage);
    step = (img2 && !isWideImage(img2)) ? 2 : 1;
  }

  const newPage = currentPage + (step * direction);

  // 移動後に表示できる画像があれば移動
  if (canMoveTo(newPage, offset)) {
    currentPage = newPage;
  }

  await displayCurrentPages();
}

// 次のページセットへ移動
async function nextPages() {
  hidePageSidebar();
  await movePages(1);
}

// 前のページセットへ移動
async function prevPages() {
  hidePageSidebar();
  await movePages(-1);
}

// 左方向へ移動（読み方向に応じてprev/nextを振り分け）
async function toLeft() {
  if (readingDirection === 'ltr') {
    await prevPages();
  } else {
    await nextPages();
  }
}

// 右方向へ移動（読み方向に応じてprev/nextを振り分け）
async function toRight() {
  if (readingDirection === 'ltr') {
    await nextPages();
  } else {
    await prevPages();
  }
}

// 配置修正の共通処理
function adjustOffset(direction) {
  let newOffset = offset + direction;
  let newPage = currentPage;

  // offsetが±1を超えたらcurrentPageを調整してoffsetをリセット
  if (newOffset > 1 || newOffset < -1) {
    newPage = currentPage + newOffset;
    newOffset = 0;
  }

  // 移動後に表示できる画像があれば移動
  if (canMoveTo(newPage, newOffset)) {
    currentPage = newPage;
    offset = newOffset;
  }

  displayCurrentPages();
}

// 配置修正: 1ページ進む
function adjustOffsetForward() {
  adjustOffset(1);
}

// 配置修正: 1ページ戻る
function adjustOffsetBackward() {
  adjustOffset(-1);
}

// ============================================================================
// UI操作（フルスクリーン、ヘルプ、ボタン状態等）
// ============================================================================

// 全画面モードの切り替え
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error('Failed to start fullscreen mode:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

// ファイル一覧に戻る
function backToList() {
  // sessionStorageをクリアしてブラウザの戻るを使う
  sessionStorage.removeItem('fileListIndex');
  sessionStorage.removeItem('fileListPath');
  history.back();
}

// ヘルプの表示/非表示
function toggleHelp() {
  const help = document.getElementById('help');
  help.style.display = help.style.display === 'none' ? 'flex' : 'none';
}

function closeHelp() {
  const help = document.getElementById('help');
  help.style.display = 'none';
}

// ボタンのテキストを現在の状態に更新
function updateButtonStates() {
  const directionBtn = document.getElementById('btn-direction');
  const singleBtn = document.getElementById('btn-single');

  if (directionBtn) {
    directionBtn.textContent = readingDirection === 'rtl' ? 'RTL ←' : 'LTR →';
  }

  if (singleBtn) {
    singleBtn.textContent = forceSinglePageMode ? 'Single' : 'Double';
  }
}

// 読み方向の切り替え
function toggleReadingDirection() {
  readingDirection = readingDirection === 'rtl' ? 'ltr' : 'rtl';
  console.log('Reading direction changed to:', readingDirection);
  updateButtonStates();
  displayCurrentPages();
}
// ============================================================================
// イベントハンドラー
// ============================================================================
// キーボードイベントハンドラ
document.addEventListener('keydown', (e) => {
  console.log('キー押下:', e.key);

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      toLeft();
      break;
    case 'ArrowRight':
      e.preventDefault();
      toRight();
      break;
    case ' ':
    case 'Spacebar':
      e.preventDefault();
      nextPages(); // スペースキーで次のページ
      break;
    case 'ArrowUp':
      e.preventDefault();
      adjustOffsetBackward();
      break;
    case 'ArrowDown':
      e.preventDefault();
      adjustOffsetForward();
      break;
    case 'Enter':
      e.preventDefault();
      toggleFullscreen();
      break;
    case 's':
    case 'S':
      e.preventDefault();
      forceSinglePageMode = !forceSinglePageMode;
      displayCurrentPages();
      break;
    case 'Escape':
    case 'Backspace':
      e.preventDefault();
      // サイドバーまたはオーバーレイが表示されていたら閉じる
      const sidebar = document.getElementById('page-sidebar');
      const overlay = document.getElementById('page-overlay');
      if (sidebar && sidebar.classList.contains('visible')) {
        hidePageSidebar();
      } else if (overlay && overlay.style.display !== 'none') {
        hidePageOverlay();
      } else if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        backToList();
      }
      break;
    case 'h':
    case 'H':
      e.preventDefault();
      toggleHelp();
      break;
    case 'p':
    case 'P':
      e.preventDefault();
      showPageOverlay();
      break;
    case 'f':
    case 'F':
      e.preventDefault();
      togglePageSidebar();
      break;
    case 'd':
    case 'D':
      e.preventDefault();
      toggleReadingDirection();
      break;
  }
});

// ============================================================================
// セットアップ/初期化
// ============================================================================

// ページ読み込み時に画像リストを取得
document.addEventListener('DOMContentLoaded', () => {
  // 初期ローディング表示
  showLoading();

  loadImageList();

  // ツールバーのボタンイベント
  setupToolbar();

  // ボタンの状態を初期化
  updateButtonStates();

  // サイドバーのクローズボタン
  document.getElementById('close-sidebar').addEventListener('click', hidePageSidebar);

  // ページ一覧オーバーレイのクローズボタン
  document.getElementById('close-overlay').addEventListener('click', hidePageOverlay);

  // マウスクリックイベント
  setupMouseNavigation();

  // タッチ/スワイプイベント
  setupTouchNavigation();

  // マウス移動でツールバー表示
  setupToolbarVisibility();
});

// ツールバーのセットアップ
function setupToolbar() {
  document.getElementById('btn-back').addEventListener('click', backToList);
  document.getElementById('btn-thumbnails').addEventListener('click', showPageOverlay);
  document.getElementById('btn-list').addEventListener('click', togglePageSidebar);
  document.getElementById('btn-prev').addEventListener('click', prevPages);
  document.getElementById('btn-next').addEventListener('click', nextPages);
  document.getElementById('btn-offset-up').addEventListener('click', adjustOffsetBackward);
  document.getElementById('btn-offset-down').addEventListener('click', adjustOffsetForward);
  document.getElementById('btn-single').addEventListener('click', () => {
    forceSinglePageMode = !forceSinglePageMode;
    updateButtonStates();
    displayCurrentPages();
  });
  document.getElementById('btn-direction').addEventListener('click', toggleReadingDirection);
  document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
  document.getElementById('btn-help').addEventListener('click', toggleHelp);
  document.getElementById('close-help').addEventListener('click', closeHelp);
}

// マウスクリックでページ送り
function setupMouseNavigation() {
  const imageDisplay = document.getElementById('image-display');

  imageDisplay.addEventListener('click', (e) => {
    const rect = imageDisplay.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    if (clickX < width / 2) {
      toLeft();
    } else {
      toRight();
    }
  });
}

// タッチ/スワイプでページ送り
function setupTouchNavigation() {
  const imageDisplay = document.getElementById('image-display');
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  imageDisplay.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  imageDisplay.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    const minSwipeDistance = 50;

    // 横方向のスワイプが縦方向より大きい場合のみページ送り
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance) {
      if (diffX < 0) {
        toLeft();
      } else {
        toRight();
      }
    }
  }
}

// ツールバーの表示/非表示制御
let toolbarTimer;
function setupToolbarVisibility() {
  const toolbar = document.getElementById('toolbar');
  const viewer = document.getElementById('viewer-container');
  const pageInfo = document.getElementById('page-info');

  viewer.addEventListener('mousemove', (e) => {
    const toolbarHeight = toolbar.offsetHeight;

    // ツールバーの高さ + 余裕（50px）の範囲でツールバー表示
    if (e.clientY < toolbarHeight + 50) {
      toolbar.classList.add('visible');
      clearTimeout(toolbarTimer);
    } else {
      // 範囲外に出たら、ツールバー上でなければすぐに非表示
      if (!toolbar.matches(':hover')) {
        clearTimeout(toolbarTimer);
        toolbar.classList.remove('visible');
      }
    }

    // 画面下部10%にカーソルがある時にページ情報表示
    if (e.clientY > window.innerHeight * 0.9) {
      showPageInfo(false); // 自動非表示なし
    } else {
      hidePageInfo();
    }
  });

  // ツールバー上ではタイマーをキャンセル
  toolbar.addEventListener('mouseenter', () => {
    clearTimeout(toolbarTimer);
  });

  toolbar.addEventListener('mouseleave', () => {
    // ツールバーから離れたらすぐに非表示
    toolbar.classList.remove('visible');
  });
}

// ウィンドウリサイズ時に再描画
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (imageCount > 0) {
      displayCurrentPages();
    }
  }, 300);
});
