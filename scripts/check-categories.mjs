import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const { data: cats } = await sb.from('categories').select('id,name,slug,parent_id').order('name');
console.log('CATEGORIES:', cats);

const { data: watchProds } = await sb
    .from('products')
    .select('id,title,category_id,categories(name,slug)')
    .ilike('title', '%watch%')
    .limit(15);
console.log('WATCH SAMPLE:', watchProds);

const { count: nullCat } = await sb.from('products').select('id', { count: 'exact', head: true }).is('category_id', null);
const { count: total } = await sb.from('products').select('id', { count: 'exact', head: true });
console.log('NULL category_id:', nullCat, '/', total);

const { data: all } = await sb.from('products').select('category_id, categories(name,slug)');
const tally = {};
for (const p of all || []) {
    const key = p.categories?.slug || 'NULL';
    tally[key] = (tally[key] || 0) + 1;
}
console.log('COUNTS BY SLUG:', Object.entries(tally).sort((a, b) => b[1] - a[1]));
