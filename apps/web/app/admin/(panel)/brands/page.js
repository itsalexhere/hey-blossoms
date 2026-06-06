'use client';
import { useEffect, useState } from 'react';
import { AC, PageTitle, Card, Button, inputStyle } from '../../../components/admin-ui';

export default function BrandsPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [editId, setEditId] = useState(null);
    const [editName, setEditName] = useState('');
    const [search, setSearch] = useState('');

    function load() {
        setLoading(true);
        fetch('/api/admin/brands')
            .then((r) => r.json())
            .then((d) => d.success && setItems(d.brands))
            .finally(() => setLoading(false));
    }
    useEffect(load, []);

    async function add() {
        if (!name.trim()) return;
        const res = await fetch('/api/admin/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        const d = await res.json();
        if (d.success) { setName(''); load(); } else alert('Gagal: ' + d.error);
    }
    async function save(id) {
        const res = await fetch(`/api/admin/brands/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName }) });
        const d = await res.json();
        if (d.success) { setEditId(null); load(); } else alert('Gagal: ' + d.error);
    }
    async function remove(id) {
        if (!confirm('Hapus brand ini? Produk terkait akan kehilangan brand.')) return;
        const res = await fetch(`/api/admin/brands/${id}`, { method: 'DELETE' });
        const d = await res.json();
        if (d.success) load(); else alert('Gagal: ' + d.error);
    }
    async function toggleVisible(id, isVisible) {
        const res = await fetch(`/api/admin/brands/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_visible: isVisible }),
        });
        const d = await res.json();
        if (d.success) load();
        else alert('Gagal: ' + d.error);
    }

    const filtered = items.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div>
            <PageTitle title="Brand" subtitle={`${items.length} brand`} />
            <Card style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input placeholder="Nama brand baru..." value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
                    <Button variant="gold" onClick={add}>Tambah</Button>
                    <input placeholder="Cari brand..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, minWidth: 180 }} />
                </div>
            </Card>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                            <th style={th}>Nama</th>
                            <th style={th}>Jumlah Produk</th>
                            <th style={th}>Status</th>
                            <th style={th}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((b) => {
                            const visible = b.is_visible !== false;
                            return (
                            <tr key={b.id} style={{ borderTop: `1px solid ${AC.border}`, opacity: visible ? 1 : 0.55 }}>
                                <td style={td}>
                                    {editId === b.id ? (
                                        <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inputStyle, padding: '0.35rem 0.5rem' }} />
                                    ) : (
                                        <strong>{b.name}</strong>
                                    )}
                                </td>
                                <td style={td}>{b.product_count}</td>
                                <td style={td}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: visible ? AC.success : AC.muted }}>
                                        {visible ? 'Tampil' : 'Sembunyi'}
                                    </span>
                                </td>
                                <td style={td}>
                                    {editId === b.id ? (
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <Button variant="gold" style={{ padding: '0.3rem 0.7rem' }} onClick={() => save(b.id)}>Simpan</Button>
                                            <Button variant="outline" style={{ padding: '0.3rem 0.7rem' }} onClick={() => setEditId(null)}>Batal</Button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <Button variant="outline" style={{ padding: '0.3rem 0.7rem' }} onClick={() => { setEditId(b.id); setEditName(b.name); }}>Edit</Button>
                                            <Button
                                                variant="outline"
                                                style={{ padding: '0.3rem 0.7rem' }}
                                                onClick={() => toggleVisible(b.id, !visible)}
                                            >
                                                {visible ? 'Sembunyikan' : 'Tampilkan'}
                                            </Button>
                                            <Button variant="danger" style={{ padding: '0.3rem 0.7rem' }} onClick={() => remove(b.id)}>Hapus</Button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                            );
                        })}
                        {!loading && filtered.length === 0 && (
                            <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: AC.muted }}>Tidak ada brand.</td></tr>
                        )}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}

const th = { padding: '0.75rem 1rem', fontWeight: 600, color: AC.muted, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' };
const td = { padding: '0.65rem 1rem' };
