import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@luxe/shared/supabase';
import { getMarkupPercent, computeSellingPrice } from '@/lib/storefront';
import { hasGenderColumn } from '@luxe/shared/db';

export const dynamic = 'force-dynamic';

// GET /api/admin/products — full product list (shows REAL original price for admin)
export async function GET(request) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const source = searchParams.get('source') || '';
        const search = searchParams.get('search') || '';
        const stock = searchParams.get('stock') || '';
        const active = searchParams.get('active') || '';
        const brandId = searchParams.get('brand_id') || '';
        const categoryId = searchParams.get('category_id') || '';
        const gender = searchParams.get('gender') || '';
        const sort = searchParams.get('sort') || 'newest';
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        const supabase = getSupabaseAdmin();
        const markup = await getMarkupPercent();
        const genderSupported = await hasGenderColumn(supabase);

        const productFields = genderSupported
            ? 'id, source, source_url, title, gender, original_price, markup_addon_idr, currency, stock_status, stock_qty, is_active, scraped_at, created_at, updated_at, brands(id,name), categories(id,name), product_images(image_url, position)'
            : 'id, source, source_url, title, original_price, markup_addon_idr, currency, stock_status, stock_qty, is_active, scraped_at, created_at, updated_at, brands(id,name), categories(id,name), product_images(image_url, position)';

        let q = supabase
            .from('products')
            .select(productFields, { count: 'exact' });

        // Sorting (price sorts use original_price; markup is uniform so order is preserved)
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

        q = q.range(offset, offset + limit - 1);

        const { data, count, error } = await q;
        if (error) throw new Error(error.message);

        const products = (data || []).map((p) => {
            const imgs = (p.product_images || []).sort((a, b) => a.position - b.position);
            return {
                id: p.id,
                source: p.source,
                source_url: p.source_url,
                title: p.title,
                brand: p.brands?.name || null,
                category: p.categories?.name || null,
                gender: genderSupported ? (p.gender || null) : null,
                original_price: Number(p.original_price || 0),
                markup_addon_idr: p.markup_addon_idr != null ? Number(p.markup_addon_idr) : null,
                selling_price: computeSellingPrice(p.original_price, markup, p.markup_addon_idr),
                currency: p.currency,
                stock_status: p.stock_status,
                stock_qty: p.stock_qty,
                is_active: p.is_active,
                image_url: imgs[0]?.image_url || null,
                scraped_at: p.scraped_at,
                created_at: p.created_at,
                updated_at: p.updated_at,
            };
        });

        return NextResponse.json({
            success: true,
            products,
            total: count ?? products.length,
            markup,
            gender_supported: genderSupported,
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
