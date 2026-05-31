'use client';
import { useEffect, useState, useCallback } from 'react';
import { AC, PageTitle, Card, Button, inputStyle, StatusBadge } from '../../../components/admin-ui';

export default function ScrapeLogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [source, setSource] = useState('');
    const [status, setStatus] = useState('');

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

    return (
        <div>
            <PageTitle title="Log Scrape" subtitle="Riwayat eksekusi scraper" right={<Button variant="outline" onClick={load}>Refresh</Button>} />
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
                                </tr>
                            ))}
                            {!loading && logs.length === 0 && (
                                <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: AC.muted }}>Belum ada log scrape.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

const th = { padding: '0.75rem 1rem', fontWeight: 600, color: AC.muted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
const td = { padding: '0.6rem 1rem' };
