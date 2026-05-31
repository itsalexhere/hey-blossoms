import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@luxe/shared/supabase';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/products/[id] — edit original price, stock, active, brand, category
export async function PATCH(request, { params }) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const body = await request.json();
        const patch = { updated_at: new Date().toISOString() };

        if (body.original_price != null) patch.original_price = Number(body.original_price);
        if (body.stock_status != null) patch.stock_status = body.stock_status;
        if (body.stock_qty !== undefined) patch.stock_qty = body.stock_qty === null ? null : Number(body.stock_qty);
        if (body.is_active != null) patch.is_active = !!body.is_active;
        if (body.title != null) patch.title = body.title;
        if (body.brand_id !== undefined) patch.brand_id = body.brand_id;
        if (body.category_id !== undefined) patch.category_id = body.category_id;
        if (body.description !== undefined) patch.description = body.description;

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.from('products').update(patch).eq('id', id).select().maybeSingle();
        if (error) throw new Error(error.message);

        return NextResponse.json({ success: true, product: data });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE /api/admin/products/[id]
export async function DELETE(request, { params }) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
