import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@luxe/shared/supabase';
import { getMarkupPercent, computeSellingPrice } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

export async function GET() {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const supabase = getSupabaseAdmin();
        const markup = await getMarkupPercent();

        const countOf = async (table, filter) => {
            let q = supabase.from(table).select('*', { count: 'exact', head: true });
            if (filter) q = filter(q);
            const { count } = await q;
            return count || 0;
        };

        const [totalProducts, activeProducts, soldOut, brands, categories] = await Promise.all([
            countOf('products'),
            countOf('products', (q) => q.eq('is_active', true)),
            countOf('products', (q) => q.neq('stock_status', 'available')),
            countOf('brands'),
            countOf('categories'),
        ]);

        // total inventory value (original) for admin
        const { data: priceRows } = await supabase
            .from('products')
            .select('original_price, markup_addon_idr')
            .eq('is_active', true);
        const inventoryOriginal = (priceRows || []).reduce((s, r) => s + Number(r.original_price || 0), 0);
        const inventorySelling = (priceRows || []).reduce(
            (s, r) => s + computeSellingPrice(r.original_price, markup, r.markup_addon_idr),
            0
        );

        const { data: recentLogs } = await supabase
            .from('scrape_logs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(5);

        const { data: bySource } = await supabase.from('products').select('source');
        const sourceCounts = {};
        (bySource || []).forEach((r) => {
            sourceCounts[r.source || 'Unknown'] = (sourceCounts[r.source || 'Unknown'] || 0) + 1;
        });

        return NextResponse.json({
            success: true,
            stats: {
                totalProducts,
                activeProducts,
                soldOut,
                brands,
                categories,
                inventoryOriginal,
                inventorySelling,
                markup,
            },
            recentLogs: recentLogs || [],
            sourceCounts,
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
