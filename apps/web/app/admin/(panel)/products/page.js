'use client';
import { useEffect, useState, useCallback } from 'react';
import { AC, PageTitle, Card, formatIDR, formatProductDate, Button, inputStyle, StatusBadge } from '../../../components/admin-ui';
import { VIP_SOURCES } from '@luxe/shared/vip-config';

export default function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [markup, setMarkup] = useState(0);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);

    const [search, setSearch] = useState('');
    const [source, setSource] = useState('');
    const [brandId, setBrandId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [genderFilter, setGenderFilter] = useState('');
    const [genderSupported, setGenderSupported] = useState(true);
    const [stock, setStock] = useState('');
    const [active, setActive] = useState('');
    const [sort, setSort] = useState('newest');
    const [page, setPage] = useState(0);
    const [listError, setListError] = useState('');
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);
    const LIMIT = 50;

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/brands').then((r) => r.json()),
            fetch('/api/admin/categories').then((r) => r.json()),
        ]).then(([b, c]) => {
            if (b.success) setBrands(b.brands || []);
            if (c.success) setCategories(c.categories || []);
        });
    }, []);

    const load = useCallback(() => {
        setLoading(true);
        const p = new URLSearchParams();
        if (search) p.set('search', search);
        if (source) p.set('source', source);
        if (brandId) p.set('brand_id', brandId);
        if (categoryId) p.set('category_id', categoryId);
        if (genderFilter) p.set('gender', genderFilter);
        if (stock) p.set('stock', stock);
        if (active) p.set('active', active);
        if (sort) p.set('sort', sort);
        p.set('limit', String(LIMIT));
        p.set('offset', String(page * LIMIT));
        fetch('/api/admin/products?' + p.toString())
            .then((r) => r.json())
            .then((d) => {
                if (d.success) {
                    setProducts(d.products);
                    setTotal(d.total);
                    setMarkup(d.markup);
                    setGenderSupported(d.gender_supported !== false);
                    setListError('');
                } else {
                    setListError(d.error || 'Gagal memuat produk');
                }
            })
            .catch(() => setListError('Gagal memuat produk — periksa koneksi dan login admin'))
            .finally(() => setLoading(false));
    }, [search, source, brandId, categoryId, genderFilter, stock, active, sort, page]);

    useEffect(() => {
        load();
    }, [load]);

    async function saveEdit(id, patch) {
        const res = await fetch(`/api/admin/products/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
        const d = await res.json();
        if (d.success) {
            setEditing(null);
            load();
        } else {
            alert('Gagal: ' + d.error);
        }
    }

    async function remove(id) {
        if (!confirm('Hapus produk ini?')) return;
        const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
        const d = await res.json();
        if (d.success) load();
        else alert('Gagal: ' + d.error);
    }

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div>
            <PageTitle title="Produk" subtitle={`${total.toLocaleString('id-ID')} produk • markup ${markup}%`} />

            <Card style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        placeholder="Cari judul..."
                        value={search}
                        onChange={(e) => {
                            setPage(0);
                            setSearch(e.target.value);
                        }}
                        style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                    />
                    <select value={source} onChange={(e) => { setPage(0); setSource(e.target.value); }} style={inputStyle}>
                        <option value="">Semua sumber</option>
                        {VIP_SOURCES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <select value={brandId} onChange={(e) => { setPage(0); setBrandId(e.target.value); }} style={inputStyle}>
                        <option value="">Semua merk</option>
                        {brands.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                    <select value={categoryId} onChange={(e) => { setPage(0); setCategoryId(e.target.value); }} style={inputStyle}>
                        <option value="">Semua kategori</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    {genderSupported ? (
                        <select value={genderFilter} onChange={(e) => { setPage(0); setGenderFilter(e.target.value); }} style={inputStyle}>
                            <option value="">Semua gender</option>
                            <option value="men">Men</option>
                            <option value="women">Women</option>
                            <option value="unset">Belum diisi</option>
                        </select>
                    ) : (
                        <span style={{ fontSize: '0.78rem', color: AC.muted, padding: '0 4px' }}>Gender: jalankan vip_taxonomy.sql</span>
                    )}
                    <select value={stock} onChange={(e) => { setPage(0); setStock(e.target.value); }} style={inputStyle}>
                        <option value="">Semua stok</option>
                        <option value="available">Tersedia</option>
                        <option value="sold_out">Habis</option>
                    </select>
                    <select value={active} onChange={(e) => { setPage(0); setActive(e.target.value); }} style={inputStyle}>
                        <option value="">Semua status</option>
                        <option value="true">Aktif</option>
                        <option value="false">Nonaktif</option>
                    </select>
                    <select value={sort} onChange={(e) => { setPage(0); setSort(e.target.value); }} style={inputStyle}>
                        <option value="newest">Terbaru</option>
                        <option value="price_asc">Harga: Termurah</option>
                        <option value="price_desc">Harga: Termahal</option>
                        <option value="title_asc">A – Z</option>
                    </select>
                    <Button
                        variant="outline"
                        title="Unduh data produk sesuai filter tabel saat ini"
                        onClick={() => {
                            const p = new URLSearchParams();
                            if (search) p.set('search', search);
                            if (source) p.set('source', source);
                            if (brandId) p.set('brand_id', brandId);
                            if (categoryId) p.set('category_id', categoryId);
                            if (genderFilter) p.set('gender', genderFilter);
                            if (stock) p.set('stock', stock);
                            if (active) p.set('active', active);
                            if (sort) p.set('sort', sort);
                            window.open('/api/admin/products/export?' + p.toString(), '_blank');
                        }}
                    >
                        Export Excel
                    </Button>
                    <label title="Update harga/stok/gender/kategori dari file Excel" style={{ ...inputStyle, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        Import Excel
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const fd = new FormData();
                                fd.append('file', file);
                                const res = await fetch('/api/admin/products/import', { method: 'POST', body: fd });
                                const d = await res.json();
                                if (d.success) {
                                    let msg = `Import selesai: ${d.updated} diupdate, ${d.skipped} dilewati`;
                                    if (d.errors?.length) {
                                        msg += '\n\nError:\n' + d.errors.slice(0, 5).map((e) => `- ${e.message || e}`).join('\n');
                                        if (d.errors.length > 5) msg += `\n... +${d.errors.length - 5} error lainnya`;
                                    }
                                    alert(msg);
                                    load();
                                } else alert('Gagal: ' + d.error);
                                e.target.value = '';
                            }}
                        />
                    </label>
                </div>
                {listError && (
                    <div style={{ marginTop: 10, padding: '0.75rem', background: 'rgba(192,57,43,0.1)', color: AC.danger, borderRadius: 8, fontSize: '0.85rem' }}>
                        {listError}
                    </div>
                )}
            </Card>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                                <th style={th}>Produk</th>
                                <th style={th}>Gender</th>
                                <th style={th}>Sumber</th>
                                <th style={th}>Harga Asli</th>
                                <th style={th}>Harga Jual</th>
                                <th style={th}>Stok</th>
                                <th style={th}>Aktif</th>
                                <th style={th}>Terakhir Diperbarui</th>
                                <th style={th}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p) => (
                                <ProductRow key={p.id} p={p} markup={markup} editing={editing === p.id} onEdit={() => setEditing(p.id)} onCancel={() => setEditing(null)} onSave={saveEdit} onDelete={remove} />
                            ))}
                            {loading && (
                                <tr>
                                    <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: AC.muted }}>Memuat...</td>
                                </tr>
                            )}
                            {!loading && products.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: AC.muted }}>Tidak ada produk.</td>
                                </tr>
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

function ProductRow({ p, markup, editing, onEdit, onCancel, onSave, onDelete }) {
    const [price, setPrice] = useState(p.original_price);
    const [stockStatus, setStockStatus] = useState(p.stock_status);
    const [stockQty, setStockQty] = useState(p.stock_qty ?? '');
    const [isActive, setIsActive] = useState(p.is_active);

    useEffect(() => {
        setPrice(p.original_price);
        setStockStatus(p.stock_status);
        setStockQty(p.stock_qty ?? '');
        setIsActive(p.is_active);
    }, [p, editing]);

    const previewSell = Math.round(Number(price || 0) * (1 + markup / 100));

    return (
        <tr style={{ borderTop: `1px solid ${AC.border}` }}>
            <td style={td}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                    ) : (
                        <div style={{ width: 44, height: 44, background: '#eee', borderRadius: 6, flexShrink: 0 }} />
                    )}
                    <div style={{ maxWidth: 240 }}>
                        <div style={{ fontWeight: 600, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.title}</div>
                        {p.brand && <div style={{ color: AC.gold, fontSize: '0.7rem' }}>{p.brand}</div>}
                    </div>
                </div>
            </td>
            <td style={td}>
                {p.gender === 'men' ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Men</span>
                ) : p.gender === 'women' ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Women</span>
                ) : (
                    <span style={{ fontSize: '0.72rem', color: AC.muted }}>—</span>
                )}
            </td>
            <td style={td}>
                <div style={{ fontWeight: 600 }}>{p.source}</div>
                {p.source_url && (
                    <a
                        href={p.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={p.source_url}
                        style={{ color: AC.gold, fontSize: '0.72rem', textDecoration: 'none', display: 'inline-block', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}
                    >
                        Lihat sumber ↗
                    </a>
                )}
            </td>
            <td style={td}>
                {editing ? (
                    <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} style={{ ...inputStyle, width: 120, padding: '0.35rem 0.5rem' }} />
                ) : (
                    formatIDR(p.original_price)
                )}
            </td>
            <td style={{ ...td, fontWeight: 700, color: AC.gold }}>{formatIDR(editing ? previewSell : p.selling_price)}</td>
            <td style={td}>
                {editing ? (
                    <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
                        <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)} style={{ ...inputStyle, padding: '0.3rem' }}>
                            <option value="available">Tersedia</option>
                            <option value="sold_out">Habis</option>
                            <option value="out_of_stock">Out of stock</option>
                        </select>
                        <input type="number" placeholder="qty" value={stockQty} onChange={(e) => setStockQty(e.target.value)} style={{ ...inputStyle, width: 70, padding: '0.3rem' }} />
                    </div>
                ) : (
                    <StatusBadge status={p.stock_status} />
                )}
            </td>
            <td style={td}>
                {editing ? (
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                ) : p.is_active ? (
                    <span style={{ color: AC.success }}>●</span>
                ) : (
                    <span style={{ color: AC.muted }}>○</span>
                )}
            </td>
            <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: '0.78rem', lineHeight: 1.35 }}>
                    {formatProductDate(p.updated_at || p.scraped_at)}
                </div>
                <div style={{ fontSize: '0.68rem', color: AC.muted, marginTop: 2 }}>
                    Ditambahkan: {formatProductDate(p.created_at)}
                </div>
            </td>
            <td style={td}>
                {editing ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                        <Button variant="gold" style={{ padding: '0.35rem 0.7rem' }} onClick={() => onSave(p.id, { original_price: price, stock_status: stockStatus, stock_qty: stockQty === '' ? null : stockQty, is_active: isActive })}>Simpan</Button>
                        <Button variant="outline" style={{ padding: '0.35rem 0.7rem' }} onClick={onCancel}>Batal</Button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                        <Button variant="outline" style={{ padding: '0.35rem 0.7rem' }} onClick={onEdit}>Edit</Button>
                        <Button variant="danger" style={{ padding: '0.35rem 0.7rem' }} onClick={() => onDelete(p.id)}>Hapus</Button>
                    </div>
                )}
            </td>
        </tr>
    );
}

const th = { padding: '0.75rem 1rem', fontWeight: 600, color: AC.muted, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
const td = { padding: '0.65rem 1rem', verticalAlign: 'middle' };
