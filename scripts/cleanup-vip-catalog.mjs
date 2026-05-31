/**
 * Remove products/brands outside VIP scope (4 sources × 3 brands).
 * Run once: node scripts/cleanup-vip-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIP_SOURCES, VIP_BRANDS, VIP_BRAND_ALIASES, normalizeVipBrand, isVipSource } from '../utils/vip-config.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = fs.readFileSync(path.join(root, '.env.local'), 'utf-8');
for (const line of content.split(/\r?\n/)) {
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

const { data: allProducts, error: listErr } = await supabase.from('products').select('id, source, brand_id, brands(name)');
if (listErr) throw new Error(listErr.message);

const toDelete = [];
const toFixBrand = [];

for (const p of allProducts || []) {
    const brandName = p.brands?.name || null;
    const normalized = normalizeVipBrand(brandName);
    if (!isVipSource(p.source) || !normalized) {
        toDelete.push(p.id);
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

for (const part of chunk(toDelete, 200)) {
    const { error } = await supabase.from('products').delete().in('id', part);
    if (error) throw new Error(error.message);
}
console.log(`Deleted ${toDelete.length} products (non-VIP source or brand)`);

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
