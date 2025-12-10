
// API URLを生成
function fixUrl(path) {
    const demoPrefix = '/LiteComics/demo';
    if (!window.location.pathname.startsWith(demoPrefix)) return path;

    return path;
}

let currentFile = '';

function getFileFromURL() {
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

function isAudioFile(filename) {
    const audioExtensions = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'];
    const ext = filename.toLowerCase().split('.').pop();
    return audioExtensions.includes('.' + ext);
}

function setupMediaPlayer(basename, url) {
    const filenameDisplay = document.getElementById('media-filename');
    if (filenameDisplay) {
        filenameDisplay.textContent = basename;
    }

    const mediaPlayer = document.getElementById('media-player');
    mediaPlayer.src = url;

    if (isAudioFile(basename)) {
        mediaPlayer.classList.remove('video-player');
        mediaPlayer.classList.add('audio-player');
        const audioInfo = document.getElementById('audio-info');
        audioInfo.classList.add('visible');
        document.getElementById('audio-title').textContent = basename;
    } else {
        mediaPlayer.classList.add('video-player');
        mediaPlayer.classList.remove('audio-player');
    }
}

function loadMedia() {
    try {
        const fileInfo = getFileFromURL();
        if (!fileInfo || !fileInfo.rootName || !fileInfo.relativePath) {
            throw new Error('ファイルが指定されていません');
        }

        currentFile = `${fileInfo.rootName}/${fileInfo.relativePath}`;
        const basename = fileInfo.relativePath.split('/').pop();
        const fallbackUrl = fixUrl(`/api/file/${encodeURIComponent(currentFile)}`);

        // 外部アプリ判定を先に行う(APIがなくてもfallbackで再生するので問題ない)
        fetch(fixUrl(`/api/media-url/${encodeURIComponent(currentFile)}`))
            .then(response => response.json())
            .then(data => {
                if (data.custom) {
                    // 外部アプリで開く場合は確認
                    const appName = data.name || '外部アプリ';
                    if (confirm(`${appName}で開きますか？`)) {
                        window.location.href = data.url;
                        return
                    }
                }
                setupMediaPlayer(basename, fallbackUrl);
            })
            .catch(err => {
                setupMediaPlayer(basename, fallbackUrl);
            });

    } catch (err) {
        console.error('loadMedia error:', err);
        alert(`Error: ${err.message}`);
    }
}

function backToList() {
    sessionStorage.removeItem('fileListIndex');
    sessionStorage.removeItem('fileListPath');
    history.back();
}

let volumeTimer = null;
function showVolume(volume) {
    const indicator = document.getElementById('volume-indicator');
    const icon = document.getElementById('volume-icon');
    const value = document.getElementById('volume-value');

    // アイコンを音量に応じて変更
    if (volume === 0) {
        icon.textContent = '🔇';
    } else if (volume < 0.33) {
        icon.textContent = '🔈';
    } else if (volume < 0.67) {
        icon.textContent = '🔉';
    } else {
        icon.textContent = '🔊';
    }

    value.textContent = Math.round(volume * 100) + '%';

    indicator.classList.add('visible');

    if (volumeTimer) {
        clearTimeout(volumeTimer);
    }

    volumeTimer = setTimeout(() => {
        indicator.classList.remove('visible');
    }, 1000);
}

function setupToolbarVisibility() {
    const toolbar = document.getElementById('media-toolbar');
    const container = document.getElementById('media-container');

    container.addEventListener('mousemove', (e) => {
        const toolbarHeight = toolbar.offsetHeight;

        if (e.clientY < toolbarHeight + 50) {
            toolbar.classList.add('visible');
        } else {
            if (!toolbar.matches(':hover')) {
                toolbar.classList.remove('visible');
            }
        }
    });

    toolbar.addEventListener('mouseenter', () => {
        toolbar.classList.add('visible');
    });

    toolbar.addEventListener('mouseleave', () => {
        toolbar.classList.remove('visible');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadMedia();
    document.getElementById('btn-back').addEventListener('click', backToList);
    setupToolbarVisibility();

    const mediaPlayer = document.getElementById('media-player');

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Backspace') {
            e.preventDefault();
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                backToList();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            // 15秒戻る
            mediaPlayer.currentTime = Math.max(0, mediaPlayer.currentTime - 15);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            // 15秒進む
            mediaPlayer.currentTime = Math.min(mediaPlayer.duration, mediaPlayer.currentTime + 15);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            // 音量アップ
            const newVolume = Math.min(1, mediaPlayer.volume + 0.1);
            mediaPlayer.volume = newVolume;
            showVolume(newVolume);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            // 音量ダウン
            const newVolume = Math.max(0, mediaPlayer.volume - 0.1);
            mediaPlayer.volume = newVolume;
            showVolume(newVolume);
        } else if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            // 再生/一時停止
            if (mediaPlayer.paused) {
                mediaPlayer.play();
            } else {
                mediaPlayer.pause();
            }
        }
    });
});
