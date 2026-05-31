/**
 * One-time cleanup: move legacy/clutter to _archive/
 * Run: node scripts/cleanup-root.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const dirs = {
    legacyApp: path.join(root, '_archive/legacy-app'),
    legacyDocs: path.join(root, '_archive/legacy-docs'),
    oldData: path.join(root, '_archive/old-data'),
    rootClutter: path.join(root, '_archive/root-clutter'),
    scratch: path.join(root, '_archive/scratch'),
    orphanScrapers: path.join(root, '_archive/orphan-scrapers'),
};

for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true });

function move(src, destDir) {
    const from = path.join(root, src);
    if (!fs.existsSync(from)) return false;
    const to = path.join(destDir, path.basename(src));
    try {
        if (fs.existsSync(to)) {
            const stamped = path.join(destDir, `${path.basename(src)}-${Date.now()}`);
            fs.renameSync(from, stamped);
            console.log('moved (dup)', src, '->', path.relative(root, stamped));
            return true;
        }
        fs.renameSync(from, to);
        console.log('moved', src, '->', path.relative(root, to));
        return true;
    } catch (e) {
        console.warn('SKIP (locked?)', src, '-', e.code);
        return false;
    }
}

// Legacy Next.js at root
for (const item of ['app', 'public', 'middleware.js', 'next.config.mjs', 'jsconfig.json', 'eslint.config.mjs', '.next']) {
    move(item, dirs.legacyApp);
}

// Old data
for (const item of ['data', 'output', 'database', 'data.json']) {
    move(item, dirs.oldData);
}

// Orphan scrapers
for (const item of ['utils/scrapers/komehyo.js', 'utils/scrapers/zzer.js']) {
    move(item, dirs.orphanScrapers);
}

// Keep these markdown files at root
const keepMd = new Set(['README.md', 'DEPLOY.md', 'AGENTS.md']);

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = entry.name;

    if (name.endsWith('.png') || name.endsWith('.log')) {
        move(name, dirs.rootClutter);
        continue;
    }

    if (name.endsWith('.html')) {
        move(name, dirs.rootClutter);
        continue;
    }

    if (name.endsWith('.md') && !keepMd.has(name)) {
        move(name, dirs.legacyDocs);
        continue;
    }

    if (name.endsWith('.mjs') && name !== 'package.json') {
        // All root .mjs are scratch/dev scripts
        move(name, dirs.scratch);
    }
}

console.log('\nDone. Active app: apps/web/');
