import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Protect all /admin routes (except /admin/login). Refreshes the Supabase
// session cookie on every request so server components see a valid session.
export async function middleware(request) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value);
                        response = NextResponse.next({ request });
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        );
                    });
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    const isLogin = pathname === '/admin/login';
    const isAdmin = pathname.startsWith('/admin');

    // Not logged in + visiting a protected admin page -> redirect to login
    if (isAdmin && !isLogin && !user) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin/login';
        url.searchParams.set('redirect', pathname);
        return NextResponse.redirect(url);
    }

    // Already logged in + visiting login page -> go to dashboard
    if (isLogin && user) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin/dashboard';
        url.search = '';
        return NextResponse.redirect(url);
    }

    return response;
}

export const config = {
    matcher: ['/admin/:path*'],
};
