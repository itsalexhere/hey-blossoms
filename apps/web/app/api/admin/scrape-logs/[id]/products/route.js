import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getScrapeLogProducts } from '@luxe/shared/db';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const { id: idParam } = await params;
        const logId = Number(idParam);
        if (!logId || Number.isNaN(logId)) {
            return NextResponse.json({ success: false, error: 'Invalid log id' }, { status: 400 });
        }

        const result = await getScrapeLogProducts(logId);
        if (!result) {
            return NextResponse.json({ success: false, error: 'Log not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            log: result.log,
            match_source: result.source,
            products: result.products,
            total: result.products.length,
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
