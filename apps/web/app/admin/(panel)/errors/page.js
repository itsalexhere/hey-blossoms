'use client';
import { useEffect, useState, useCallback } from 'react';
import { AC, PageTitle, Card, Button, inputStyle } from '../../../components/admin-ui';

export default function ErrorsPage() {
    const [errors, setErrors] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [source, setSource] = useState('');
    const [errorType, setErrorType] = useState('');
    const [page, setPage] = useState(0);
    const LIMIT = 50;

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams();
        if (source) p.set('source', source);
        if (errorType) p.set('errorType', errorType);
        p.set('limit', String(LIMIT));
        p.set('offset', String(page * LIMIT));
        fetch('/api/admin/errors?' + p.toString())
            .then((r) => r.json())
            .then((d) => {
                if (d.success) {
                    setErrors(d.errors || []);
                    setTotal(d.total || 0);
                }
            })
            .finally(() => setLoading(false));
    }, [source, errorType, page]);

    useEffect(() => { load(); }, [load]);

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div>
            <PageTitle title="Error Log" subtitle={`${total.toLocaleString('id-ID')} error tercatat`} right={<Button variant="outline" onClick={load}>Refresh</Button>} />

            <Card style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input placeholder="Filter sumber..." value={source} onChange={(e) => { setPage(0); setSource(e.target.value); }} style={inputStyle} />
                    <input placeholder="Filter tipe error..." value={errorType} onChange={(e) => { setPage(0); setErrorType(e.target.value); }} style={inputStyle} />
                </div>
            </Card>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                                <th style={th}>Waktu</th>
                                <th style={th}>Sumber</th>
                                <th style={th}>Tipe</th>
                                <th style={th}>Pesan</th>
                                <th style={th}>URL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {errors.map((e) => (
                                <tr key={e.id} style={{ borderTop: `1px solid ${AC.border}` }}>
                                    <td style={{ ...td, whiteSpace: 'nowrap', color: AC.muted }}>{e.created_at ? new Date(e.created_at).toLocaleString('id-ID') : '—'}</td>
                                    <td style={td}><strong>{e.source || '—'}</strong></td>
                                    <td style={td}>
                                        <span style={{ background: 'rgba(192,57,43,0.1)', color: AC.danger, padding: '3px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 }}>
                                            {e.error_type || 'unknown'}
                                        </span>
                                    </td>
                                    <td style={{ ...td, maxWidth: 380 }}>{e.message || '—'}</td>
                                    <td style={{ ...td, maxWidth: 220, color: AC.muted, wordBreak: 'break-all' }}>
                                        {e.url ? <a href={e.url} target="_blank" rel="noreferrer" style={{ color: '#2980b9' }}>{e.url}</a> : '—'}
                                    </td>
                                </tr>
                            ))}
                            {loading && (
                                <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: AC.muted }}>Memuat...</td></tr>
                            )}
                            {!loading && errors.length === 0 && (
                                <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: AC.muted }}>Tidak ada error tercatat. 🎉</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: '1rem', alignItems: 'center' }}>
                    <Button variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>‹ Prev</Button>
                    <span style={{ color: AC.muted, fontSize: '0.85rem' }}>Hal {page + 1} / {totalPages}</span>
                    <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next ›</Button>
                </div>
            )}
        </div>
    );
}

const th = { padding: '0.75rem 1rem', fontWeight: 600, color: AC.muted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
const td = { padding: '0.6rem 1rem', verticalAlign: 'top' };
