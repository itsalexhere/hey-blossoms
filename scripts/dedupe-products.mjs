import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const content = fs.readFileSync(path.join(root, '.env.local'), 'utf-8');
for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { dedupeActiveProducts } = await import('../utils/db.js');

console.log('Running storefront dedupe (keeps all rows, hides duplicates)...');
const res = await dedupeActiveProducts();
console.log('Done:', JSON.stringify(res));
