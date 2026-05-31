import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@luxe/shared/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    try {
        const { searchParams } = new URL(request.url);
        const source = searchParams.get('source') || '';
        const status = searchParams.get('status') || '';
        const limit = parseInt(searchParams.get('limit') || '50');

        const supabase = getSupabaseAdmin();
        let q = supabase.from('scrape_logs').select('*').order('started_at', { ascending: false }).limit(limit);
        if (source) q = q.eq('source', source);
        if (status) q = q.eq('status', status);

        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, logs: data || [] });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
