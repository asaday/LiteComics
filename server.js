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
const ARCHIVE_EXTENSIONS = ['.cbz', '.zip', '.cbr', '.rar', '.epub'];

// アーカイブ形式の判定
function isRarArchive(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.rar' || ext === '.cbr';
}

function isArchiveFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ARCHIVE_EXTENSIONS.includes(ext);
}

// サムネイルキャッシュの設定
const CACHE_DIR = path.join(__dirname, '.thumbnail-cache');
const MAX_CACHE_SIZE = 1024;
const cacheMetadata = new Map(); // { hash: { path, lastAccess, size } }

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
    console.error('キャッシュの読み込みエラー:', err.message);
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
            console.error('キャッシュ削除エラー:', err.message);
        }
    }
}

// ファイルパスからハッシュを生成
function generateCacheKey(filePath) {
    return crypto.createHash('md5').update(filePath).digest('hex');
}

// アーカイブから画像ファイルリストを取得
async function getImagesFromArchive(filePath) {
    const isRar = isRarArchive(filePath);

    if (isRar) {
        // RAR/CBRの処理 - unrarコマンドを使用
        try {
            const output = execSync(`unrar lb "${filePath}"`, { encoding: 'utf8' });
            const files = output.split('\n').filter(line => line.trim());

            return files
                .filter(filename => {
                    const fileExt = path.extname(filename).toLowerCase();
                    return IMAGE_EXTENSIONS.includes(fileExt);
                })
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        } catch (err) {
            throw new Error(`RARファイルの読み込みに失敗: ${err.message}`);
        }
    } else {
        // ZIP/CBZの処理
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();

        return zipEntries
            .filter(entry => {
                if (entry.isDirectory) return false;
                const entryExt = path.extname(entry.entryName).toLowerCase();
                return IMAGE_EXTENSIONS.includes(entryExt);
            })
            .map(entry => entry.entryName)
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }
}

// アーカイブからファイルを抽出
async function extractFileFromArchive(filePath, entryName) {
    const isRar = isRarArchive(filePath);

    if (isRar) {
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
let config = { paths: [] };
try {
    const configData = require('./config.json');
    config = configData;
} catch (err) {
    console.warn('config.json が読み込めません。デフォルト設定を使用します:', err.message);
    // デフォルト設定: /data ディレクトリを使用
    config = {
        paths: ['/data']
    };
}

// 名前→パスのマッピングを作成
const nameToPath = new Map();
const pathToName = new Map();

for (const pathConfig of config.paths) {
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

        for (const pathConfig of config.paths) {
            try {
                // 文字列またはオブジェクトをサポート
                const dirPath = typeof pathConfig === 'string' ? pathConfig : pathConfig.path;
                const customName = typeof pathConfig === 'object' ? pathConfig.name : null;

                const stats = await fs.stat(dirPath);
                const pathName = customName || path.basename(dirPath);

                rootItems.push({
                    name: pathName,
                    path: pathName, // 名前だけを返す
                    isDirectory: true,
                    isCBZ: false,
                    size: stats.size,
                    modified: stats.mtime
                });
            } catch (err) {
                console.error(`パスの読み込みエラー:`, err.message);
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

            const isArchive = item.isFile() && isArchiveFile(item.name);

            files.push({
                name: item.name,
                path: itemPath,
                isDirectory: item.isDirectory(),
                isCBZ: isArchive,
                size: itemStats.size,
                modified: itemStats.mtime
            });
        }

        // ソート: ディレクトリ優先、その後名前順
        files.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
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

// アーカイブファイル内のファイルリストを取得
app.get('/api/archive/:filename(*)/list', async (req, res) => {
    try {
        const requestPath = decodeURIComponent(req.params.filename);
        const resolved = resolveRequestPath(requestPath);

        if (!resolved) {
            return res.status(404).json({ error: '無効なルート名です' });
        }

        const filePath = resolved.fullPath;

        // ファイルの存在確認
        await fs.access(filePath);

        const imageFiles = await getImagesFromArchive(filePath);

        res.json({
            filename: path.basename(filePath),
            images: imageFiles,
            count: imageFiles.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// アーカイブファイルから特定の画像を取得
app.get('/api/archive/:filename(*)/image/:index', async (req, res) => {
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

        const imageFiles = await getImagesFromArchive(filePath);

        if (index < 0 || index >= imageFiles.length) {
            return res.status(404).json({ error: 'インデックスが範囲外です' });
        }

        const imageName = imageFiles[index];
        const imageBuffer = await extractFileFromArchive(filePath, imageName);

        // MIMEタイプの判定
        const ext = path.extname(imageName).toLowerCase();
        const mimeType = IMAGE_MIME_TYPES[ext] || 'application/octet-stream';

        res.set('Content-Type', mimeType);
        res.send(imageBuffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// アーカイブファイルのサムネイル(1枚目の画像)を取得
app.get('/api/archive/:filename(*)/thumbnail', async (req, res) => {
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

        const imageFiles = await getImagesFromArchive(filePath);

        if (imageFiles.length === 0) {
            return res.status(404).json({ error: '画像が見つかりません' });
        }

        const firstImage = imageFiles[0];
        const imageBuffer = await extractFileFromArchive(filePath, firstImage);

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
            console.error('キャッシュ保存エラー:', err.message);
        }

        res.set('Content-Type', mimeType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.set('X-Cache', 'MISS');
        res.send(imageBuffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`サーバーが起動しました: http://localhost:${PORT}`);
    console.log(`設定されたパス:`, config.paths);
});
