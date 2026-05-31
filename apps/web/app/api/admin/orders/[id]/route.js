import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getOrderById } from '@luxe/shared/orders';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const order = await getOrderById(Number(id));
        if (!order) return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });

        return NextResponse.json({ success: true, order });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
