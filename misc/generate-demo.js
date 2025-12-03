#!/usr/bin/env node
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const DEMO_DIR = path.join(__dirname, 'demo');
const API_DIR = path.join(DEMO_DIR, 'api');

// サンプル画像を生成（Canvasで簡単な画像を作成）
function generateSampleImage(width, height, pageNumber, isLandscape = false) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 背景
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, isLandscape ? '#ff6b6b' : '#4ecdc4');
    gradient.addColorStop(1, isLandscape ? '#feca57' : '#45b7d1');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // ページ番号
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(height / 4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Page ${pageNumber}`, width / 2, height / 2);

    // サイズ情報
    ctx.font = `${Math.floor(height / 12)}px sans-serif`;
    ctx.fillText(`${width} × ${height}`, width / 2, height * 0.7);
    ctx.fillText(isLandscape ? 'Landscape' : 'Portrait', width / 2, height * 0.8);

    return canvas.toBuffer('image/jpeg', { quality: 0.85 });
}

// デモデータの構造
const demoStructure = {
    roots: [
        {
            name: "Sample Library",
            path: "Sample Library",
            isDirectory: true,
            isArchive: false,
            size: 0,
            modified: new Date().toISOString()
        }
    ],
    library: {
        files: [
            {
                name: "Portrait Comic",
                path: "Sample Library/Portrait Comic",
                isDirectory: false,
                isArchive: true,
                size: 1024000,
                modified: new Date().toISOString()
            },
            {
                name: "Landscape Comic",
                path: "Sample Library/Landscape Comic",
                isDirectory: false,
                isArchive: true,
                size: 2048000,
                modified: new Date().toISOString()
            },
            {
                name: "Mixed Comic",
                path: "Sample Library/Mixed Comic",
                isDirectory: false,
                isArchive: true,
                size: 1536000,
                modified: new Date().toISOString()
            }
        ]
    },
    comics: [
        {
            name: "Portrait Comic",
            pages: 6,
            width: 1200,
            height: 1800,
            isLandscape: false
        },
        {
            name: "Landscape Comic",
            pages: 5,
            width: 2400,
            height: 1600,
            isLandscape: true
        },
        {
            name: "Mixed Comic",
            pages: 8,
            width: 1200,
            height: 1800,
            isLandscape: false,
            mixLandscape: true // 一部横長ページを含む
        }
    ]
};

async function createDirectories() {
    console.log('📁 ディレクトリを作成中...');

    const dirs = [
        DEMO_DIR,
        API_DIR,
        path.join(API_DIR, 'dir'),
        path.join(API_DIR, 'dir', 'Sample Library'),
        path.join(API_DIR, 'archive'),
    ];

    for (const comic of demoStructure.comics) {
        const encodedName = encodeURIComponent(`Sample Library/${comic.name}`);
        const comicDir = path.join(API_DIR, 'archive', encodedName);
        dirs.push(comicDir);
        dirs.push(path.join(comicDir, 'image'));
    }

    for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
    }
}

async function generateAPIFiles() {
    console.log('📝 APIファイルを生成中...');

    // api/roots
    await fs.writeFile(
        path.join(API_DIR, 'roots'),
        JSON.stringify(demoStructure.roots, null, 2)
    );

    // api/dir/Sample Library
    await fs.writeFile(
        path.join(API_DIR, 'dir', 'Sample Library'),
        JSON.stringify({
            rootName: "Sample Library",
            relativePath: "",
            files: demoStructure.library.files
        }, null, 2)
    );
}

async function generateComicImages() {
    console.log('🎨 画像を生成中...');

    for (const comic of demoStructure.comics) {
        const encodedName = encodeURIComponent(`Sample Library/${comic.name}`);
        const comicDir = path.join(API_DIR, 'archive', encodedName);
        const imageDir = path.join(comicDir, 'image');

        const images = [];

        // 各ページを生成
        for (let i = 0; i < comic.pages; i++) {
            const pageNum = i + 1;
            const imageName = `${String(pageNum).padStart(3, '0')}.jpg`;
            images.push(imageName);

            // 混合モードの場合、一部のページを横長にする
            let isLandscape = comic.isLandscape;
            if (comic.mixLandscape && (i === 0 || i === comic.pages - 1 || i === Math.floor(comic.pages / 2))) {
                isLandscape = true;
            }

            const width = isLandscape ? 2400 : comic.width;
            const height = isLandscape ? 1600 : comic.height;

            const imageBuffer = generateSampleImage(width, height, pageNum, isLandscape);

            // api/archive/{name}/image/{index}
            await fs.writeFile(path.join(imageDir, String(i)), imageBuffer);

            console.log(`  ✓ ${comic.name} - Page ${pageNum} (${width}×${height})`);
        }

        // api/archive/{name}/list
        await fs.writeFile(
            path.join(comicDir, 'list'),
            JSON.stringify({
                filename: comic.name,
                images: images,
                count: images.length
            }, null, 2)
        );

        // api/archive/{name}/thumbnail (最初の画像を使用)
        const firstImage = await fs.readFile(path.join(imageDir, '0'));
        await fs.writeFile(path.join(comicDir, 'thumbnail'), firstImage);
    }
}

async function copyPublicFiles() {
    console.log('📋 公開ファイルをコピー中...');

    const publicFiles = [
        'index.html',
        'viewer.html',
        'viewer.js',
        'style.css',
        'favicon.svg'
    ];

    for (const file of publicFiles) {
        const src = path.join(__dirname, 'public', file);
        const dest = path.join(DEMO_DIR, file);

        if (fssync.existsSync(src)) {
            await fs.copyFile(src, dest);
            console.log(`  ✓ ${file}`);
        }
    }
}

async function createReadme() {
    const readme = `# LiteComics Demo

このディレクトリには、サーバーレスで動作するデモが含まれています。

## 使い方

1. このディレクトリを静的ファイルサーバーに配置
2. \`index.html\` にアクセス

## ディレクトリ構造

\`\`\`
demo/
├── index.html          # ファイルリスト
├── viewer.html         # ビューア
├── viewer.js           # ビューアのロジック
├── style.css           # スタイルシート
├── favicon.svg         # アイコン
└── api/                # 静的APIエンドポイント
    ├── roots           # ルート一覧
    ├── dir/            # ディレクトリ一覧
    │   └── Sample Library
    └── archive/        # アーカイブデータ
        ├── Sample%20Library%2FPortrait%20Comic/
        │   ├── list
        │   ├── thumbnail
        │   └── image/
        │       ├── 0
        │       ├── 1
        │       └── ...
        └── ...
\`\`\`

## サンプルコンテンツ

- **Portrait Comic**: 縦長6ページ (1200×1800)
- **Landscape Comic**: 横長5ページ (2400×1600)
- **Mixed Comic**: 混合8ページ（表紙と一部のページが横長）

## ホスティング

- GitHub Pages
- Netlify
- Vercel
- その他静的ホスティング

拡張子なしファイルの配信に対応していれば、そのまま動作します。
`;

    await fs.writeFile(path.join(DEMO_DIR, 'README.md'), readme);
}

async function main() {
    try {
        console.log('🚀 デモデータ生成を開始します...\n');

        await createDirectories();
        await generateAPIFiles();
        await generateComicImages();
        await copyPublicFiles();
        await createReadme();

        console.log('\n✅ デモデータの生成が完了しました！');
        console.log(`\n📂 出力先: ${DEMO_DIR}`);
        console.log('\n次のステップ:');
        console.log('  1. demo/ ディレクトリを静的サーバーに配置');
        console.log('  2. ブラウザで index.html にアクセス');
        console.log('\nローカルテスト:');
        console.log('  cd demo && python3 -m http.server 8080');
        console.log('  または');
        console.log('  cd demo && npx serve');
    } catch (err) {
        console.error('❌ エラーが発生しました:', err);
        process.exit(1);
    }
}

main();
