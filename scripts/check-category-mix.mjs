import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { resolveProductCategorySlug } = await import('../utils/product-taxonomy.js');
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const checks = [
    { filter: 'tops', expectNot: 'bag', q: '%bag%' },
    { filter: 'outwear', expectNot: 'bag', q: '%bag%' },
    { filter: 'jewelry-accessories', expectNot: 'bag', q: '%bag%' },
];

for (const c of checks) {
    const { data: cat } = await sb.from('categories').select('id').eq('slug', c.filter).single();
    const { data: rows } = await sb
        .from('products')
        .select('id, title, categories(slug)')
        .eq('category_id', cat.id)
        .ilike('title', c.q)
        .limit(8);
    console.log(`\n=== ${c.filter} with "bag" in title (${rows?.length || 0} sample) ===`);
    for (const r of rows || []) {
        const inferred = resolveProductCategorySlug(r.title, '', '');
        console.log(`  [${r.categories?.slug}] inferred=${inferred} | ${r.title.slice(0, 70)}`);
    }
}

// Products inferred as bag but stored elsewhere
const { data: bagCat } = await sb.from('categories').select('id').eq('slug', 'bag').single();
const { data: allBags } = await sb
    .from('products')
    .select('id, title, categories(slug)')
    .ilike('title', '% bag%')
    .neq('category_id', bagCat.id)
    .limit(15);
console.log('\n=== Title looks like bag but NOT in bag category ===');
for (const r of allBags || []) {
    console.log(`  [${r.categories?.slug}] | ${r.title.slice(0, 75)}`);
}
