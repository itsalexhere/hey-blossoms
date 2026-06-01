'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AC, PageTitle, Card, Button, inputStyle, formatIDR } from '../../../components/admin-ui';

const SECTIONS = [
    { id: 'branding', label: 'Branding', hint: 'Logo & nama toko' },
    { id: 'whatsapp', label: 'WhatsApp', hint: 'Tombol floating' },
    { id: 'markup', label: 'Markup', hint: 'Harga global %' },
    { id: 'labels', label: 'Label Tag', hint: 'Tag di produk' },
];

const th = { padding: '0.75rem 1rem', fontWeight: 600, color: AC.muted, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
const td = { padding: '0.65rem 1rem', verticalAlign: 'middle' };
const lbl = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: AC.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' };

function SectionHead({ title, desc }) {
    return (
        <div className="settings-section-head">
            <h3 style={{ margin: 0, color: AC.blue, fontSize: '1.15rem' }}>{title}</h3>
            {desc && <p style={{ margin: '6px 0 0', color: AC.muted, fontSize: '0.88rem', lineHeight: 1.55 }}>{desc}</p>}
        </div>
    );
}

export default function SettingsPage() {
    const [section, setSection] = useState('branding');
    const [markup, setMarkup] = useState('');
    const [storeName, setStoreName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [waNumber, setWaNumber] = useState('');
    const [waMessage, setWaMessage] = useState('');
    const [labelRows, setLabelRows] = useState([]);
    const [labelMsg, setLabelMsg] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingLabels, setSavingLabels] = useState(false);
    const [saved, setSaved] = useState('');
    const [dirty, setDirty] = useState(false);
    const logoInputRef = useRef(null);

    const loadLabels = useCallback(() => {
        fetch('/api/admin/source-labels')
            .then((r) => r.json())
            .then((d) => {
                if (d.success) setLabelRows(d.sources || []);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/settings').then((r) => r.json()),
            fetch('/api/admin/source-labels').then((r) => r.json()),
        ])
            .then(([settingsRes, labelsRes]) => {
                if (settingsRes.success) {
                    const s = settingsRes.settings;
                    setMarkup(s.markup_percent ?? '20');
                    setStoreName(s.store_name ?? 'HEY BLOSSOM');
                    setLogoUrl(s.store_logo_url ?? '');
                    setWaNumber(s.whatsapp_number ?? '');
                    setWaMessage(s.whatsapp_message ?? 'Halo, saya tertarik dengan produk di toko Anda.');
                }
                if (labelsRes.success) setLabelRows(labelsRes.sources || []);
            })
            .finally(() => setLoading(false));
    }, []);

    function handleLogoFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('File harus berupa gambar.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const maxH = 120;
                const scale = Math.min(1, maxH / img.height);
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                const pixels = ctx.getImageData(0, 0, w, h).data;
                let hasTransparency = false;
                for (let i = 3; i < pixels.length; i += 4) {
                    if (pixels[i] < 255) {
                        hasTransparency = true;
                        break;
                    }
                }

                // JPEG tidak mendukung transparansi — area remove-bg jadi hitam jika dipaksa ke JPEG.
                if (hasTransparency || file.type === 'image/png') {
                    setLogoUrl(canvas.toDataURL('image/png'));
                } else {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    setLogoUrl(canvas.toDataURL('image/jpeg', 0.82));
                }
                setDirty(true);
            };
            img.onerror = () => alert('Gagal membaca gambar.');
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    async function saveGeneral() {
        setSaving(true);
        setSaved('');
        const res = await fetch('/api/admin/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                markup_percent: markup,
                store_name: storeName,
                store_logo_url: logoUrl,
                whatsapp_number: waNumber.replace(/\D/g, ''),
                whatsapp_message: waMessage,
            }),
        });
        const d = await res.json();
        setSaving(false);
        if (d.success) {
            setSaved('general');
            setDirty(false);
            setTimeout(() => setSaved(''), 2500);
        } else alert('Gagal: ' + d.error);
    }

    async function saveLabels() {
        setSavingLabels(true);
        setLabelMsg('');
        const labels = {};
        labelRows.forEach((r) => {
            if (r.label && r.label.trim()) labels[r.source] = r.label.trim();
        });
        const res = await fetch('/api/admin/source-labels', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labels }),
        });
        const d = await res.json();
        setSavingLabels(false);
        if (d.success) {
            setLabelMsg('✓ Label sumber tersimpan');
            loadLabels();
        } else setLabelMsg('Gagal: ' + (d.error || 'unknown'));
    }

    const exampleBase = 1000000;
    const examplePct = Number(markup || 0);
    const exampleSell = Math.round(exampleBase * (1 + examplePct / 100));
    const waDigits = waNumber.replace(/\D/g, '');
    const showGeneralSave = section !== 'labels';

    if (loading) return <div style={{ color: AC.muted }}>Memuat...</div>;

    return (
        <div className="settings-page">
            <PageTitle title="Pengaturan" subtitle="Kelola toko per bagian — pilih menu di kiri" />

            <div className="settings-layout">
                <nav className="settings-nav" aria-label="Bagian pengaturan">
                    {SECTIONS.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            className={`settings-nav-item${section === s.id ? ' active' : ''}`}
                            onClick={() => setSection(s.id)}
                        >
                            <span className="settings-nav-label">{s.label}</span>
                            <span className="settings-nav-hint">{s.hint}</span>
                        </button>
                    ))}
                </nav>

                <div className="settings-panel">
                    {section === 'branding' && (
                        <Card>
                            <SectionHead
                                title="Branding Toko"
                                desc="Logo dan nama dipakai di storefront, login admin, dan sidebar."
                            />
                            <div className="settings-split">
                                <div className="settings-split-main">
                                    <label style={lbl}>Nama Toko</label>
                                    <input
                                        value={storeName}
                                        onChange={(e) => { setStoreName(e.target.value); setDirty(true); }}
                                        placeholder="HEY BLOSSOM"
                                        style={{ ...inputStyle, width: '100%', marginBottom: 16 }}
                                    />
                                    <label style={lbl}>Logo Gambar</label>
                                    <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: AC.muted, lineHeight: 1.45 }}>
                                        PNG dengan background transparan (remove bg) didukung. Hindari export JPEG jika sudah di-remove bg.
                                    </p>
                                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoFile} style={{ display: 'none' }} />
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                                        <Button variant="pink" onClick={() => logoInputRef.current?.click()}>
                                            {logoUrl ? 'Ganti Gambar Logo' : 'Upload Gambar Logo'}
                                        </Button>
                                        {logoUrl && (
                                            <Button variant="outline" onClick={() => { setLogoUrl(''); setDirty(true); }}>
                                                Hapus Logo
                                            </Button>
                                        )}
                                    </div>
                                    {logoUrl.startsWith('data:') && (
                                        <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: AC.blue, fontWeight: 600 }}>
                                            Gambar baru — jangan lupa Simpan Pengaturan
                                        </p>
                                    )}
                                    <label style={lbl}>Atau URL Logo</label>
                                    <input
                                        value={logoUrl.startsWith('data:') ? '' : logoUrl}
                                        onChange={(e) => { setLogoUrl(e.target.value); setDirty(true); }}
                                        placeholder="https://.../logo.png"
                                        style={{ ...inputStyle, width: '100%' }}
                                    />
                                </div>
                                <div className="settings-split-aside">
                                    <div className="settings-preview-label">Preview</div>
                                    <div className="settings-logo-preview">
                                        {logoUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={logoUrl} alt="logo preview" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
                                        ) : (
                                            <span style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700 }}>{storeName || 'HEY BLOSSOM'}</span>
                                        )}
                                    </div>
                                    <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: AC.muted, lineHeight: 1.45 }}>
                                        Tampilan di header storefront & sidebar admin.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {section === 'whatsapp' && (
                        <Card>
                            <SectionHead
                                title="WhatsApp Floating"
                                desc="Tombol hijau di kanan bawah storefront. Nomor tanpa + (contoh: 6281234567890)."
                            />
                            <div className="settings-split">
                                <div className="settings-split-main">
                                    <label style={lbl}>Nomor WhatsApp</label>
                                    <input
                                        value={waNumber}
                                        onChange={(e) => { setWaNumber(e.target.value); setDirty(true); }}
                                        placeholder="6281234567890"
                                        style={{ ...inputStyle, width: '100%', marginBottom: 16 }}
                                    />
                                    <label style={lbl}>Pesan default</label>
                                    <input
                                        value={waMessage}
                                        onChange={(e) => { setWaMessage(e.target.value); setDirty(true); }}
                                        style={{ ...inputStyle, width: '100%' }}
                                    />
                                </div>
                                <div className="settings-split-aside">
                                    <div className="settings-preview-label">Preview storefront</div>
                                    <div className="settings-wa-preview">
                                        {waDigits ? (
                                            <>
                                                <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: AC.text }}>
                                                    Tombol muncul setelah disimpan.
                                                </p>
                                                <div className="wa-float-btn wa-float-btn--preview" aria-hidden="true">
                                                    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                    </svg>
                                                </div>
                                            </>
                                        ) : (
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: AC.muted }}>
                                                Isi nomor di kiri — tombol belum aktif di storefront.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {section === 'markup' && (
                        <Card>
                            <SectionHead
                                title="Markup Global (%)"
                                desc="Berlaku untuk produk tanpa upping manual. Produk dengan upping di tab Produk pakai nominal sendiri."
                            />
                            <div className="settings-split">
                                <div className="settings-split-main">
                                    <label style={lbl}>Persentase markup</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <input
                                            type="number"
                                            value={markup}
                                            onChange={(e) => { setMarkup(e.target.value); setDirty(true); }}
                                            style={{ ...inputStyle, width: 120, fontSize: '1.1rem' }}
                                        />
                                        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>%</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: AC.muted, lineHeight: 1.5 }}>
                                        Contoh perhitungan di panel kanan menggunakan harga Rp 1.000.000.
                                    </p>
                                </div>
                                <div className="settings-split-aside">
                                    <div className="settings-preview-label">Simulasi harga</div>
                                    <div style={{ background: AC.pinkSoft, borderRadius: 10, padding: '1rem', fontSize: '0.9rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span>Harga asli</span><strong>{formatIDR(exampleBase)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span>Markup ({examplePct}%)</span><strong>+{formatIDR(exampleSell - exampleBase)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${AC.border}`, paddingTop: 8 }}>
                                            <span>Harga jual</span><strong style={{ color: AC.blue }}>{formatIDR(exampleSell)}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {section === 'labels' && (
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '1.25rem 1.25rem 0' }}>
                                <SectionHead
                                    title="Label Sumber (Tag Produk)"
                                    desc="Ubah teks tag yang tampil di kartu produk storefront."
                                />
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ background: AC.pinkSoft, textAlign: 'left' }}>
                                            <th style={th}>Sumber</th>
                                            <th style={th}>Produk</th>
                                            <th style={th}>Label Tampilan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {labelRows.map((r) => (
                                            <tr key={r.source} style={{ borderTop: `1px solid ${AC.border}` }}>
                                                <td style={{ ...td, fontWeight: 600 }}>{r.source}</td>
                                                <td style={td}>{r.count.toLocaleString('id-ID')}</td>
                                                <td style={td}>
                                                    <input
                                                        value={r.label}
                                                        placeholder={r.source}
                                                        onChange={(e) => setLabelRows((rows) => rows.map((x) => (x.source === r.source ? { ...x, label: e.target.value } : x)))}
                                                        style={{ ...inputStyle, width: '100%', minWidth: 180, padding: '0.4rem 0.6rem' }}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                        {labelRows.length === 0 && (
                                            <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: AC.muted }}>Belum ada sumber.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 12, borderTop: `1px solid ${AC.border}` }}>
                                <Button variant="pink" onClick={saveLabels} disabled={savingLabels}>
                                    {savingLabels ? 'Menyimpan...' : 'Simpan Label'}
                                </Button>
                                {labelMsg && (
                                    <span style={{ color: labelMsg.startsWith('✓') ? AC.success : AC.muted, fontSize: '0.85rem' }}>{labelMsg}</span>
                                )}
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {showGeneralSave && (
                <div className="settings-save-float">
                    <div className="settings-save-float-inner">
                        {dirty && !saving && (
                            <span className="settings-save-float-hint">Ada perubahan belum disimpan</span>
                        )}
                        {saved === 'general' && (
                            <span style={{ color: AC.success, fontSize: '0.9rem', fontWeight: 600 }}>✓ Tersimpan</span>
                        )}
                        <Button variant="pink" onClick={saveGeneral} disabled={saving} style={{ padding: '0.7rem 1.5rem', minWidth: 180 }}>
                            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
