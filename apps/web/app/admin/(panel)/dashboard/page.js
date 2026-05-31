'use client';
import { useEffect, useState } from 'react';
import { AC, PageTitle, Card, formatIDR, StatusBadge } from '../../../components/admin-ui';

export default function DashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/admin/stats')
            .then((r) => r.json())
            .then((d) => d.success && setData(d))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div style={{ color: AC.muted }}>Memuat dashboard...</div>;
    if (!data) return <div style={{ color: AC.danger }}>Gagal memuat data.</div>;

    const s = data.stats;
    const cards = [
        { label: 'Total Produk', value: s.totalProducts.toLocaleString('id-ID'), icon: '▤' },
        { label: 'Produk Aktif', value: s.activeProducts.toLocaleString('id-ID'), icon: '✓' },
        { label: 'Stok Habis', value: s.soldOut.toLocaleString('id-ID'), icon: '✕', accent: AC.danger },
        { label: 'Brand', value: s.brands.toLocaleString('id-ID'), icon: '◈' },
        { label: 'Kategori', value: s.categories.toLocaleString('id-ID'), icon: '◳' },
    ];

    return (
        <div>
            <PageTitle title="Dashboard" subtitle={`Markup aktif: ${s.markup}%`} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {cards.map((c) => (
                    <Card key={c.label}>
                        <div style={{ fontSize: '1.5rem', marginBottom: 6, color: c.accent || AC.gold }}>{c.icon}</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{c.value}</div>
                        <div style={{ color: AC.muted, fontSize: '0.85rem' }}>{c.label}</div>
                    </Card>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <Card>
                    <div style={{ color: AC.muted, fontSize: '0.85rem', marginBottom: 6 }}>Nilai Inventaris (Harga Asli)</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{formatIDR(s.inventoryOriginal)}</div>
                </Card>
                <Card style={{ borderColor: AC.gold }}>
                    <div style={{ color: AC.muted, fontSize: '0.85rem', marginBottom: 6 }}>Nilai Jual (Setelah Markup {s.markup}%)</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: AC.gold }}>{formatIDR(s.inventorySelling)}</div>
                </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1rem' }}>
                <Card>
                    <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Produk per Sumber</h3>
                    {Object.entries(data.sourceCounts || {})
                        .sort((a, b) => b[1] - a[1])
                        .map(([src, count]) => (
                            <div key={src} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${AC.border}`, fontSize: '0.9rem' }}>
                                <span>{src}</span>
                                <strong>{count.toLocaleString('id-ID')}</strong>
                            </div>
                        ))}
                </Card>

                <Card>
                    <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Scrape Terbaru</h3>
                    {(data.recentLogs || []).length === 0 && <div style={{ color: AC.muted, fontSize: '0.9rem' }}>Belum ada log.</div>}
                    {(data.recentLogs || []).map((log) => (
                        <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${AC.border}`, fontSize: '0.85rem' }}>
                            <div>
                                <div style={{ fontWeight: 600 }}>{log.source || 'Unknown'}</div>
                                <div style={{ color: AC.muted, fontSize: '0.75rem' }}>
                                    {new Date(log.started_at).toLocaleString('id-ID')}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <StatusBadge status={log.status} />
                                <div style={{ color: AC.muted, fontSize: '0.75rem', marginTop: 4 }}>
                                    +{log.inserted || 0} / ~{log.updated || 0}
                                </div>
                            </div>
                        </div>
                    ))}
                </Card>
            </div>
        </div>
    );
}
