const express = require('express');
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 8539;

// 画像のMIMEタイプマッピング（共通定義）
const IMAGE_MIME_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.avif': 'image/avif'
};

// サポートする画像拡張子
const IMAGE_EXTENSIONS = Object.keys(IMAGE_MIME_TYPES);

// サポートするアーカイブ拡張子
const ARCHIVE_EXTENSIONS = ['.cbz', '.zip', '.cbr', '.rar', '.cb7', '.7z', '.epub'];

// サポートする動画拡張子
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m2ts', '.ts', '.wmv', '.flv', '.mpg', '.mpeg'];

// サポートする音声拡張子
const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.wma', '.opus'];

// 動画のMIMEタイプマッピング
const VIDEO_MIME_TYPES = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.m2ts': 'video/mp2t',
    '.ts': 'video/mp2t',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.mpg': 'video/mpeg',
    '.mpeg': 'video/mpeg'
};

// 音声のMIMEタイプマッピング
const AUDIO_MIME_TYPES = {
    '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.wma': 'audio/x-ms-wma',
    '.opus': 'audio/opus'
};

const defaultConfig = {
    roots: ['/data'],
    handlers: {
        ios: {
            VLC: {
                ext: ['.mkv', '.avi', '.flac', '.m2ts', '.ts', '.wmv'],
                url: 'vlc-x-callback://x-callback-url/stream?url={url}'
            }
        },
        android: {
            VLC: {
                ext: ['.mkv', '.m2ts', '.ts'],
                url: 'vlc://x-callback-url/stream?url={url}'
            }
        },
        mac: {
            IINA: {
                ext: ['.avi', '.flac', '.mkv', '.m2ts', '.ts', '.wmv'],
                url: 'iina://weblink?url={url}'
            }
        },
        windows: {
            VLC: {
                ext: ['.avi', '.flac', '.mkv', '.m2ts', '.ts', '.wmv'],
                url: 'vlc://{url}'
            }
        }
    }
};

// アーカイブ形式の判定
function isRarArchive(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.rar' || ext === '.cbr';
}

function is7zArchive(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.7z' || ext === '.cb7';
}

function isArchiveFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ARCHIVE_EXTENSIONS.includes(ext);
}

function isVideoFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
}

function isAudioFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return AUDIO_EXTENSIONS.includes(ext);
}

// サムネイルキャッシュの設定
const CACHE_DIR = path.join(__dirname, '.thumbnail-cache');
const MAX_CACHE_SIZE = 4096;
const cacheMetadata = new Map(); // { hash: { path, lastAccess, size } }

// 画像リストのメモリキャッシュ
const MAX_IMAGE_LIST_CACHE = 256;
const imageListCache = new Map(); // { filePath: { imageFiles, lastAccess } }

// キャッシュディレクトリの初期化
if (!fssync.existsSync(CACHE_DIR)) {
    fssync.mkdirSync(CACHE_DIR, { recursive: true });
}

// 既存のキャッシュファイルを読み込み
try {
    const cacheFiles = fssync.readdirSync(CACHE_DIR);
    for (const file of cacheFiles) {
        const filePath = path.join(CACHE_DIR, file);
        const stats = fssync.statSync(filePath);
        cacheMetadata.set(file, {
            path: filePath,
            lastAccess: stats.atimeMs,
            size: stats.size
        });
    }
} catch (err) {
    console.error('Cache loading error:', err.message);
}

// LRU方式でキャッシュをクリーンアップ
function cleanupCache() {
    if (cacheMetadata.size <= MAX_CACHE_SIZE) return;

    // lastAccessでソートして古いものから削除
    const entries = Array.from(cacheMetadata.entries())
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    const toDelete = entries.slice(0, cacheMetadata.size - MAX_CACHE_SIZE);

    for (const [hash, metadata] of toDelete) {
        try {
            fssync.unlinkSync(metadata.path);
            cacheMetadata.delete(hash);
        } catch (err) {
            console.error('Cache deletion error:', err.message);
        }
    }
}

// 画像リストキャッシュのクリーンアップ
function cleanupImageListCache() {
    if (imageListCache.size <= MAX_IMAGE_LIST_CACHE) return;

    const entries = Array.from(imageListCache.entries())
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    const toDelete = entries.slice(0, imageListCache.size - MAX_IMAGE_LIST_CACHE);

    for (const [filePath] of toDelete) {
        imageListCache.delete(filePath);
    }
}

// ファイルパスからハッシュを生成
function generateCacheKey(filePath) {
    return crypto.createHash('md5').update(filePath).digest('hex');
}

// 本（アーカイブ）から画像ファイルリストを取得
async function getImagesFromBook(filePath) {
    // キャッシュチェック
    if (imageListCache.has(filePath)) {
        const cached = imageListCache.get(filePath);
        cached.lastAccess = Date.now();
        imageListCache.set(filePath, cached);
        return cached.imageFiles;
    }

    let imageFiles;

    if (isRarArchive(filePath)) {
        // RAR/CBRの処理 - unrarコマンドを使用
        try {
            const output = execSync(`unrar lb "${filePath}"`, { encoding: 'utf8' });
            const files = output.split('\n').filter(line => line.trim());

            imageFiles = files
                .filter(filename => {
                    const fileExt = path.extname(filename).toLowerCase();
                    return IMAGE_EXTENSIONS.includes(fileExt);
                })
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        } catch (err) {
            throw new Error(`RARファイルの読み込みに失敗: ${err.message}`);
        }
    } else if (is7zArchive(filePath)) {
        // 7Z/CB7の処理 - 7zコマンドを使用
        try {
            const output = execSync(`7z l -slt "${filePath}"`, { encoding: 'utf8' });
            const files = [];
            const lines = output.split('\n');
            let currentPath = null;
            let isDirectory = false;

            for (const line of lines) {
                if (line.startsWith('Path = ')) {
                    currentPath = line.substring(7).trim();
                } else if (line.startsWith('Folder = ')) {
                    isDirectory = line.substring(9).trim() === '+';
                } else if (line.trim() === '' && currentPath) {
                    if (!isDirectory) {
                        const fileExt = path.extname(currentPath).toLowerCase();
                        if (IMAGE_EXTENSIONS.includes(fileExt)) {
                            files.push(currentPath);
                        }
                    }
                    currentPath = null;
                    isDirectory = false;
                }
            }

            imageFiles = files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        } catch (err) {
            throw new Error(`7Zファイルの読み込みに失敗: ${err.message}`);
        }
    } else {
        // ZIP/CBZの処理
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();

        imageFiles = zipEntries
            .filter(entry => {
                if (entry.isDirectory) return false;
                const entryExt = path.extname(entry.entryName).toLowerCase();
                return IMAGE_EXTENSIONS.includes(entryExt);
            })
            .map(entry => entry.entryName)
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }

    // キャッシュに保存
    imageListCache.set(filePath, {
        imageFiles: imageFiles,
        lastAccess: Date.now()
    });
    cleanupImageListCache();

    return imageFiles;
}

// 本（アーカイブ）からファイルを抽出
async function extractFileFromBook(filePath, entryName) {

    if (isRarArchive(filePath)) {
        // RAR/CBRの処理 - unrarコマンドで標準出力に抽出
        try {
            const buffer = execSync(`unrar p -inul "${filePath}" "${entryName}"`, {
                encoding: 'buffer',
                maxBuffer: 50 * 1024 * 1024 // 50MBまで
            });
            return buffer;
        } catch (err) {
            throw new Error(`ファイルの抽出に失敗: ${entryName}`);
        }
    } else if (is7zArchive(filePath)) {
        // 7Z/CB7の処理 - 7zコマンドで標準出力に抽出
        try {
            const buffer = execSync(`7z e -so "${filePath}" "${entryName}"`, {
                encoding: 'buffer',
                maxBuffer: 50 * 1024 * 1024 // 50MBまで
            });
            return buffer;
        } catch (err) {
            throw new Error(`ファイルの抽出に失敗: ${entryName}`);
        }
    } else {
        // ZIP/CBZの処理
        const zip = new AdmZip(filePath);
        const entry = zip.getEntry(entryName);

        if (!entry) {
            throw new Error(`ファイルが見つかりません: ${entryName}`);
        }

        return entry.getData();
    }
}

// 設定ファイルの読み込み

let config = { ...defaultConfig };

try {
    const configData = require('./config.json');
    config = {
        ...defaultConfig,
        ...configData,
        handlers: configData.handlers || defaultConfig.handlers
    };
} catch (err) {
    console.warn('config.json could not be loaded. Using default settings:', err.message);
}

// 名前→パスのマッピングを作成
const nameToPath = new Map();
const pathToName = new Map();

for (const pathConfig of config.roots) {
    const dirPath = typeof pathConfig === 'string' ? pathConfig : pathConfig.path;
    const customName = typeof pathConfig === 'object' ? pathConfig.name : null;
    const name = customName || path.basename(dirPath);

    nameToPath.set(name, dirPath);
    pathToName.set(dirPath, name);
}

// リクエストパスをrootName/relativePath形式から実際のパスに解決
function resolveRequestPath(requestPath) {
    const parts = requestPath.split('/').filter(p => p);
    const rootName = parts[0];
    const relativePath = parts.slice(1).join('/');

    const rootPath = nameToPath.get(rootName);
    if (!rootPath) {
        return null;
    }

    const fullPath = relativePath ? path.join(rootPath, relativePath) : rootPath;
    return { rootName, relativePath, rootPath, fullPath };
}

// 静的ファイルの配信
app.use(express.static('public'));

// ルート一覧を取得
app.get('/api/roots', async (req, res) => {
    try {
        const rootItems = [];

        for (const pathConfig of config.roots) {
            try {
                // 文字列またはオブジェクトをサポート
                const dirPath = typeof pathConfig === 'string' ? pathConfig : pathConfig.path;
                const customName = typeof pathConfig === 'object' ? pathConfig.name : null;

                const stats = await fs.stat(dirPath);
                const pathName = customName || path.basename(dirPath);

                rootItems.push({
                    name: pathName,
                    path: pathName, // 名前だけを返す
                    type: 'directory',
                    size: stats.size,
                    modified: stats.mtime
                });
            } catch (err) {
                console.error(`Path loading error:`, err.message);
            }
        }

        res.json(rootItems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 特定のディレクトリの内容を取得
app.get('/api/dir/*', async (req, res) => {
    try {
        const requestPath = decodeURIComponent(req.params[0]);
        const resolved = resolveRequestPath(requestPath);

        if (!resolved) {
            return res.status(404).json({ error: '無効なルート名です' });
        }

        const { rootName, relativePath, fullPath: dirPath } = resolved;

        // ファイルの存在とディレクトリかどうかを確認
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
            return res.status(400).json({ error: 'ディレクトリではありません' });
        }

        const items = await fs.readdir(dirPath, { withFileTypes: true });
        const files = [];

        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            const itemStats = await fs.stat(fullPath);

            const ext = item.name.toLowerCase();

            // 相対パスを構築（rootName/relativePath形式）
            const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;
            const itemPath = `${rootName}/${itemRelativePath}`;

            let type = 'file';
            if (item.isDirectory()) {
                type = 'directory';
            } else if (isArchiveFile(item.name)) {
                type = 'book';
            } else if (isVideoFile(item.name)) {
                type = 'video';
            } else if (isAudioFile(item.name)) {
                type = 'audio';
            }

            files.push({
                name: item.name,
                path: itemPath,
                type: type,
                size: itemStats.size,
                modified: itemStats.mtime
            });
        }

        // ソート: ディレクトリ優先、その後名前順（自然順ソート）
        files.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });

        res.json({
            rootName: rootName,
            relativePath: relativePath,
            files: files
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 本（アーカイブ）内のファイルリストを取得
app.get('/api/book/:filename(*)/list', async (req, res) => {
    try {
        const requestPath = decodeURIComponent(req.params.filename);
        const resolved = resolveRequestPath(requestPath);

        if (!resolved) {
            return res.status(404).json({ error: '無効なルート名です' });
        }

        const filePath = resolved.fullPath;

        // ファイルの存在確認
        await fs.access(filePath);

        const imageFiles = await getImagesFromBook(filePath);

        res.json({
            filename: path.basename(filePath),
            images: imageFiles,
            count: imageFiles.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 本（アーカイブ）から特定の画像を取得
app.get('/api/book/:filename(*)/image/:index', async (req, res) => {
    try {
        const requestPath = decodeURIComponent(req.params.filename);
        const index = parseInt(req.params.index);
        const resolved = resolveRequestPath(requestPath);

        if (!resolved) {
            return res.status(404).json({ error: '無効なルート名です' });
        }

        const filePath = resolved.fullPath;

        // ファイルの存在確認
        await fs.access(filePath);

        const imageFiles = await getImagesFromBook(filePath);

        if (index < 0 || index >= imageFiles.length) {
            return res.status(404).json({ error: 'インデックスが範囲外です' });
        }

        const imageName = imageFiles[index];
        const imageBuffer = await extractFileFromBook(filePath, imageName);

        // MIMEタイプの判定
        const ext = path.extname(imageName).toLowerCase();
        const mimeType = IMAGE_MIME_TYPES[ext] || 'application/octet-stream';

        res.set('Content-Type', mimeType);
        res.send(imageBuffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 本のサムネイル（1枚目の画像）を取得
app.get('/api/book/:filename(*)/thumbnail', async (req, res) => {
    try {
        const requestPath = decodeURIComponent(req.params.filename);
        const resolved = resolveRequestPath(requestPath);

        if (!resolved) {
            return res.status(404).json({ error: '無効なルート名です' });
        }

        const filePath = resolved.fullPath;
        const cacheKey = generateCacheKey(filePath);
        const cachePath = path.join(CACHE_DIR, cacheKey);

        // キャッシュが存在する場合
        if (cacheMetadata.has(cacheKey)) {
            try {
                const cachedData = await fs.readFile(cachePath);
                const metadata = cacheMetadata.get(cacheKey);

                // アクセス時刻を更新
                metadata.lastAccess = Date.now();
                cacheMetadata.set(cacheKey, metadata);

                // MIMEタイプを推測（キャッシュファイル名の拡張子から）
                const ext = path.extname(cacheKey.split('_')[0]).toLowerCase();
                const mimeType = IMAGE_MIME_TYPES[ext] || 'image/jpeg';

                res.set('Content-Type', mimeType);
                res.set('Cache-Control', 'public, max-age=86400');
                res.set('X-Cache', 'HIT');
                return res.send(cachedData);
            } catch (err) {
                // キャッシュ読み込み失敗時は再生成
                cacheMetadata.delete(cacheKey);
            }
        }

        // ファイルの存在確認
        await fs.access(filePath);

        const imageFiles = await getImagesFromBook(filePath);

        if (imageFiles.length === 0) {
            return res.status(404).json({ error: '画像が見つかりません' });
        }

        const firstImage = imageFiles[0];
        const imageBuffer = await extractFileFromBook(filePath, firstImage);

        // MIMEタイプの判定
        const ext = path.extname(firstImage).toLowerCase();
        const mimeType = IMAGE_MIME_TYPES[ext] || 'application/octet-stream';

        // キャッシュに保存
        try {
            await fs.writeFile(cachePath, imageBuffer);
            cacheMetadata.set(cacheKey, {
                path: cachePath,
                lastAccess: Date.now(),
                size: imageBuffer.length
            });
            cleanupCache();
        } catch (err) {
            console.error('Cache save error:', err.message);
        }

        res.set('Content-Type', mimeType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.set('X-Cache', 'MISS');
        res.send(imageBuffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 動画・音声ファイルをストリーミング配信
app.get('/api/media/:filename(*)', async (req, res) => {
    try {
        const requestPath = decodeURIComponent(req.params.filename);
        const resolved = resolveRequestPath(requestPath);

        if (!resolved) {
            return res.status(404).json({ error: '無効なルート名です' });
        }

        const filePath = resolved.fullPath;

        // ファイルの存在確認
        const stat = await fs.stat(filePath);

        if (!stat.isFile()) {
            return res.status(404).json({ error: 'ファイルが見つかりません' });
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeType = VIDEO_MIME_TYPES[ext] || AUDIO_MIME_TYPES[ext] || 'application/octet-stream';

        // Range リクエストのサポート
        const range = req.headers.range;
        const fileSize = stat.size;

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mimeType,
            });

            const stream = fssync.createReadStream(filePath, { start, end });
            stream.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': mimeType,
            });

            const stream = fssync.createReadStream(filePath);
            stream.pipe(res);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 一般ファイルを配信（画像、テキストなど）
app.get('/api/file/:filename(*)', async (req, res) => {
    try {
        const requestPath = decodeURIComponent(req.params.filename);
        const resolved = resolveRequestPath(requestPath);

        if (!resolved) {
            return res.status(404).json({ error: '無効なルート名です' });
        }

        const filePath = resolved.fullPath;

        // ファイルの存在確認
        const stat = await fs.stat(filePath);

        if (!stat.isFile()) {
            return res.status(404).json({ error: 'ファイルが見つかりません' });
        }

        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'application/octet-stream';

        // MIMEタイプの判定
        if (IMAGE_MIME_TYPES[ext]) {
            mimeType = IMAGE_MIME_TYPES[ext];
        } else if (ext === '.txt' || ext === '.log' || ext === '.nfo') {
            mimeType = 'text/plain; charset=utf-8';
        } else if (ext === '.json') {
            mimeType = 'application/json';
        } else if (ext === '.xml') {
            mimeType = 'application/xml';
        } else if (ext === '.md') {
            mimeType = 'text/markdown; charset=utf-8';
        } else if (ext === '.csv') {
            mimeType = 'text/csv; charset=utf-8';
        }

        res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': mimeType,
        });

        const stream = fssync.createReadStream(filePath);
        stream.pipe(res);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// メディアファイル用のURL取得API（デバイス判定込み）
app.get('/api/media-url/:filename(*)', async (req, res) => {
    try {
        const requestPath = decodeURIComponent(req.params.filename);
        const resolved = resolveRequestPath(requestPath);

        if (!resolved) {
            return res.status(404).json({ error: '無効なルート名です' });
        }

        const filePath = resolved.fullPath;

        // ファイルの存在確認
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) {
            return res.status(404).json({ error: 'ファイルが見つかりません' });
        }

        // User-Agentからデバイスを判定
        const userAgent = req.headers['user-agent'] || '';
        const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
        const isAndroid = /Android/i.test(userAgent);
        const isMac = /Macintosh|Mac OS X/i.test(userAgent) && !/iPhone|iPad|iPod/i.test(userAgent);
        const isWindows = /Windows/i.test(userAgent);

        // ファイル拡張子を取得
        const ext = path.extname(filePath).toLowerCase();

        // configからmediaHandlersを取得
        const mediaHandlers = config.handlers || {};
        let customUrl = null;
        let handler = null;

        // デバイスタイプに応じたハンドラーを検索
        let handlers = null;
        if (isIOS) {
            handlers = mediaHandlers.ios;
        } else if (isAndroid) {
            handlers = mediaHandlers.android;
        } else if (isMac) {
            handlers = mediaHandlers.mac;
        } else if (isWindows) {
            handlers = mediaHandlers.windows;
        }

        if (handlers) {
            // オブジェクト形式の場合、各ハンドラーをチェック
            for (const [name, h] of Object.entries(handlers)) {
                if (h.ext && h.ext.includes(ext)) {
                    customUrl = h.url;
                    handler = { ...h, name };
                    break;
                }
            }
        }

        // レスポンスを構築
        const mediaPath = `/api/media/${encodeURIComponent(requestPath)}`;
        const fullUrl = `${req.protocol}://${req.get('host')}${mediaPath}`;

        if (customUrl) {
            // カスタムハンドラーのURLを生成({url}プレースホルダーを置換)
            const url = customUrl.replace('{url}', encodeURIComponent(fullUrl));
            const name = handler.name || null;
            res.json({ url, custom: true, name });
        } else {
            // 通常のメディアURL
            res.json({ url: fullUrl });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server started: http://localhost:${PORT}`);
});
