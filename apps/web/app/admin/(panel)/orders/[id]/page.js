'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AC, PageTitle, Card, Button, inputStyle, formatIDR, formatProductDate } from '../../../../components/admin-ui';

const STATUSES = ['pending', 'processing', 'completed', 'cancelled'];

export default function OrderDetailPage() {
    const params = useParams();
    const id = params.id;
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        fetch(`/api/admin/orders/${id}`)
            .then((r) => r.json())
            .then((d) => {
                if (d.success) {
                    setOrder(d.order);
                    setStatus(d.order.status);
                }
            })
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    async function saveStatus() {
        setSaving(true);
        const res = await fetch('/api/admin/orders', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: Number(id), status }),
        });
        const d = await res.json();
        setSaving(false);
        if (d.success) load();
        else alert('Gagal: ' + d.error);
    }

    if (loading) return <div style={{ color: AC.muted }}>Memuat...</div>;
    if (!order) return <div style={{ color: AC.danger }}>Pesanan tidak ditemukan.</div>;

    return (
        <div>
            <PageTitle
                title={order.order_number}
                subtitle={`Dibuat ${formatProductDate(order.created_at)}`}
                right={
                    <Link href="/admin/orders">
                        <Button variant="outline">← Kembali</Button>
                    </Link>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <Card>
                    <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Data Customer</h3>
                    <InfoRow label="Nama" value={order.customer_name} />
                    <InfoRow label="No. HP" value={order.phone} />
                    <InfoRow label="Alamat" value={order.address} />
                    {order.notes && <InfoRow label="Catatan" value={order.notes} />}
                </Card>
                <Card>
                    <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Ringkasan</h3>
                    <InfoRow label="Total Item" value={String(order.item_count)} />
                    <InfoRow label="Total Harga" value={formatIDR(order.total_amount)} />
                    <div style={{ marginTop: 16 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: AC.muted, textTransform: 'uppercase' }}>Status</label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                                {STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                            <Button variant="gold" onClick={saveStatus} disabled={saving || status === order.status}>
                                {saving ? '...' : 'Simpan'}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${AC.border}` }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Item Pesanan</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                                <th style={th}>Produk</th>
                                <th style={th}>Brand</th>
                                <th style={th}>Sumber</th>
                                <th style={th}>Qty</th>
                                <th style={th}>Harga</th>
                                <th style={th}>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(order.items || []).map((item) => (
                                <tr key={item.id} style={{ borderTop: `1px solid ${AC.border}` }}>
                                    <td style={td}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {item.image_url && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={item.image_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                                            )}
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{item.title}</div>
                                                {item.source_url && (
                                                    <a href={item.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: AC.muted }}>
                                                        Lihat di sumber →
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={td}>{item.brand || '—'}</td>
                                    <td style={td}>
                                        {item.source ? (
                                            <span style={{ padding: '2px 8px', borderRadius: 12, background: '#f0f0f0', fontSize: '0.75rem', fontWeight: 600 }}>
                                                {item.source}
                                            </span>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td style={td}>{item.qty}</td>
                                    <td style={td}>{formatIDR(item.unit_price)}</td>
                                    <td style={td}>{formatIDR(item.line_total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: AC.muted, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: '0.9rem', marginTop: 2 }}>{value}</div>
        </div>
    );
}

const th = { padding: '0.75rem 1rem', fontWeight: 600, color: AC.muted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' };
const td = { padding: '0.6rem 1rem' };
