'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const NAV = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '▦' },
    { href: '/admin/products', label: 'Produk', icon: '▤' },
    { href: '/admin/orders', label: 'Pesanan', icon: '🛒' },
    { href: '/admin/categories', label: 'Kategori', icon: '◳' },
    { href: '/admin/brands', label: 'Brand', icon: '◈' },
    { href: '/admin/scraper', label: 'Scraper', icon: '⟳' },
    { href: '/admin/scrape-logs', label: 'Log Scrape', icon: '☰' },
    { href: '/admin/errors', label: 'Error Log', icon: '⚠' },
    { href: '/admin/settings', label: 'Pengaturan', icon: '⚙' },
];

export default function AdminShell({ admin, children }) {
    const pathname = usePathname();
    const router = useRouter();
    const [branding, setBranding] = useState({ store_name: 'HEY BLOSSOM', store_logo_url: '' });

    useEffect(() => {
        fetch('/api/admin/settings')
            .then((r) => r.json())
            .then((d) => {
                if (d.success) {
                    setBranding({
                        store_name: d.settings.store_name || 'HEY BLOSSOM',
                        store_logo_url: d.settings.store_logo_url || '',
                    });
                }
            })
            .catch(() => {});
    }, []);

    async function logout() {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace('/admin/login');
        router.refresh();
    }

    return (
        <div className="admin-shell" style={{ minHeight: '100vh', background: '#f4f4f5', color: '#0c0c0c', fontFamily: 'Outfit, sans-serif' }}>
            <aside className="admin-sidebar admin-sidebar--blue">
                <div className="admin-brand" style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                    {branding.store_logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={branding.store_logo_url} alt={branding.store_name} style={{ height: 36, width: 'auto', objectFit: 'contain', maxWidth: '100%' }} />
                    ) : (
                        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                            {branding.store_name}
                        </div>
                    )}
                    <div style={{ fontSize: '0.65rem', letterSpacing: '2px', color: '#F6BFD1', textTransform: 'uppercase', marginTop: 6 }}>
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
                                className={active ? 'admin-nav-link active' : 'admin-nav-link'}
                            >
                                <span style={{ width: 18, textAlign: 'center' }}>{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="admin-userbox" style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                    <div className="admin-userinfo" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{admin?.full_name || admin?.email}</div>
                    <div className="admin-userinfo" style={{ fontSize: '0.7rem', color: '#F6BFD1', marginBottom: 10 }}>{admin?.role}</div>
                    <button type="button" className="admin-logout-btn" onClick={logout}>
                        Keluar
                    </button>
                </div>
            </aside>

            <main className="admin-main" style={{ flex: 1, padding: '2rem', overflowX: 'hidden', minWidth: 0, fontFamily: 'Outfit, sans-serif' }}>{children}</main>
        </div>
    );
}
