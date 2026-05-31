import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@luxe/shared/supabase';
import { countProductsBy } from '@luxe/shared/db';

export const dynamic = 'force-dynamic';

async function loadLabels(supabase) {
    const { data } = await supabase.from('settings').select('value').eq('key', 'source_labels').maybeSingle();
    if (!data?.value) return {};
    try {
        const map = JSON.parse(data.value);
        return map && typeof map === 'object' ? map : {};
    } catch {
        return {};
    }
}

// GET — distinct sources (+ product counts) merged with their saved labels
export async function GET() {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    try {
        const supabase = getSupabaseAdmin();
        const counts = await countProductsBy('source');
        const labels = await loadLabels(supabase);
        const sources = Object.keys(counts)
            .sort()
            .map((source) => ({
                source,
                count: counts[source] || 0,
                label: labels[source] || '',
            }));
        return NextResponse.json({ success: true, sources });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PATCH — save the full { source: label } mapping (empty label = use original)
export async function PATCH(request) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    try {
        const body = await request.json();
        const incoming = body?.labels && typeof body.labels === 'object' ? body.labels : {};

        // keep only non-empty, trimmed labels
        const clean = {};
        for (const [k, v] of Object.entries(incoming)) {
            const label = String(v ?? '').trim();
            if (label) clean[k] = label;
        }

        const supabase = getSupabaseAdmin();
        const { error } = await supabase
            .from('settings')
            .upsert(
                { key: 'source_labels', value: JSON.stringify(clean), updated_at: new Date().toISOString() },
                { onConflict: 'key' }
            );
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, labels: clean });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
