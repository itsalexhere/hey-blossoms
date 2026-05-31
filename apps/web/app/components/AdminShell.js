'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const NAV = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '▦' },
    { href: '/admin/products', label: 'Produk', icon: '▤' },
    { href: '/admin/orders', label: 'Pesanan', icon: '🛒' },
    { href: '/admin/categories', label: 'Kategori', icon: '◳' },
    { href: '/admin/brands', label: 'Brand', icon: '◈' },
    { href: '/admin/source-labels', label: 'Label Sumber', icon: '🏷' },
    { href: '/admin/scraper', label: 'Scraper', icon: '⟳' },
    { href: '/admin/scrape-logs', label: 'Log Scrape', icon: '☰' },
    { href: '/admin/errors', label: 'Error Log', icon: '⚠' },
    { href: '/admin/settings', label: 'Pengaturan', icon: '⚙' },
];

export default function AdminShell({ admin, children }) {
    const pathname = usePathname();
    const router = useRouter();

    async function logout() {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace('/admin/login');
        router.refresh();
    }

    return (
        <div className="admin-shell" style={{ minHeight: '100vh', background: '#f4f4f5', color: '#0c0c0c' }}>
            <aside
                className="admin-sidebar"
                style={{
                    background: '#1d1d1f',
                    color: '#fff',
                }}
            >
                <div className="admin-brand" style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', fontWeight: 700 }}>
                        LUXE<span style={{ color: '#c5a880' }}>.</span>
                    </div>
                    <div style={{ fontSize: '0.65rem', letterSpacing: '2px', color: '#c5a880', textTransform: 'uppercase' }}>
                        Admin Panel
                    </div>
                </div>

                <nav className="admin-nav" style={{ flex: 1, padding: '1rem 0.75rem' }}>
                    {NAV.map((item) => {
                        const active = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '0.7rem 1rem',
                                    borderRadius: 8,
                                    marginBottom: 4,
                                    textDecoration: 'none',
                                    color: active ? '#1d1d1f' : 'rgba(255,255,255,0.75)',
                                    background: active ? '#c5a880' : 'transparent',
                                    fontWeight: active ? 600 : 400,
                                    fontSize: '0.9rem',
                                }}
                            >
                                <span style={{ width: 18, textAlign: 'center' }}>{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="admin-userbox" style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="admin-userinfo" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{admin?.full_name || admin?.email}</div>
                    <div className="admin-userinfo" style={{ fontSize: '0.7rem', color: '#c5a880', marginBottom: 10 }}>{admin?.role}</div>
                    <button
                        className="admin-logout-btn"
                        onClick={logout}
                        style={{
                            width: '100%',
                            padding: '0.6rem',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'transparent',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                        }}
                    >
                        Keluar
                    </button>
                </div>
            </aside>

            <main className="admin-main" style={{ flex: 1, padding: '2rem', overflowX: 'hidden', minWidth: 0 }}>{children}</main>
        </div>
    );
}
