'use client';
import { useEffect, useState, useCallback } from 'react';
import { AC, PageTitle, Card, formatIDR, formatProductDate, Button, inputStyle, StatusBadge, ModalOverlay } from '../../../components/admin-ui';
import { VIP_SOURCES } from '@luxe/shared/vip-config';
import { computeSellingPrice } from '@luxe/shared/pricing';

export default function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [markup, setMarkup] = useState(0);
    const [loading, setLoading] = useState(true);
    const [editProduct, setEditProduct] = useState(null);

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
            setEditProduct(null);
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
                                <th style={th}>Upping</th>
                                <th style={th}>Harga Jual</th>
                                <th style={th}>Stok</th>
                                <th style={th}>Aktif</th>
                                <th style={th}>Terakhir Diperbarui</th>
                                <th style={th}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p) => (
                                <ProductRow key={p.id} p={p} markup={markup} onEdit={() => setEditProduct(p)} onDelete={remove} />
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

            {editProduct && (
                <ProductEditModal
                    product={editProduct}
                    markup={markup}
                    onClose={() => setEditProduct(null)}
                    onSave={saveEdit}
                />
            )}
        </div>
    );
}

function ProductEditModal({ product, markup, onClose, onSave }) {
    const [useManual, setUseManual] = useState(product.markup_addon_idr != null);
    const [addon, setAddon] = useState(product.markup_addon_idr != null ? String(product.markup_addon_idr) : '');
    const [stockStatus, setStockStatus] = useState(product.stock_status);
    const [stockQty, setStockQty] = useState(product.stock_qty ?? '');
    const [isActive, setIsActive] = useState(product.is_active);
    const [saving, setSaving] = useState(false);

    const addonNum = useManual && addon !== '' ? Number(addon) : null;
    const previewSell = computeSellingPrice(product.original_price, markup, addonNum);

    async function handleSave() {
        setSaving(true);
        await onSave(product.id, {
            markup_addon_idr: useManual && addon !== '' ? Number(addon) : null,
            stock_status: stockStatus,
            stock_qty: stockQty === '' ? null : Number(stockQty),
            is_active: isActive,
        });
        setSaving(false);
    }

    const lbl = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: AC.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' };

    return (
        <ModalOverlay onClose={onClose}>
            <h2 style={{ marginTop: 0, fontFamily: 'Outfit, sans-serif' }}>Edit Produk</h2>
            <p style={{ color: AC.muted, fontSize: '0.85rem', marginBottom: '1rem' }}>{product.title}</p>

            <div style={{ display: 'grid', gap: 8, marginBottom: '1rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: AC.muted }}>Brand</span><strong>{product.brand || '—'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: AC.muted }}>Sumber</span><strong>{product.source}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: AC.muted }}>Harga asli (dari sumber)</span><strong>{formatIDR(product.original_price)}</strong></div>
            </div>

            <label style={lbl}>Upping harga manual (nominal)</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', marginBottom: 8 }}>
                <input type="checkbox" checked={useManual} onChange={(e) => setUseManual(e.target.checked)} />
                Pakai upping manual per produk
            </label>
            {useManual ? (
                <>
                    <input type="number" value={addon} onChange={(e) => setAddon(e.target.value)} placeholder="Contoh: 1000000" style={{ ...inputStyle, width: '100%', marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {[500000, 1000000, 2000000].map((n) => (
                            <Button key={n} variant="outline" style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }} onClick={() => setAddon(String(n))}>+{formatIDR(n)}</Button>
                        ))}
                    </div>
                </>
            ) : (
                <p style={{ fontSize: '0.8rem', color: AC.muted, marginBottom: 12 }}>Markup global {markup}% → {formatIDR(computeSellingPrice(product.original_price, markup, null))}</p>
            )}

            <div style={{ background: AC.pinkSoft, borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: AC.muted, marginBottom: 4 }}>Preview harga jual</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: AC.blue }}>{formatIDR(previewSell)}</div>
            </div>

            <label style={lbl}>Stok</label>
            <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)} style={{ ...inputStyle, width: '100%', marginBottom: 8 }}>
                <option value="available">Tersedia</option>
                <option value="sold_out">Habis</option>
                <option value="out_of_stock">Out of stock</option>
            </select>
            <input type="number" placeholder="Qty (opsional)" value={stockQty} onChange={(e) => setStockQty(e.target.value)} style={{ ...inputStyle, width: '100%', marginBottom: 12 }} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Produk aktif di storefront
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="pink" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
                <Button variant="outline" onClick={onClose}>Batal</Button>
            </div>
        </ModalOverlay>
    );
}

function ProductRow({ p, markup, onEdit, onDelete }) {
    const isManual = p.markup_addon_idr != null;

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
                        {p.brand && <div style={{ color: AC.pink, fontSize: '0.7rem' }}>{p.brand}</div>}
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
                    <a href={p.source_url} target="_blank" rel="noopener noreferrer" title={p.source_url} style={{ color: AC.blue, fontSize: '0.72rem', textDecoration: 'none', display: 'inline-block', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>
                        Lihat sumber ↗
                    </a>
                )}
            </td>
            <td style={td}>
                {isManual ? (
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: AC.blue }}>+{formatIDR(p.markup_addon_idr)}</span>
                ) : (
                    <span style={{ fontSize: '0.78rem', color: AC.muted }}>Global {markup}%</span>
                )}
            </td>
            <td style={{ ...td, fontWeight: 700, color: AC.blue }}>{formatIDR(p.selling_price)}</td>
            <td style={td}><StatusBadge status={p.stock_status} /></td>
            <td style={td}>{p.is_active ? <span style={{ color: AC.success }}>●</span> : <span style={{ color: AC.muted }}>○</span>}</td>
            <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: '0.78rem', lineHeight: 1.35 }}>{formatProductDate(p.updated_at || p.scraped_at)}</div>
                <div style={{ fontSize: '0.68rem', color: AC.muted, marginTop: 2 }}>Ditambahkan: {formatProductDate(p.created_at)}</div>
            </td>
            <td style={td}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <Button variant="outline" style={{ padding: '0.35rem 0.7rem' }} onClick={onEdit}>Edit</Button>
                    <Button variant="danger" style={{ padding: '0.35rem 0.7rem' }} onClick={() => onDelete(p.id)}>Hapus</Button>
                </div>
            </td>
        </tr>
    );
}

const th = { padding: '0.75rem 1rem', fontWeight: 600, color: AC.muted, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
const td = { padding: '0.65rem 1rem', verticalAlign: 'middle' };
