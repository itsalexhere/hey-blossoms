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

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const tables = ['roles', 'profiles', 'brands', 'categories', 'products', 'product_images', 'scrape_logs', 'settings'];
let allOk = true;
for (const t of tables) {
    const { error, count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
        console.log(`  [MISSING] ${t}: ${error.message}`);
        allOk = false;
    } else {
        console.log(`  [OK] ${t} (${count ?? 0} rows)`);
    }
}
console.log(allOk ? '\nAll tables present. Ready to migrate.' : '\nSome tables missing — run schema.sql in Supabase SQL Editor first.');
