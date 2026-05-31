import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

import { resolveProductCategorySlug, inferGenderFromBanananinaProduct, inferGenderFromYoogisProduct } from '../utils/product-taxonomy.js';
import { buildCategorySlugLookup, ensureVipCategoryTree } from '../utils/category-seed.js';

function inferGender(title, categoryName) {
    const hay = `${title} ${categoryName}`.toLowerCase();
    if (/\b(men|men's|mens|male|boy)\b/.test(hay)) return 'men';
    if (/\b(women|women's|womens|female|lady|girl)\b/.test(hay)) return 'women';
    return null;
}

console.log('Mapping product gender + categories (NULL / wrong VIP slug only)...');
const catMap = await buildCategorySlugLookup();
await ensureVipCategoryTree(catMap);

let from = 0;
const PAGE = 500;
let updated = 0;
let scanned = 0;

for (;;) {
    const { data, error } = await supabase
        .from('products')
        .select('id, title, gender, category_id, source_url, categories(name, slug)')
        .range(from, from + PAGE - 1);
    if (error) {
        console.error(error.message);
        break;
    }
    if (!data?.length) break;

    for (const p of data) {
        scanned++;
        const catName = p.categories?.name || '';
        const patch = {};

        if (!p.gender) {
            let g = null;
            if (p.source_url?.includes('banananina.co.id')) {
                g = inferGenderFromBanananinaProduct(p.source_url);
            } else if (p.source_url?.includes('yoogiscloset.com')) {
                g = inferGenderFromYoogisProduct(p.title, catName);
            }
            if (!g) g = inferGender(p.title, catName);
            if (g) patch.gender = g;
        }

        const slug = resolveProductCategorySlug(p.title, catName, catName);
        const wantId = slug ? catMap.get(slug) : null;
        if (wantId && p.category_id !== wantId) {
            patch.category_id = wantId;
        }

        if (Object.keys(patch).length) {
            const { error: uErr } = await supabase.from('products').update(patch).eq('id', p.id);
            if (!uErr) updated++;
        }
    }

    if (data.length < PAGE) break;
    from += PAGE;
    process.stdout.write(`\rScanned ${scanned}, updated ${updated}...`);
}

console.log(`\nDone. Scanned ${scanned}, updated ${updated}.`);
