import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getOrders, updateOrderStatus, ORDER_STATUSES } from '@luxe/shared/orders';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const result = await getOrders({
            status: searchParams.get('status') || '',
            search: searchParams.get('search') || '',
            limit: parseInt(searchParams.get('limit') || '50'),
            offset: parseInt(searchParams.get('offset') || '0'),
        });

        return NextResponse.json({
            success: true,
            orders: result.orders,
            total: result.total,
            statuses: ORDER_STATUSES,
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { id, status } = body;
        if (!id) return NextResponse.json({ success: false, error: 'ID wajib' }, { status: 400 });

        const order = await updateOrderStatus(id, status);
        return NextResponse.json({ success: true, order });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
