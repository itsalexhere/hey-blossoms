import { NextResponse } from 'next/server';
import { createOrder } from '@luxe/shared/orders';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { customer_name, phone, address, notes, items } = body;

        if (!phone || !/^[\d\s+\-()]{8,20}$/.test(String(phone).trim())) {
            return NextResponse.json({ success: false, error: 'Format no. HP tidak valid' }, { status: 400 });
        }

        const order = await createOrder({ customer_name, phone, address, notes, items });

        return NextResponse.json({
            success: true,
            order_number: order.order_number,
            order_id: order.id,
            total_amount: order.total_amount,
            item_count: order.item_count,
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
