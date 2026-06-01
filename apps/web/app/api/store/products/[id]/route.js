import { NextResponse } from 'next/server';
import { getStoreProduct } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
    try {
        const { id: idParam } = await params;
        const id = Number(idParam);
        if (!id || Number.isNaN(id)) {
            return NextResponse.json({ success: false, error: 'Invalid product id' }, { status: 400 });
        }

        const product = await getStoreProduct(id);
        if (!product) {
            return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, product });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
