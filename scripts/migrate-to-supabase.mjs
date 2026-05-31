// ============================================================
// One-time migration: data/database.json  ->  Supabase
// Usage:  node scripts/migrate-to-supabase.mjs
// Requires .env.local with Supabase URL + SERVICE_ROLE_KEY.
// Idempotent: products upsert by source_url, so re-running is safe.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// --- Load .env.local manually (Node scripts don't auto-load it) ---
function loadEnv() {
    const envPath = path.join(root, '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('Missing .env.local — fill in your Supabase credentials first.');
        process.exit(1);
    }
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}
loadEnv();

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    process.exit(1);
}

// Import db layer AFTER env is loaded
const { insertProducts } = await import('../utils/db.js');

async function main() {
    const dbPath = path.join(root, 'data', 'database.json');
    if (!fs.existsSync(dbPath)) {
        console.error(`Not found: ${dbPath}`);
        process.exit(1);
    }

    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const sources = db.sources || [];
    const products = db.products || [];
    console.log(`Loaded ${products.length} products from database.json`);

    const sourceName = (id) => sources.find((s) => s.id === id)?.name || 'Unknown';

    // Group products by source name
    const groups = new Map();
    for (const p of products) {
        const name = sourceName(p.source_id);
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(p);
    }

    let totalInserted = 0;
    let totalUpdated = 0;
    for (const [name, items] of groups) {
        console.log(`\nMigrating ${items.length} products from "${name}"...`);
        const res = await insertProducts(items, name, null);
        console.log(`  inserted=${res.inserted} updated=${res.updated} priceChanges=${res.priceChanges} errors=${res.errors}`);
        totalInserted += res.inserted;
        totalUpdated += res.updated;
    }

    console.log(`\nDone. Inserted ${totalInserted}, updated ${totalUpdated} products into Supabase.`);
}

main().catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
});
