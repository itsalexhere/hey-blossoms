import { NextResponse } from 'next/server';
import { getStoreProducts, priceBucketToRange } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const bucket = searchParams.get('priceBucket') || '';
        const range = bucket ? priceBucketToRange(bucket) : { min: null, max: null };

        const result = await getStoreProducts({
            category: searchParams.get('category') || undefined,
            brand: searchParams.get('brand') || undefined,
            source: searchParams.get('source') || undefined,
            gender: searchParams.get('gender') || undefined,
            ids: searchParams.get('ids') || undefined,
            minPrice: searchParams.get('minPrice') ?? range.min,
            maxPrice: searchParams.get('maxPrice') ?? range.max,
            sort: searchParams.get('sort') || 'newest',
            search: searchParams.get('search') || undefined,
            limit: parseInt(searchParams.get('limit') || '24'),
            offset: parseInt(searchParams.get('offset') || '0'),
        });
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
