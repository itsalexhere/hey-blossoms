import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getOrdersForExport } from '@luxe/shared/orders';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const rows = await getOrdersForExport({
            status: searchParams.get('status') || '',
            search: searchParams.get('search') || '',
        });

        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ order_number: '' }]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Orders');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="orders-export.xlsx"',
            },
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
