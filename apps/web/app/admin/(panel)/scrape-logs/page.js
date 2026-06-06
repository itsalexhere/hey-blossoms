'use client';
import { useEffect, useState, useCallback } from 'react';
import { AC, PageTitle, Card, Button, inputStyle, StatusBadge, formatIDR } from '../../../components/admin-ui';

export default function ScrapeLogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [source, setSource] = useState('');
    const [status, setStatus] = useState('');
    const [detailLog, setDetailLog] = useState(null);
    const [detailProducts, setDetailProducts] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailMeta, setDetailMeta] = useState(null);
    const [detailError, setDetailError] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams();
        if (source) p.set('source', source);
        if (status) p.set('status', status);
        fetch('/api/admin/scrape-logs?' + p.toString())
            .then((r) => r.json())
            .then((d) => d.success && setLogs(d.logs))
            .finally(() => setLoading(false));
    }, [source, status]);

    useEffect(() => { load(); }, [load]);

    async function openProducts(log) {
        setDetailLog(log);
        setDetailProducts([]);
        setDetailMeta(null);
        setDetailError('');
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/admin/scrape-logs/${log.id}/products`);
            const d = await res.json();
            if (d.success) {
                setDetailProducts(d.products || []);
                setDetailMeta({ match_source: d.match_source, total: d.total });
            } else {
                setDetailError(d.error || 'Gagal memuat produk');
            }
        } catch (e) {
            setDetailError(e.message);
        } finally {
            setDetailLoading(false);
        }
    }

    function closeDetail() {
        setDetailLog(null);
        setDetailProducts([]);
        setDetailMeta(null);
        setDetailError('');
    }

    return (
        <div>
            <PageTitle title="Milestone" subtitle="Riwayat milestone product list" right={<Button variant="outline" onClick={load}>Refresh</Button>} />
            <Card style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input placeholder="Filter sumber..." value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle} />
                    <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                        <option value="">Semua status</option>
                        <option value="running">Running</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
            </Card>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                                <th style={th}>Sumber</th>
                                <th style={th}>Status</th>
                                <th style={th}>Total</th>
                                <th style={th}>Baru</th>
                                <th style={th}>Update</th>
                                <th style={th}>Error</th>
                                <th style={th}>Durasi</th>
                                <th style={th}>Mulai</th>
                                <th style={th}>Produk</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((l) => (
                                <tr key={l.id} style={{ borderTop: `1px solid ${AC.border}` }}>
                                    <td style={td}><strong>{l.source || '—'}</strong></td>
                                    <td style={td}><StatusBadge status={l.status} /></td>
                                    <td style={td}>{l.total_products || 0}</td>
                                    <td style={{ ...td, color: AC.success }}>+{l.inserted || 0}</td>
                                    <td style={td}>~{l.updated || 0}</td>
                                    <td style={{ ...td, color: l.errors ? AC.danger : AC.muted }}>{l.errors || 0}</td>
                                    <td style={td}>{l.duration_seconds ? `${l.duration_seconds}s` : '—'}</td>
                                    <td style={{ ...td, color: AC.muted, whiteSpace: 'nowrap' }}>{l.started_at ? new Date(l.started_at).toLocaleString('id-ID') : '—'}</td>
                                    <td style={td}>
                                        <Button
                                            variant="outline"
                                            onClick={() => openProducts(l)}
                                            disabled={!l.total_products && l.status !== 'completed'}
                                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                                        >
                                            Lihat
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {!loading && logs.length === 0 && (
                                <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: AC.muted }}>Belum ada milestone.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {detailLog && (
                <div className="modal-overlay" onClick={closeDetail}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: 960, width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
                    >
                        <button type="button" className="modal-close-btn" onClick={closeDetail}>{'\u2715'}</button>
                        <div style={{ padding: '1.5rem 1.5rem 0' }}>
                            <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>
                                Produk sesi #{detailLog.id} — {detailLog.source}
                            </h2>
                            <p style={{ margin: 0, color: AC.muted, fontSize: '0.85rem' }}>
                                {detailLog.scrape_url}
                            </p>
                            {detailMeta && (
                                <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: AC.blue }}>
                                    {detailMeta.total} produk
                                    {detailMeta.match_source === 'fallback' && ' (perkiraan dari waktu milestone — data lama)'}
                                </p>
                            )}
                        </div>

                        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.5rem 1.5rem' }}>
                            {detailLoading && <div style={{ color: AC.muted, padding: '2rem 0', textAlign: 'center' }}>Memuat produk...</div>}
                            {detailError && (
                                <div style={{ background: 'rgba(192,57,43,0.1)', color: AC.danger, padding: '0.8rem', borderRadius: 8, fontSize: '0.85rem' }}>
                                    {detailError}
                                    {detailError.includes('scrape_log_products') && (
                                        <div style={{ marginTop: 8, fontSize: '0.8rem' }}>
                                            Jalankan migration <code>supabase/migrations/scrape_log_products.sql</code> di Supabase SQL Editor.
                                        </div>
                                    )}
                                </div>
                            )}
                            {!detailLoading && !detailError && detailProducts.length === 0 && (
                                <div style={{ color: AC.muted, textAlign: 'center', padding: '2rem 0' }}>Tidak ada produk tercatat untuk sesi ini.</div>
                            )}
                            {!detailLoading && detailProducts.length > 0 && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: AC.pinkSoft, textAlign: 'left' }}>
                                            <th style={thInner}>Foto</th>
                                            <th style={thInner}>Produk</th>
                                            <th style={thInner}>Brand</th>
                                            <th style={thInner}>Harga asli</th>
                                            <th style={thInner}>Foto</th>
                                            <th style={thInner}>Deskripsi</th>
                                            <th style={thInner}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detailProducts.map((p) => (
                                            <tr key={p.id} style={{ borderTop: `1px solid ${AC.border}` }}>
                                                <td style={tdInner}>
                                                    {p.image_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={p.image_url}
                                                            alt=""
                                                            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, background: '#f0f0f0' }}
                                                        />
                                                    ) : (
                                                        <span style={{ color: AC.muted }}>—</span>
                                                    )}
                                                </td>
                                                <td style={tdInner}>
                                                    <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{p.title}</div>
                                                    {p.source_url && (
                                                        <a href={p.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: AC.blue }}>
                                                            Sumber ↗
                                                        </a>
                                                    )}
                                                </td>
                                                <td style={tdInner}>{p.brand || '—'}</td>
                                                <td style={tdInner}>{formatIDR(p.original_price)}</td>
                                                <td style={tdInner}>{p.image_count || 1}</td>
                                                <td style={{ ...tdInner, maxWidth: 220, color: AC.muted, fontSize: '0.75rem', lineHeight: 1.4 }}>
                                                    {p.description ? (
                                                        <span title={p.description}>
                                                            {p.description.length > 120 ? `${p.description.slice(0, 120)}…` : p.description}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td style={tdInner}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '2px 8px',
                                                        borderRadius: 12,
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600,
                                                        background: p.action === 'inserted' ? 'rgba(39,174,96,0.12)' : 'rgba(59,91,157,0.12)',
                                                        color: p.action === 'inserted' ? AC.success : AC.blue,
                                                    }}>
                                                        {p.action === 'inserted' ? 'Baru' : 'Update'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const th = { padding: '0.75rem 1rem', fontWeight: 600, color: AC.muted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
const td = { padding: '0.6rem 1rem' };
const thInner = { ...th, padding: '0.55rem 0.75rem' };
const tdInner = { ...td, padding: '0.55rem 0.75rem', verticalAlign: 'middle' };
