import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@luxe/shared/supabase';
import { countProductsBy } from '@luxe/shared/db';
import { VIP_BRANDS, normalizeVipBrand } from '@luxe/shared/vip-config';

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
        const { data: brands, error } = await supabase.from('brands').select('*').order('name');
        if (error) throw new Error(error.message);

        const counts = await countProductsBy('brand_id');

        return NextResponse.json({
            success: true,
            brands: (brands || [])
                .filter((b) => VIP_BRANDS.includes(b.name))
                .map((b) => ({ ...b, product_count: counts[b.id] || 0 })),
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    try {
        const { name } = await request.json();
        if (!name) return NextResponse.json({ success: false, error: 'Nama wajib diisi' }, { status: 400 });
        const canonical = normalizeVipBrand(name);
        if (!canonical) {
            return NextResponse.json({
                success: false,
                error: `Brand tidak diizinkan. Hanya: ${VIP_BRANDS.join(', ')}`,
            }, { status: 400 });
        }
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.from('brands').insert({ name: canonical, slug: slugify(canonical) }).select().single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, brand: data });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
