'use client';
import { useEffect, useState, useCallback } from 'react';
import { AC, PageTitle, Card, Button, inputStyle } from '../../../components/admin-ui';

export default function SourceLabelsPage() {
    const [rows, setRows] = useState([]); // { source, count, label }
    const [selected, setSelected] = useState(new Set());
    const [bulkLabel, setBulkLabel] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        fetch('/api/admin/source-labels')
            .then((r) => r.json())
            .then((d) => {
                if (d.success) {
                    setRows(d.sources || []);
                    setSelected(new Set());
                }
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    function setLabel(source, label) {
        setRows((rs) => rs.map((r) => (r.source === source ? { ...r, label } : r)));
    }

    function toggle(source) {
        setSelected((s) => {
            const n = new Set(s);
            n.has(source) ? n.delete(source) : n.add(source);
            return n;
        });
    }

    const allSelected = rows.length > 0 && selected.size === rows.length;
    function toggleAll() {
        setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.source)));
    }

    function applyBulk() {
        if (selected.size === 0) {
            setMsg('Pilih minimal satu sumber dulu.');
            return;
        }
        setRows((rs) => rs.map((r) => (selected.has(r.source) ? { ...r, label: bulkLabel } : r)));
        setMsg(`Label "${bulkLabel || '(kosong)'}" diterapkan ke ${selected.size} sumber. Jangan lupa Simpan.`);
    }

    function clearSelected() {
        if (selected.size === 0) return;
        setRows((rs) => rs.map((r) => (selected.has(r.source) ? { ...r, label: '' } : r)));
        setMsg(`Label ${selected.size} sumber dikosongkan (kembali ke nama asli). Jangan lupa Simpan.`);
    }

    async function save() {
        setSaving(true);
        setMsg('');
        const labels = {};
        rows.forEach((r) => {
            if (r.label && r.label.trim()) labels[r.source] = r.label.trim();
        });
        const res = await fetch('/api/admin/source-labels', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labels }),
        });
        const d = await res.json();
        setSaving(false);
        if (d.success) {
            setMsg('✓ Tersimpan. Tag di dashboard user akan langsung memakai label baru.');
            load();
        } else {
            setMsg('Gagal menyimpan: ' + (d.error || 'unknown'));
        }
    }

    return (
        <div>
            <PageTitle
                title="Label Sumber"
                subtitle="Ubah teks tag sumber yang tampil di kartu produk dashboard user (mis. ubah 'ZZER' jadi nama lain). Nama asli sumber tidak berubah."
            />

            <Card style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        placeholder="Label untuk sumber terpilih..."
                        value={bulkLabel}
                        onChange={(e) => setBulkLabel(e.target.value)}
                        style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                    />
                    <Button variant="outline" onClick={applyBulk}>Terapkan ke terpilih</Button>
                    <Button variant="outline" onClick={clearSelected}>Kosongkan terpilih</Button>
                </div>
                <div style={{ color: AC.muted, fontSize: '0.78rem', marginTop: 8 }}>
                    Centang beberapa sumber lalu pakai tombol di atas untuk mengubah sekaligus, atau edit label tiap baris di bawah satu per satu.
                </div>
            </Card>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                                <th style={th}>
                                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                                </th>
                                <th style={th}>Sumber Asli</th>
                                <th style={th}>Jumlah Produk</th>
                                <th style={th}>Label Tampilan (Tag)</th>
                                <th style={th}>Preview Tag</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.source} style={{ borderTop: `1px solid ${AC.border}` }}>
                                    <td style={td}>
                                        <input type="checkbox" checked={selected.has(r.source)} onChange={() => toggle(r.source)} />
                                    </td>
                                    <td style={{ ...td, fontWeight: 600 }}>{r.source}</td>
                                    <td style={td}>{r.count.toLocaleString('id-ID')}</td>
                                    <td style={td}>
                                        <input
                                            value={r.label}
                                            placeholder={`(default: ${r.source})`}
                                            onChange={(e) => setLabel(r.source, e.target.value)}
                                            style={{ ...inputStyle, width: 220, padding: '0.4rem 0.6rem' }}
                                        />
                                    </td>
                                    <td style={td}>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                background: 'rgba(255,255,255,0.9)',
                                                border: `1px solid ${AC.border}`,
                                                borderRadius: 6,
                                                padding: '0.25rem 0.6rem',
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                color: AC.dark,
                                            }}
                                        >
                                            {(r.label && r.label.trim()) || r.source}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {loading && (
                                <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: AC.muted }}>Memuat...</td></tr>
                            )}
                            {!loading && rows.length === 0 && (
                                <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: AC.muted }}>Belum ada sumber.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: '1rem' }}>
                <Button variant="gold" onClick={save} disabled={saving} style={{ padding: '0.7rem 1.6rem' }}>
                    {saving ? 'Menyimpan...' : 'Simpan Semua'}
                </Button>
                {msg && <span style={{ color: msg.startsWith('✓') ? AC.success : AC.muted, fontSize: '0.85rem' }}>{msg}</span>}
            </div>
        </div>
    );
}

const th = { padding: '0.75rem 1rem', fontWeight: 600, color: AC.muted, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
const td = { padding: '0.65rem 1rem', verticalAlign: 'middle' };
