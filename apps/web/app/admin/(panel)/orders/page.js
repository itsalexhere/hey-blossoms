'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AC, PageTitle, Card, Button, inputStyle, formatIDR, formatProductDate } from '../../../components/admin-ui';

const STATUS_COLORS = {
    pending: '#e67e22',
    processing: '#2980b9',
    completed: AC.success,
    cancelled: AC.danger,
};

function OrderStatus({ status }) {
    const color = STATUS_COLORS[status] || AC.muted;
    return (
        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: `${color}1a`, color }}>
            {status}
        </span>
    );
}

export default function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(0);
    const LIMIT = 50;

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams();
        if (search) p.set('search', search);
        if (status) p.set('status', status);
        p.set('limit', String(LIMIT));
        p.set('offset', String(page * LIMIT));
        fetch('/api/admin/orders?' + p.toString())
            .then((r) => r.json())
            .then((d) => {
                if (d.success) {
                    setOrders(d.orders || []);
                    setTotal(d.total || 0);
                }
            })
            .finally(() => setLoading(false));
    }, [search, status, page]);

    useEffect(() => {
        load();
    }, [load]);

    const totalPages = Math.ceil(total / LIMIT) || 1;

    return (
        <div>
            <PageTitle title="Pesanan" subtitle={`${total.toLocaleString('id-ID')} pesanan customer`} />

            <Card style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        placeholder="Cari no. pesanan, nama, HP..."
                        value={search}
                        onChange={(e) => {
                            setPage(0);
                            setSearch(e.target.value);
                        }}
                        style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                    />
                    <select
                        value={status}
                        onChange={(e) => {
                            setPage(0);
                            setStatus(e.target.value);
                        }}
                        style={inputStyle}
                    >
                        <option value="">Semua status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <Button
                        variant="outline"
                        onClick={() => {
                            const p = new URLSearchParams();
                            if (search) p.set('search', search);
                            if (status) p.set('status', status);
                            window.open('/api/admin/orders/export?' + p.toString(), '_blank');
                        }}
                    >
                        Export Excel
                    </Button>
                </div>
            </Card>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                                <th style={th}>No. Pesanan</th>
                                <th style={th}>Tanggal</th>
                                <th style={th}>Customer</th>
                                <th style={th}>HP</th>
                                <th style={th}>Item</th>
                                <th style={th}>Total</th>
                                <th style={th}>Status</th>
                                <th style={th}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((o) => (
                                <tr key={o.id} style={{ borderTop: `1px solid ${AC.border}` }}>
                                    <td style={td}><strong>{o.order_number}</strong></td>
                                    <td style={{ ...td, color: AC.muted, whiteSpace: 'nowrap' }}>{formatProductDate(o.created_at)}</td>
                                    <td style={td}>{o.customer_name}</td>
                                    <td style={td}>{o.phone}</td>
                                    <td style={td}>{o.item_count}</td>
                                    <td style={td}>{formatIDR(o.total_amount)}</td>
                                    <td style={td}><OrderStatus status={o.status} /></td>
                                    <td style={td}>
                                        <Link href={`/admin/orders/${o.id}`} style={{ color: AC.dark, fontWeight: 600 }}>
                                            Detail
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {!loading && orders.length === 0 && (
                                <tr>
                                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: AC.muted }}>
                                        Belum ada pesanan.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                    <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                        Prev
                    </Button>
                    <span style={{ padding: '0.5rem', color: AC.muted }}>
                        {page + 1} / {totalPages}
                    </span>
                    <Button variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}

const th = { padding: '0.75rem 1rem', fontWeight: 600, color: AC.muted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
const td = { padding: '0.6rem 1rem' };
