'use client';
import { useEffect, useState } from 'react';
import { AC, PageTitle, Card, Button, inputStyle, formatIDR } from '../../../components/admin-ui';

export default function SettingsPage() {
    const [markup, setMarkup] = useState('');
    const [storeName, setStoreName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetch('/api/admin/settings')
            .then((r) => r.json())
            .then((d) => {
                if (d.success) {
                    setMarkup(d.settings.markup_percent ?? '20');
                    setStoreName(d.settings.store_name ?? 'LUXE');
                    setLogoUrl(d.settings.store_logo_url ?? '');
                }
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
                // Downscale to max height 120px to keep the stored data URL small
                const maxH = 120;
                const scale = Math.min(1, maxH / img.height);
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/png');
                setLogoUrl(dataUrl);
            };
            img.onerror = () => alert('Gagal membaca gambar.');
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    async function save() {
        setSaving(true);
        setSaved(false);
        const res = await fetch('/api/admin/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markup_percent: markup, store_name: storeName, store_logo_url: logoUrl }),
        });
        const d = await res.json();
        setSaving(false);
        if (d.success) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } else alert('Gagal: ' + d.error);
    }

    const exampleBase = 1000000;
    const examplePct = Number(markup || 0);
    const exampleSell = Math.round(exampleBase * (1 + examplePct / 100));

    if (loading) return <div style={{ color: AC.muted }}>Memuat...</div>;

    return (
        <div>
            <PageTitle title="Pengaturan" subtitle="Konfigurasi global toko" />

            <Card style={{ maxWidth: 560, marginBottom: '1.25rem' }}>
                <h3 style={{ marginTop: 0 }}>Branding Toko</h3>
                <p style={{ color: AC.muted, fontSize: '0.9rem', lineHeight: 1.6 }}>
                    Nama toko tampil sebagai logo teks di header storefront. Jika URL gambar logo diisi,
                    header akan memakai gambar tersebut menggantikan teks.
                </p>

                <label style={lbl}>Nama Toko (logo teks)</label>
                <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="LUXE" style={{ ...inputStyle, width: '100%', marginBottom: 12 }} />

                <label style={lbl}>Logo Gambar (opsional)</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ ...inputStyle, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff' }}>
                        <span>Upload file…</span>
                        <input type="file" accept="image/*" onChange={handleLogoFile} style={{ display: 'none' }} />
                    </label>
                    {logoUrl && (
                        <Button variant="danger" onClick={() => setLogoUrl('')}>Hapus logo</Button>
                    )}
                </div>
                <div style={{ marginTop: 8 }}>
                    <input
                        value={logoUrl.startsWith('data:') ? '' : logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="atau tempel URL gambar: https://.../logo.png"
                        style={{ ...inputStyle, width: '100%' }}
                    />
                    {logoUrl.startsWith('data:') && (
                        <div style={{ color: AC.muted, fontSize: '0.75rem', marginTop: 4 }}>Logo dari file terupload tersimpan.</div>
                    )}
                </div>

                <div style={{ marginTop: 16, background: '#1d1d1f', borderRadius: 10, padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', minHeight: 64 }}>
                    <span style={{ color: AC.muted, fontSize: '0.75rem', marginRight: 14, textTransform: 'uppercase', letterSpacing: '1px' }}>Preview</span>
                    {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="logo preview" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
                    ) : (
                        <span style={{ fontFamily: 'Playfair Display, serif', color: '#fff', fontSize: '1.5rem', fontWeight: 700 }}>
                            {storeName || 'LUXE'}<span style={{ color: AC.gold }}>.</span>
                        </span>
                    )}
                </div>
            </Card>

            <Card style={{ maxWidth: 560 }}>
                <h3 style={{ marginTop: 0 }}>Markup Harga Jual</h3>
                <p style={{ color: AC.muted, fontSize: '0.9rem', lineHeight: 1.6 }}>
                    Persentase markup ditambahkan ke <strong>harga asli</strong> untuk menghitung harga jual yang
                    tampil di storefront. Harga asli tetap tersembunyi dari pelanggan.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '1rem 0' }}>
                    <input type="number" value={markup} onChange={(e) => setMarkup(e.target.value)} style={{ ...inputStyle, width: 120, fontSize: '1.1rem' }} />
                    <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>%</span>
                </div>

                <div style={{ background: '#fafafa', borderRadius: 10, padding: '1rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    <div style={{ color: AC.muted, marginBottom: 6 }}>Contoh perhitungan:</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Harga asli</span><strong>{formatIDR(exampleBase)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Markup ({examplePct}%)</span><strong>+{formatIDR(exampleSell - exampleBase)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${AC.border}`, marginTop: 6, paddingTop: 6 }}><span>Harga jual</span><strong style={{ color: AC.gold }}>{formatIDR(exampleSell)}</strong></div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Button variant="gold" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
                    {saved && <span style={{ color: AC.success, fontSize: '0.9rem' }}>✓ Tersimpan</span>}
                </div>
            </Card>
        </div>
    );
}

const lbl = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: AC.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' };
