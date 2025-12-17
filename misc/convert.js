#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import archiver from 'archiver';

const execPromise = promisify(exec);
const TEMP_BASE = '/tmp/rar_conversion';

async function removeDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        await fs.promises.rm(dirPath, { recursive: true, force: true });
    }
}

function sanitizeForFileSystem(name) {
    return name
        .replace(/:/g, '：')
        .replace(/"/g, '"')
        .replace(/\*/g, '＊')
        .replace(/\?/g, '？')
        .replace(/</g, '＜')
        .replace(/>/g, '＞')
        .replace(/\|/g, '｜')
        .replace(/\\/g, '＼')
        .replace(/\//g, '／')
        .replace(/[\x00-\x1f\x7f]/g, '');
}

async function ensureDir(dirPath) {
    try {
        await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code === 'EINVAL') {
            const dir = path.dirname(dirPath);
            const base = path.basename(dirPath);
            const sanitized = base
                .replace(/「/g, '[')
                .replace(/」/g, ']')
                .replace(/'/g, "'")
                .replace(/'/g, "'")
                .replace(/"/g, '"')
                .replace(/"/g, '"')
                .replace(/…/g, '...');
            const newPath = path.join(dir, sanitized);
            console.log(`  ⚠️  パスをサニタイズ: ${base} -> ${sanitized}`);
            await fs.promises.mkdir(newPath, { recursive: true });
            return newPath;
        }
        throw error;
    }
    return dirPath;
}

async function extractRar(rarPath, destDir) {
    await ensureDir(destDir);
    try {
        await execPromise(`unrar x -o+ "${rarPath}" "${destDir}/"`);
        console.log(`  ✓ 展開完了: ${path.basename(rarPath)}`);
        return true;
    } catch (error) {
        console.error(`  ✗ 展開失敗: ${path.basename(rarPath)}`);
        console.error(`    エラー: ${error.message}`);
        return false;
    }
}

async function extractZip(zipPath, destDir) {
    await ensureDir(destDir);
    try {
        await execPromise(`unzip -o -q "${zipPath}" -d "${destDir}"`);
        console.log(`  ✓ 展開完了: ${path.basename(zipPath)}`);
        return true;
    } catch (error) {
        console.error(`  ✗ 展開失敗: ${path.basename(zipPath)}`);
        console.error(`    エラー: ${error.message}`);
        return false;
    }
}

async function extractAllArchives(dir) {
    let foundArchives = true;
    let iteration = 0;
    const maxIterations = 10;

    while (foundArchives && iteration < maxIterations) {
        iteration++;
        foundArchives = false;

        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                const subdirHadArchives = await extractAllArchives(fullPath);
                foundArchives = foundArchives || subdirHadArchives;
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();

                if (ext === '.rar') {
                    foundArchives = true;
                    const extractDir = path.join(path.dirname(fullPath), path.basename(entry.name, '.rar'));
                    await extractRar(fullPath, extractDir);
                    await fs.promises.unlink(fullPath);
                } else if (ext === '.zip') {
                    foundArchives = true;
                    const extractDir = path.join(path.dirname(fullPath), path.basename(entry.name, '.zip'));
                    await extractZip(fullPath, extractDir);
                    await fs.promises.unlink(fullPath);
                }
            }
        }
    }

    return foundArchives;
}

function isImageFile(filename) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.avif', '.tiff', '.tif'];
    const ext = path.extname(filename).toLowerCase();
    return imageExtensions.includes(ext);
}

async function hasImageFiles(dir) {
    try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        return entries.some(entry => entry.isFile() && isImageFile(entry.name));
    } catch (error) {
        return false;
    }
}

async function hasDirectFiles(dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    return entries.some(entry => entry.isFile());
}

async function zipDirectory(sourceDir, outputZipPath) {
    return new Promise(async (resolve, reject) => {
        const output = fs.createWriteStream(outputZipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        let fileCount = 0;

        output.on('close', () => {
            resolve(fileCount);
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && isImageFile(entry.name)) {
                const filePath = path.join(sourceDir, entry.name);
                archive.file(filePath, { name: entry.name });
                fileCount++;
            }
        }

        archive.finalize();
    });
}

function getUniqueFilePath(outputPath) {
    if (!fs.existsSync(outputPath)) {
        return outputPath;
    }

    const dir = path.dirname(outputPath);
    const ext = path.extname(outputPath);
    const baseName = path.basename(outputPath, ext);

    let counter = 1;
    let newPath;
    do {
        newPath = path.join(dir, `${baseName}_${counter}${ext}`);
        counter++;
    } while (fs.existsSync(newPath));

    return newPath;
}

async function zipLeafDirectories(dir, outputBaseDir, relativePath = '') {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const hasImages = await hasImageFiles(dir);

    if (hasImages) {
        const zipName = path.basename(dir) + '.zip';
        let outputPath = path.join(outputBaseDir, zipName);

        outputPath = getUniqueFilePath(outputPath);
        const finalZipName = path.basename(outputPath);

        console.log(`  📦 ZIP作成中: ${finalZipName}`);

        const fileCount = await zipDirectory(dir, outputPath);

        if (fileCount > 0) {
            console.log(`  ✓ ZIP作成完了: ${finalZipName} (${fileCount}ファイル)`);
        } else {
            await fs.promises.unlink(outputPath);
            console.log(`  ⏭️  スキップ: ${finalZipName} (画像ファイルなし)`);
        }
    } else {
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subdirPath = path.join(dir, entry.name);
                const newRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
                await zipLeafDirectories(subdirPath, outputBaseDir, newRelativePath);
            }
        }
    }
}

async function createZipStructure(tempDir, outputDir) {
    await ensureDir(outputDir);

    const entries = await fs.promises.readdir(tempDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const subdirPath = path.join(tempDir, entry.name);
            await zipLeafDirectories(subdirPath, outputDir, entry.name);
        }
    }

    const hasFiles = await hasDirectFiles(tempDir);
    if (hasFiles) {
        await zipLeafDirectories(tempDir, outputDir, '');
    }
}


async function processRarFile(rarPath, outputDir, deleteOriginal = false) {
    const rawBaseName = path.basename(rarPath, path.extname(rarPath));
    const baseName = sanitizeForFileSystem(rawBaseName);

    console.log(`\n処理開始: ${baseName}`);
    if (rawBaseName !== baseName) {
        console.log(`  ⚠️  ファイル名をサニタイズしました`);
    }

    const outputSubDir = path.join(outputDir, baseName);

    if (fs.existsSync(outputSubDir)) {
        const entries = await fs.promises.readdir(outputSubDir, { recursive: true });
        const hasZipFiles = entries.some(e => e.endsWith('.zip'));
        if (hasZipFiles) {
            console.log(`  ⏭️  スキップ: 既に処理済み`);
            return;
        }
    }

    const tempDir = path.join(TEMP_BASE, baseName);
    await removeDir(tempDir);
    await ensureDir(tempDir);

    const actualOutputDir = await ensureDir(outputSubDir);

    try {
        console.log(`ステップ1: 初期展開`);
        await extractRar(rarPath, tempDir);

        console.log(`ステップ2: 再帰的展開`);
        await extractAllArchives(tempDir);

        console.log(`ステップ3: ZIP化`);
        await createZipStructure(tempDir, actualOutputDir);

        console.log(`✓ 完了: ${baseName}`);
        console.log(`  出力先: ${actualOutputDir}`);

        if (deleteOriginal) {
            await fs.promises.unlink(rarPath);
            console.log(`  🗑️  元ファイルを削除: ${path.basename(rarPath)}`);
        }

    } catch (error) {
        console.error(`✗ エラー: ${baseName}`);
        console.error(error);
    } finally {
        await removeDir(tempDir);
    }
}

async function main() {
    const args = process.argv.slice(2);
    let deleteOriginal = false;
    const fileArgs = [];

    for (const arg of args) {
        if (arg === '--delete' || arg === '-d') {
            deleteOriginal = true;
        } else if (arg.startsWith('-')) {
            console.error(`✗ 不明なオプション: ${arg}`);
            process.exit(1);
        } else {
            fileArgs.push(arg);
        }
    }

    if (fileArgs.length === 0) {
        console.error('使用方法: node convert.js [オプション] <rarファイルのパス> [rarファイルのパス...]');
        console.error('\nオプション:');
        console.error('  -d, --delete    処理完了後に元ファイルを削除');
        console.error('\n例: node convert.js /path/to/file.rar');
        console.error('例: node convert.js --delete /path/to/file.rar');
        process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('RAR/ZIP変換ツール');
    if (deleteOriginal) {
        console.log('モード: 元ファイル削除 🗑️');
    }
    console.log('='.repeat(60));

    for (let i = 0; i < fileArgs.length; i++) {
        const filePath = path.resolve(fileArgs[i]);

        if (!fs.existsSync(filePath)) {
            console.error(`\n✗ ファイルが見つかりません: ${filePath}`);
            continue;
        }

        const stats = await fs.promises.stat(filePath);
        if (!stats.isFile()) {
            console.error(`\n✗ ファイルではありません: ${filePath}`);
            continue;
        }

        const ext = path.extname(filePath).toLowerCase();
        if (ext !== '.rar' && ext !== '.zip') {
            console.error(`\n✗ サポートされていない形式です: ${filePath}`);
            console.error('  対応形式: .rar, .zip');
            continue;
        }

        const outputDir = path.dirname(filePath);

        console.log(`\n[${i + 1}/${fileArgs.length}] ${path.basename(filePath)}`);
        console.log(`出力先: ${outputDir}`);

        await processRarFile(filePath, outputDir, deleteOriginal);
    }

    console.log('\n' + '='.repeat(60));
    console.log('すべての処理が完了しました！');
    console.log('='.repeat(60));
}

main().catch(error => {
    console.error('致命的なエラー:', error);
    process.exit(1);
});
