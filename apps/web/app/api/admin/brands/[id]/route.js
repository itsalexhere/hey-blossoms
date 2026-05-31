import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@luxe/shared/supabase';

export const dynamic = 'force-dynamic';

function slugify(s) {
    return String(s || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

export async function PATCH(request, { params }) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    try {
        const { id } = await params;
        const body = await request.json();
        const patch = {};
        if (body.name != null) {
            patch.name = body.name;
            patch.slug = slugify(body.name);
        }
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.from('brands').update(patch).eq('id', id).select().maybeSingle();
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, brand: data });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    try {
        const { id } = await params;
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from('brands').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
