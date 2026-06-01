import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/supabase/server';
import { runScrape } from '@luxe/scraper/run-scrape';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request) {
    const admin = await getCurrentAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.VERCEL) {
        return NextResponse.json(
            {
                success: false,
                message: 'Scraper tidak bisa dijalankan di Vercel. Jalankan di laptop lokal (Laragon): buka http://localhost:3000/admin/scraper atau pakai npm run scrape di terminal.',
            },
            { status: 503 }
        );
    }

    try {
        const body = await request.json();
        const result = await runScrape({
            url: body.url,
            headless: body.headless !== false,
            maxPages: body.maxPages,
            gender: body.gender,
            brand: body.brand,
            categoryHint: body.categoryHint,
            partialScrape: !!body.partialScrape,
            skipDetail: !!body.skipDetail,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, message: result.message, error_type: result.error_type, session_id: result.session_id },
                { status: 500 }
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { success: false, message: error.message || 'Scrape gagal' },
            { status: 500 }
        );
    }
}
