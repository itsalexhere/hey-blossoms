/**
 * Remove products outside VIP scope + invalid rows (N/A price, ZZER).
 * Run: node scripts/cleanup-vip-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    VIP_SOURCES,
    VIP_BRANDS,
    VIP_BRAND_ALIASES,
    normalizeVipBrand,
    isVipSource,
} from '../packages/shared/src/vip-config.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

function slugify(s) {
    return String(s || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function isZzerProduct(p) {
    const hay = `${p.source || ''} ${p.title || ''} ${p.source_url || ''}`;
    return /zzer/i.test(hay);
}

function isNaPrice(p) {
    return Number(p.original_price || 0) <= 0;
}

async function fetchAllProducts() {
    const pageSize = 1000;
    const all = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('products')
            .select('id, source, title, source_url, original_price, brand_id, brands(name)')
            .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        if (!data?.length) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return all;
}

console.log('VIP cleanup — sources:', VIP_SOURCES.join(', '));
console.log('VIP cleanup — brands:', VIP_BRANDS.join(', '));

const brandIdByName = {};
for (const name of VIP_BRANDS) {
    const { data: existing } = await supabase.from('brands').select('id, name').eq('name', name).maybeSingle();
    if (existing) {
        brandIdByName[name] = existing.id;
    } else {
        const { data: inserted, error } = await supabase
            .from('brands')
            .insert({ name, slug: slugify(name) })
            .select('id')
            .single();
        if (error) throw new Error(error.message);
        brandIdByName[name] = inserted.id;
        console.log('Created brand:', name);
    }
}

for (const [alias, canonical] of Object.entries(VIP_BRAND_ALIASES)) {
    const { data: aliasRow } = await supabase.from('brands').select('id').eq('name', alias).maybeSingle();
    if (!aliasRow) continue;
    const targetId = brandIdByName[canonical];
    const { data: merged } = await supabase.from('products').update({ brand_id: targetId }).eq('brand_id', aliasRow.id).select('id');
    console.log(`Merged brand "${alias}" → "${canonical}" (${merged?.length ?? 0} products)`);
    await supabase.from('brands').delete().eq('id', aliasRow.id);
}

const allProducts = await fetchAllProducts();
console.log(`Loaded ${allProducts.length} products from DB`);

const toDelete = new Set();
const reasons = { non_vip_source: 0, non_vip_brand: 0, na_price: 0, zzer: 0 };
const toFixBrand = [];

for (const p of allProducts) {
    const brandName = p.brands?.name || null;
    const normalized = normalizeVipBrand(brandName);
    let remove = false;

    if (isZzerProduct(p)) {
        remove = true;
        reasons.zzer++;
    }
    if (!isVipSource(p.source)) {
        remove = true;
        reasons.non_vip_source++;
    }
    if (!normalized) {
        remove = true;
        reasons.non_vip_brand++;
    }
    if (isNaPrice(p)) {
        remove = true;
        reasons.na_price++;
    }

    if (remove) {
        toDelete.add(p.id);
        continue;
    }

    const wantId = brandIdByName[normalized];
    if (wantId && p.brand_id !== wantId) {
        toFixBrand.push({ id: p.id, brand_id: wantId });
    }
}

for (const row of toFixBrand) {
    await supabase.from('products').update({ brand_id: row.brand_id }).eq('id', row.id);
}
console.log(`Normalized brand_id on ${toFixBrand.length} products`);

const deleteIds = [...toDelete];
for (const part of chunk(deleteIds, 200)) {
    const { error } = await supabase.from('products').delete().in('id', part);
    if (error) throw new Error(error.message);
}

console.log(`Deleted ${deleteIds.length} products:`);
console.log(`  - non-VIP source: ${reasons.non_vip_source} (may overlap)`);
console.log(`  - non-VIP brand: ${reasons.non_vip_brand} (may overlap)`);
console.log(`  - N/A price (0): ${reasons.na_price} (may overlap)`);
console.log(`  - ZZER: ${reasons.zzer} (may overlap)`);

const { data: allBrands } = await supabase.from('brands').select('id, name');
let deletedBrands = 0;
for (const b of allBrands || []) {
    if (!VIP_BRANDS.includes(b.name)) {
        await supabase.from('products').update({ brand_id: null }).eq('brand_id', b.id);
        await supabase.from('brands').delete().eq('id', b.id);
        deletedBrands++;
    }
}
console.log(`Deleted ${deletedBrands} non-VIP brands`);

const { count: remaining } = await supabase.from('products').select('id', { count: 'exact', head: true });
console.log(`Done. ${remaining ?? 0} products remaining.`);
