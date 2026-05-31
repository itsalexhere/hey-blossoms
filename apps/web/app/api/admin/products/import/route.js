import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@luxe/shared/supabase';

export const dynamic = 'force-dynamic';

function slugify(s) {
    return String(s || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function parseBool(val) {
    if (val == null || val === '') return undefined;
    if (typeof val === 'boolean') return val;
    const s = String(val).trim().toLowerCase();
    if (['false', '0', 'no', 'tidak', 'n'].includes(s)) return false;
    if (['true', '1', 'yes', 'ya', 'y'].includes(s)) return true;
    return Boolean(val);
}

async function resolveCategoryId(supabase, nameOrSlug) {
    if (!nameOrSlug) return null;
    const slug = slugify(nameOrSlug);
    const { data: bySlug } = await supabase.from('categories').select('id').eq('slug', slug).maybeSingle();
    if (bySlug) return bySlug.id;
    const { data: byName } = await supabase.from('categories').select('id').ilike('name', nameOrSlug).maybeSingle();
    return byName?.id ?? null;
}

export async function POST(request) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const form = await request.formData();
        const file = form.get('file');
        if (!file || typeof file.arrayBuffer !== 'function') {
            return NextResponse.json({ success: false, error: 'File wajib diupload' }, { status: 400 });
        }

        const buf = Buffer.from(await file.arrayBuffer());
        const wb = XLSX.read(buf, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        const supabase = getSupabaseAdmin();
        let updated = 0;
        let skipped = 0;
        const errors = [];

        for (const row of rows) {
            const id = row.id ? Number(row.id) : null;
            const sourceUrl = row.source_url || row.sourceUrl;
            if (!id && !sourceUrl) {
                skipped++;
                errors.push({ row: row.title || '?', message: 'Baris tanpa id atau source_url' });
                continue;
            }

            const patch = { updated_at: new Date().toISOString() };
            if (row.original_price != null && row.original_price !== '') patch.original_price = Number(row.original_price);
            if (row.stock_status) patch.stock_status = String(row.stock_status);
            if (row.gender) patch.gender = String(row.gender).toLowerCase();
            const activeVal = parseBool(row.is_active);
            if (activeVal !== undefined) patch.is_active = activeVal;
            if (row.stock_qty != null && row.stock_qty !== '') patch.stock_qty = Number(row.stock_qty);

            const catKey = row.category_slug || row.category;
            if (catKey) {
                const cid = await resolveCategoryId(supabase, catKey);
                if (cid) patch.category_id = cid;
                else errors.push({ id, source_url: sourceUrl, message: `Kategori "${catKey}" tidak ditemukan` });
            }

            let q = supabase.from('products').update(patch);
            if (id) q = q.eq('id', id);
            else q = q.eq('source_url', sourceUrl);

            const { data, error } = await q.select('id');
            if (error) {
                errors.push({ id, source_url: sourceUrl, message: error.message });
            } else if (!data?.length) {
                skipped++;
                errors.push({ id, source_url: sourceUrl, message: 'Produk tidak ditemukan di database' });
            } else {
                updated++;
            }
        }

        return NextResponse.json({ success: true, updated, skipped, errors: errors.slice(0, 20), total_rows: rows.length });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
