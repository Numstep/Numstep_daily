const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const ROOT = process.cwd();
const BUILD = path.join(ROOT, '.live-build');
const ALLOWED_EXTENSIONS = new Set([
    '.html', '.htm', '.json', '.pdf', '.css', '.png', '.jpg', '.jpeg',
    '.webp', '.svg', '.ico', '.gif', '.woff', '.woff2', '.txt', '.xml'
]);

const RESERVED_GLOBALS = [
    'NumstepBadge',
    'loadPuzzleForDate',
    'selectPuzzleSize',
    'window',
    'document',
    'fetch',
    'localStorage',
    'sessionStorage'
];

function copyPublicFiles(source, destination) {
    if (!fs.existsSync(source)) return;

    const stat = fs.statSync(source);
    if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(source)) {
            copyPublicFiles(
                path.join(source, entry),
                path.join(destination, entry)
            );
        }
        return;
    }

    const extension = path.extname(source).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) return;

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
}

function collectHtmlFiles(directory) {
    if (!fs.existsSync(directory)) return [];

    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectHtmlFiles(fullPath));
        } else if (/\.html?$/i.test(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

function resolveLocalScript(htmlSource, src) {
    const cleanSrc = src.split('?')[0].split('#')[0];

    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|data:)/i.test(cleanSrc)) {
        return null;
    }

    const resolved = path.resolve(path.dirname(htmlSource), cleanSrc);
    if (!resolved.startsWith(ROOT + path.sep)) {
        throw new Error(`Script escapes repository: ${src}`);
    }

    if (!fs.existsSync(resolved)) {
        throw new Error(`Referenced JavaScript file does not exist: ${resolved}`);
    }

    return resolved;
}

async function buildHtml(htmlPath) {
    const relativePath = path.relative(BUILD, htmlPath);
    const sourceHtml = path.join(ROOT, relativePath);
    let html = fs.readFileSync(sourceHtml, 'utf8');
    const scripts = [];
    let bundleInserted = false;

    html = html.replace(
        /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
        (whole, attributes) => {
            const match = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
            if (!match) return whole;

            const resolved = resolveLocalScript(sourceHtml, match[1]);
            if (!resolved) return whole;

            scripts.push(resolved);

            if (!bundleInserted) {
                bundleInserted = true;
                return '<script src="js/app.min.js"></script>';
            }

            return '';
        }
    );

    if (scripts.length === 0) {
        fs.writeFileSync(htmlPath, html);
        return;
    }

    const source = scripts
        .map(file => fs.readFileSync(file, 'utf8'))
        .join('\n');

    const result = await minify(source, {
        compress: { passes: 2 },
        mangle: {
            toplevel: true,
            reserved: RESERVED_GLOBALS
        },
        format: {
            comments: false
        },
        ecma: 2020
    });

    if (!result.code) {
        throw new Error(`Terser produced no output for ${relativePath}`);
    }

    const bundleDirectory = path.join(path.dirname(htmlPath), 'js');
    fs.mkdirSync(bundleDirectory, { recursive: true });
    fs.writeFileSync(
        path.join(bundleDirectory, 'app.min.js'),
        result.code + '\n'
    );

    fs.writeFileSync(htmlPath, html);
    console.log(`Built ${relativePath}`);
}

async function main() {
    fs.rmSync(BUILD, { recursive: true, force: true });
    fs.mkdirSync(BUILD, { recursive: true });

    copyPublicFiles(
        path.join(ROOT, 'index.html'),
        path.join(BUILD, 'index.html')
    );

    for (const directory of ['games', 'shared']) {
        copyPublicFiles(
            path.join(ROOT, directory),
            path.join(BUILD, directory)
        );
    }

    for (const htmlFile of collectHtmlFiles(BUILD)) {
        await buildHtml(htmlFile);
    }

    console.log('Numstep production build complete.');
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
