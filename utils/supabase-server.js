import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server-side Supabase client bound to the request cookies (App Router).
// Used in server components / route handlers to read the logged-in admin session.
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // setAll called from a Server Component — safe to ignore,
                        // middleware refreshes the session.
                    }
                },
            },
        }
    );
}

/**
 * Returns the current logged-in admin profile (with role name) or null.
 */
export async function getCurrentAdmin() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name, role_id, roles(name)')
        .eq('id', user.id)
        .maybeSingle();

    return {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || null,
        role: profile?.roles?.name || 'Staff',
    };
}

/**
 * Guard for admin API route handlers. Returns the admin or null.
 * Use in route handlers: `const admin = await requireAdmin(); if (!admin) return 401`.
 */
export async function requireAdmin() {
    return getCurrentAdmin();
}
