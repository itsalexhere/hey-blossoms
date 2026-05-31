import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@luxe/shared/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.from('settings').select('*');
        if (error) throw new Error(error.message);
        const settings = {};
        (data || []).forEach((r) => (settings[r.key] = r.value));
        return NextResponse.json({ success: true, settings });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    try {
        const body = await request.json();
        const supabase = getSupabaseAdmin();
        const rows = Object.entries(body).map(([key, value]) => ({
            key,
            value: String(value),
            updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
