import { NextResponse } from 'next/server';
import {
    getStoreCategoryGroups,
    getStoreCategories,
    getStoreBrands,
    getStoreSources,
    getStoreBranding,
    getSourceLabels,
    getWhatsAppSettings,
    PRICE_BUCKETS,
} from '@/lib/storefront';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [categoryGroups, categories, brands, sources, branding, sourceLabels, whatsapp] = await Promise.all([
            getStoreCategoryGroups(),
            getStoreCategories(),
            getStoreBrands(),
            Promise.resolve(getStoreSources()),
            getStoreBranding(),
            getSourceLabels(),
            getWhatsAppSettings(),
        ]);
        return NextResponse.json({
            success: true,
            categories,
            categoryGroups,
            brands,
            sources,
            branding,
            sourceLabels,
            whatsapp,
            priceBuckets: PRICE_BUCKETS,
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
