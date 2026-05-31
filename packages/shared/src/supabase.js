import { createClient } from '@supabase/supabase-js';

// ============================================================
// Supabase clients
//  - supabaseAnon:  public reads (storefront). Respects RLS.
//  - supabaseAdmin: server-only writes (scraper + admin). Bypasses RLS.
//                   NEVER import supabaseAdmin into client components.
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _anon = null;
let _admin = null;

/** Public client (anon key) — safe for browser + public reads. */
export function getSupabaseAnon() {
    if (!SUPABASE_URL || !ANON_KEY) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Check .env.local.'
        );
    }
    if (!_anon) {
        _anon = createClient(SUPABASE_URL, ANON_KEY, {
            auth: { persistSession: false },
        });
    }
    return _anon;
}

/** Server-only admin client (service role key) — bypasses RLS for writes. */
export function getSupabaseAdmin() {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Check .env.local.'
        );
    }
    if (!_admin) {
        _admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    return _admin;
}
