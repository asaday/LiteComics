#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building minified production assets...');

// Check if minify tool is installed
let minifyCmd = 'minify';
try {
    execSync(process.platform === 'win32' ? 'where minify' : 'command -v minify', { stdio: 'ignore' });
} catch {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const homeMinify = path.join(homeDir, 'go', 'bin', process.platform === 'win32' ? 'minify.exe' : 'minify');
    if (fs.existsSync(homeMinify)) {
        minifyCmd = homeMinify;
    } else {
        console.log('Installing minify tool (tdewolff/minify)...');
        execSync('go install github.com/tdewolff/minify/v2/cmd/minify@latest');
        // After install, try to use it from PATH first
        try {
            execSync(process.platform === 'win32' ? 'where minify' : 'command -v minify', { stdio: 'ignore' });
            minifyCmd = 'minify';
        } catch {
            minifyCmd = homeMinify;
        }
    }
}

// Create temp directory for minified files
const TEMP_DIR = 'public-minified';
if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true });
}
fs.mkdirSync(TEMP_DIR, { recursive: true });// Copy structure
console.log('Copying files...');
fs.cpSync('public', TEMP_DIR, { recursive: true });

// Process each HTML file
console.log('Processing HTML files...');
function processDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const filePath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            processDirectory(filePath);
        } else if (entry.name.endsWith('.html')) {
            console.log(`  Processing: ${filePath}`);

            // Check if there's a CSS file to inline
            const cssPath = path.join(dir, 'style.css');
            if (fs.existsSync(cssPath)) {
                console.log('    Inlining CSS...');
                let html = fs.readFileSync(filePath, 'utf8');
                const css = fs.readFileSync(cssPath, 'utf8');

                // Replace marker with inline style
                html = html.replace(
                    /<!-- INLINE_CSS -->/,
                    `<style>\n${css}\n  </style>`
                );
                // Remove external stylesheet link
                html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '');

                fs.writeFileSync(filePath, html);
                fs.unlinkSync(cssPath);
            }

            // Check if there's a JS file to inline
            const jsPath = path.join(dir, 'script.js');
            if (fs.existsSync(jsPath)) {
                console.log('    Inlining JavaScript...');
                let html = fs.readFileSync(filePath, 'utf8');
                const js = fs.readFileSync(jsPath, 'utf8');

                // Replace marker with inline script
                html = html.replace(
                    /<!-- INLINE_JS -->/,
                    `<script>\n${js}\n  </script>`
                );
                // Remove external script tag
                html = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');

                fs.writeFileSync(filePath, html);
                fs.unlinkSync(jsPath);
            }

            // Minify HTML (including inlined CSS and JS)
            console.log('    Minifying...');
            const beforeSize = fs.statSync(filePath).size;
            execSync(`${minifyCmd} -o "${filePath}" "${filePath}"`, { stdio: 'pipe' });
            const afterSize = fs.statSync(filePath).size;
            const reduction = ((1 - afterSize / beforeSize) * 100).toFixed(1);
            console.log(`    ${beforeSize} bytes → ${afterSize} bytes (${reduction}% reduction)`);
        }
    }
}

processDirectory(TEMP_DIR);

console.log('✓ Build complete');
console.log('  Source: public/');
console.log(`  Output: ${TEMP_DIR}/`);
console.log('');
console.log(`You can inspect the minified files in: src/${TEMP_DIR}/`);

// Show size
try {
    const stdout = execSync(process.platform === 'win32' ? `powershell -c "(Get-ChildItem ${TEMP_DIR} -Recurse | Measure-Object -Property Length -Sum).Sum / 1KB"` : `du -sh ${TEMP_DIR}`, { encoding: 'utf8' });
    if (process.platform === 'win32') {
        console.log(`${parseFloat(stdout).toFixed(1)} KB`);
    } else {
        console.log(stdout.trim());
    }
} catch (e) {
    // Ignore size calculation errors
}
