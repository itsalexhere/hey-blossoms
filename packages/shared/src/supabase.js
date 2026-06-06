import { createClient } from '@supabase/supabase-js';

// ============================================================
// Supabase clients
//  - supabaseAnon:  public reads (storefront). Respects RLS.
//  - supabaseAdmin: server-only writes (scraper + admin). Bypasses RLS.
//                   NEVER import supabaseAdmin into client components.
// ============================================================

let _anon = null;
let _admin = null;

/** Public client (anon key) — safe for browser + public reads. */
export function getSupabaseAnon() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Check .env.local.'
        );
    }
    if (!_anon) {
        _anon = createClient(url, anonKey, {
            auth: { persistSession: false },
        });
    }
    return _anon;
}

/** Server-only admin client (service role key) — bypasses RLS for writes. */
export function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Check .env.local.'
        );
    }
    if (!_admin) {
        _admin = createClient(url, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    return _admin;
}
