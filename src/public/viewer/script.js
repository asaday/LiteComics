
// demo API URLを生成
function fixUrl(path) {
  if (!window.location.pathname.startsWith('/demo')) return path;

  if (path.match(/^\/api\/book\/.*\/list$/))
    return `/demo/book/list.json`;

  const imageMatch = path.match(/^\/api\/book\/[^\/]+\/image\/(\d+)$/);
  if (imageMatch)
    return `/demo/book/image/${imageMatch[1]}.jpg`;

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
let pageInfoTimer = null; // ページ情報の自動非表示タイマー

// localStorage管理設定
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
    });

    // 履歴を更新
    saveFileHistory(filteredHistory.slice(0, MAX_FILE_HISTORY));
  } else {
    saveFileHistory(filteredHistory);
  }
}

// ページ一覧サイドバーの表示/非表示
let sidebarVisible = false;
let sidebarTimer = null;

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
  generatePageList();
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
      // サイドバーは閉じない
    });

    pageList.appendChild(pageItem);
  }
}

// ページ一覧オーバーレイの表示/非表示
function showPageOverlay() {
  const overlay = document.getElementById('page-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    generatePageGrid();
  }
}

function hidePageOverlay() {
  const overlay = document.getElementById('page-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
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

    // 保存されたページ位置を復元
    const savedPage = localStorage.getItem(`viewer_page_${currentFile}`);
    const savedOffset = localStorage.getItem(`viewer_offset_${currentFile}`);
    if (savedPage !== null) {
      currentPage = parseInt(savedPage);
      console.log('ページ位置を復元:', currentPage);
    }
    if (savedOffset !== null) {
      offset = parseInt(savedOffset);
      console.log('オフセットを復元:', offset);
    }

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
  return (img.naturalWidth / img.naturalHeight) >= 1.0;
}

// ブラウザが縦長かどうかを判定
function isPortraitViewport() {
  return window.innerHeight > window.innerWidth;
}

// オフセットを適用した表示ページを計算
function getDisplayPage(page = currentPage) {
  const actualPage = (page + offset) % imageCount;
  return actualPage < 0 ? imageCount + actualPage : actualPage;
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

  // ページ位置とオフセットを保存
  localStorage.setItem(`viewer_page_${currentFile}`, currentPage);
  localStorage.setItem(`viewer_offset_${currentFile}`, offset);

  // 古いファイルのデータをクリーンアップ
  cleanupOldFiles(currentFile);

  const forceOnePageMode = isForceOnePageMode();

  try {
    // 最初の画像を読み込み
    console.log('Image loading started:', displayPage);
    const img1 = await loadImage(displayPage);
    console.log('Image loading completed:', displayPage, img1);

    if (!img1) {
      pageInfoDiv.textContent = 'Page not found';
      return;
    }

    // 横長画像の場合、またはブラウザが縦長の場合、または強制1ページモードの場合は1ページのみ表示
    if (isWideImage(img1) || forceOnePageMode) {
      const container = document.createElement('div');
      container.className = 'single-page';

      const imgClone = img1.cloneNode();
      container.appendChild(imgClone);

      displayDiv.innerHTML = '';
      displayDiv.appendChild(container);

      if (isWideImage(img1)) {
        pageInfoDiv.textContent = `${displayPage + 1} / ${imageCount} (Wide)`;
      } else if (forceSinglePageMode) {
        pageInfoDiv.textContent = `${displayPage + 1} / ${imageCount} (Single page)`;
      } else if (isPortraitViewport()) {
        pageInfoDiv.textContent = `${displayPage + 1} / ${imageCount} (Portrait display)`;
      } else {
        pageInfoDiv.textContent = `${displayPage + 1} / ${imageCount}`;
      }
    } else {
      // 2ページ表示（右綴じ: 右ページ、左ページの順）
      const container = document.createElement('div');
      container.className = 'double-page';

      // 右ページ（現在のページ）
      const rightDiv = document.createElement('div');
      rightDiv.className = 'page page-right';
      const imgClone1 = img1.cloneNode();
      rightDiv.appendChild(imgClone1);

      // 左ページ（次のページ）
      const nextPage = displayPage + 1;
      if (nextPage < imageCount) {
        const img2 = await loadImage(nextPage);

        if (img2 && !isWideImage(img2)) {
          const leftDiv = document.createElement('div');
          leftDiv.className = 'page page-left';
          const imgClone2 = img2.cloneNode();
          leftDiv.appendChild(imgClone2);

          container.appendChild(leftDiv);
          container.appendChild(rightDiv);

          pageInfoDiv.textContent = `${displayPage + 1}-${nextPage + 1} / ${imageCount}`;
        } else {
          // 次のページが横長の場合は1ページのみ
          container.appendChild(rightDiv);
          pageInfoDiv.textContent = `${displayPage + 1} / ${imageCount}`;
        }
      } else {
        // 最後のページ
        container.appendChild(rightDiv);
        pageInfoDiv.textContent = `${displayPage + 1} / ${imageCount}`;
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

// 次のページセットへ移動
async function nextPages() {
  console.log('nextPages called: currentPage=', currentPage);
  const displayPage = getDisplayPage();
  console.log('nextPages: displayPage=', displayPage);

  if (displayPage >= imageCount) {
    console.log('Last page');
    return;
  }

  const forceOnePageMode = isForceOnePageMode();

  // Load image and check
  console.log('nextPages: Image check started');
  const img = imageCache[displayPage] || await loadImage(displayPage);
  console.log('nextPages: Image check completed', img, 'isWide=', isWideImage(img));

  if (forceOnePageMode || (img && isWideImage(img))) {
    currentPage += 1; // 1ページモードまたは横長は1ページ進む
  } else {
    // 次のページもチェック
    const nextPage = displayPage + 1;
    if (nextPage < imageCount) {
      const img2 = imageCache[nextPage] || await loadImage(nextPage);
      if (img2 && !isWideImage(img2)) {
        currentPage += 2; // 2ページ進む
      } else {
        currentPage += 1; // 次が横長なら1ページだけ進む
      }
    } else {
      currentPage += 1;
    }
  }

  if (currentPage >= imageCount) {
    currentPage = imageCount - 1;
  }

  await displayCurrentPages();
}

// 前のページセットへ移動
async function prevPages() {
  const forceOnePageMode = isForceOnePageMode();

  if (forceOnePageMode) {
    currentPage -= 1; // 1ページモードの場合1ページ戻る
  } else {
    currentPage -= 2; // 2ページモードの場合2ページ戻る
  }

  if (currentPage < 0) {
    currentPage = 0;
  }

  await displayCurrentPages();
}

// 配置修正: 1ページ進む
function adjustOffsetForward() {
  offset += 1;
  displayCurrentPages();
}

// 配置修正: 1ページ戻る
function adjustOffsetBackward() {
  offset -= 1;
  displayCurrentPages();
}

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

// キーボードイベントハンドラ
document.addEventListener('keydown', (e) => {
  console.log('キー押下:', e.key);

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      nextPages(); // 右綴じなので左キーで次へ
      break;
    case 'ArrowRight':
      e.preventDefault();
      prevPages(); // 右綴じなので右キーで前へ
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
  }
});

// ページ読み込み時に画像リストを取得
document.addEventListener('DOMContentLoaded', () => {
  // 初期ローディング表示
  showLoading();

  loadImageList();

  // ツールバーのボタンイベント
  setupToolbar();

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
    displayCurrentPages();
  });
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

    // 左半分クリックで次へ（右綴じなので左が次）
    if (clickX < width / 2) {
      nextPages();
    } else {
      // 右半分クリックで前へ
      prevPages();
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
        nextPages();
      } else {
        prevPages();
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
