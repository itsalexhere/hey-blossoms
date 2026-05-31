import { NextResponse } from 'next/server';
import {
    getStoreCategoryGroups,
    getStoreCategories,
    getStoreBrands,
    getStoreSources,
    getStoreBranding,
    getSourceLabels,
    PRICE_BUCKETS,
} from '@/lib/storefront';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [categoryGroups, categories, brands, sources, branding, sourceLabels] = await Promise.all([
            getStoreCategoryGroups(),
            getStoreCategories(),
            getStoreBrands(),
            Promise.resolve(getStoreSources()),
            getStoreBranding(),
            getSourceLabels(),
        ]);
        return NextResponse.json({
            success: true,
            categories,
            categoryGroups,
            brands,
            sources,
            branding,
            sourceLabels,
            priceBuckets: PRICE_BUCKETS,
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
