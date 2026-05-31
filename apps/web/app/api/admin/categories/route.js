import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@luxe/shared/supabase';
import { countProductsBy } from '@luxe/shared/db';

export const dynamic = 'force-dynamic';

function slugify(s) {
    return String(s || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

export async function GET() {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    try {
        const supabase = getSupabaseAdmin();
        const { data: cats, error } = await supabase.from('categories').select('*').order('name');
        if (error) throw new Error(error.message);

        const counts = await countProductsBy('category_id');

        const categories = (cats || []).map((c) => ({ ...c, product_count: counts[c.id] || 0 }));
        return NextResponse.json({ success: true, categories });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    try {
        const { name, parent_id } = await request.json();
        if (!name) return NextResponse.json({ success: false, error: 'Nama wajib diisi' }, { status: 400 });
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('categories')
            .insert({ name, slug: slugify(name), parent_id: parent_id || null })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, category: data });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
