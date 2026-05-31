import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@luxe/shared/supabase';
import { hasGenderColumn } from '@luxe/shared/db';
import { getMarkupPercent, applyMarkup } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

async function fetchAllFiltered(searchParams) {
    const supabase = getSupabaseAdmin();
    const markup = await getMarkupPercent();
    const genderSupported = await hasGenderColumn(supabase);
    const source = searchParams.get('source') || '';
    const search = searchParams.get('search') || '';
    const stock = searchParams.get('stock') || '';
    const active = searchParams.get('active') || '';
    const brandId = searchParams.get('brand_id') || '';
    const categoryId = searchParams.get('category_id') || '';
    const gender = searchParams.get('gender') || '';
    const sort = searchParams.get('sort') || 'newest';

    let q = supabase
        .from('products')
        .select(
            'id, source, source_url, title, gender, original_price, currency, stock_status, stock_qty, is_active, scraped_at, brands(name), categories(name, slug), product_images(image_url, position)'
        );

    if (sort === 'price_asc') q = q.order('original_price', { ascending: true });
    else if (sort === 'price_desc') q = q.order('original_price', { ascending: false });
    else if (sort === 'title_asc') q = q.order('title', { ascending: true });
    else q = q.order('scraped_at', { ascending: false });

    if (source) q = q.ilike('source', `%${source}%`);
    if (search) q = q.ilike('title', `%${search}%`);
    if (stock) q = stock === 'available' ? q.eq('stock_status', 'available') : q.neq('stock_status', 'available');
    if (active === 'true') q = q.eq('is_active', true);
    if (active === 'false') q = q.eq('is_active', false);
    if (brandId) q = q.eq('brand_id', brandId);
    if (categoryId) q = q.eq('category_id', categoryId);
    if (genderSupported && gender === 'men') q = q.eq('gender', 'men');
    else if (genderSupported && gender === 'women') q = q.eq('gender', 'women');
    else if (genderSupported && gender === 'unset') q = q.is('gender', null);

    const all = [];
    let from = 0;
    const PAGE = 1000;
    for (;;) {
        const { data, error } = await q.range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        for (const p of data || []) {
            const imgs = (p.product_images || []).sort((a, b) => a.position - b.position);
            all.push({
                id: p.id,
                title: p.title,
                brand: p.brands?.name || '',
                category: p.categories?.name || '',
                category_slug: p.categories?.slug || '',
                gender: p.gender || '',
                original_price: Number(p.original_price || 0),
                selling_price: applyMarkup(p.original_price, markup),
                stock_status: p.stock_status,
                stock_qty: p.stock_qty ?? '',
                is_active: p.is_active,
                source: p.source || '',
                source_url: p.source_url,
                image_url: imgs[0]?.image_url || '',
            });
        }
        if (!data || data.length < PAGE) break;
        from += PAGE;
    }
    return all;
}

export async function GET(request) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'xlsx';
        const rows = await fetchAllFiltered(searchParams);

        if (format === 'csv') {
            const header = Object.keys(rows[0] || { id: '' }).join(',');
            const body = rows.map((r) =>
                Object.values(r)
                    .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
                    .join(',')
            );
            const csv = [header, ...body].join('\n');
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="products-export.csv"',
                },
            });
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Products');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return new NextResponse(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="products-export.xlsx"',
            },
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
