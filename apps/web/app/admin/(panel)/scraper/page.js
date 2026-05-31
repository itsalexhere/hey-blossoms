'use client';
import { useState, useMemo } from 'react';
import { AC, PageTitle, Card, Button, inputStyle } from '../../../components/admin-ui';
import { CURATED_SITES, getTargetsForSite } from '@luxe/shared/scrape-targets';
import { VIP_BRANDS } from '@luxe/shared/vip-config';

const GENDER_FROM_URL_SITES = new Set(['HuntStreet', 'ZetaBags']);
const GENDER_INFERRED_SITES = new Set(['Banananina', "Yoogi's Closet"]);

function firstTarget(site) {
    return getTargetsForSite(site)[0] || null;
}

function buildCliCommand({ url, headless, maxPages, gender, brand, partialScrape, site }) {
    const parts = ['npm run scrape --', `--url "${url}"`, `--maxPages ${maxPages}`, `--headless ${headless}`];
    if (gender && !GENDER_INFERRED_SITES.has(site)) parts.push(`--gender ${gender}`);
    if (brand) parts.push(`--brand "${brand}"`);
    if (partialScrape) parts.push('--partial');
    return parts.join(' ');
}

export default function ScraperPage() {
    const initialTarget = firstTarget('HuntStreet');
    const [site, setSite] = useState('HuntStreet');
    const [url, setUrl] = useState(initialTarget?.url || '');
    const [maxPages, setMaxPages] = useState(initialTarget?.maxPages || 1);
    const [headless, setHeadless] = useState(true);
    const [gender, setGender] = useState(initialTarget?.gender || '');
    const [brand, setBrand] = useState(initialTarget?.brand || '');
    const [partialScrape, setPartialScrape] = useState(true);
    const [curatedId, setCuratedId] = useState(initialTarget?.id || '');
    const [copied, setCopied] = useState(false);

    const siteTargets = useMemo(() => getTargetsForSite(site), [site]);

    const cliCommand = useMemo(
        () => buildCliCommand({ url, headless, maxPages, gender, brand, partialScrape, site }),
        [url, headless, maxPages, gender, brand, partialScrape, site]
    );

    function applyCuratedTarget(id, siteName = site) {
        const targets = getTargetsForSite(siteName);
        const t = targets.find((x) => x.id === id) || targets[0];
        if (!t) return;
        setCuratedId(t.id);
        setUrl(t.url);
        setMaxPages(t.maxPages);
        setGender(t.gender || '');
        setBrand(t.brand != null ? t.brand : '');
        setPartialScrape(t.partialScrape !== false);
    }

    function changeSite(s) {
        setSite(s);
        const t = firstTarget(s);
        if (t) applyCuratedTarget(t.id, s);
    }

    async function copyCommand() {
        try {
            await navigator.clipboard.writeText(`cd js_scraper\n${cliCommand}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard may be blocked */
        }
    }

    return (
        <div>
            <PageTitle
                title="Scraper"
                subtitle="Scraping dijalankan di laptop lokal (Puppeteer). Vercel hanya menampilkan katalog."
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
                <Card>
                    <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Konfigurasi</h3>

                    <label style={lbl}>Website</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {CURATED_SITES.map((s) => (
                            <button
                                key={s}
                                onClick={() => changeSite(s)}
                                style={{
                                    padding: '0.45rem 0.9rem',
                                    borderRadius: 20,
                                    border: `1px solid ${site === s ? AC.dark : AC.border}`,
                                    background: site === s ? AC.dark : 'transparent',
                                    color: site === s ? '#fff' : AC.text,
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <label style={lbl}>Job scrape — {site}</label>
                    <select
                        value={curatedId}
                        onChange={(e) => applyCuratedTarget(e.target.value)}
                        style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
                    >
                        {siteTargets.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.label}
                            </option>
                        ))}
                    </select>

                    <label style={lbl}>URL Target</label>
                    <input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                        <div>
                            <label style={lbl}>Gender</label>
                            <input
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                placeholder={GENDER_INFERRED_SITES.has(site) ? 'Otomatis per produk' : 'men / women'}
                                disabled={GENDER_INFERRED_SITES.has(site)}
                                style={{ ...inputStyle, width: '100%', opacity: GENDER_INFERRED_SITES.has(site) ? 0.65 : 1 }}
                            />
                            {GENDER_INFERRED_SITES.has(site) && (
                                <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: AC.muted, lineHeight: 1.4 }}>
                                    {site === 'Banananina'
                                        ? 'Banananina: gender dari URL produk (/men/ = men, selain itu = women).'
                                        : "Yoogi's Closet: gender otomatis dari judul/tipe produk."}
                                </p>
                            )}
                            {GENDER_FROM_URL_SITES.has(site) && (
                                <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: AC.muted, lineHeight: 1.4 }}>
                                    Gender mengikuti job yang dipilih di atas.
                                </p>
                            )}
                        </div>
                        <div>
                            <label style={lbl}>Brand</label>
                            <input
                                value={brand}
                                onChange={(e) => setBrand(e.target.value)}
                                placeholder={VIP_BRANDS.join(' / ')}
                                style={{ ...inputStyle, width: '100%' }}
                            />
                        </div>
                        <div>
                            <label style={lbl}>Max Halaman</label>
                            <input
                                type="number"
                                value={maxPages}
                                onChange={(e) => setMaxPages(e.target.value)}
                                style={{ ...inputStyle, width: '100%' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={partialScrape} onChange={(e) => setPartialScrape(e.target.checked)} />
                            Scrape sebagian (jangan sweep sold-out global)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={headless} onChange={(e) => setHeadless(e.target.checked)} />
                            Headless
                        </label>
                    </div>
                </Card>

                <Card>
                    <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Jalankan di Laptop</h3>
                    <p style={{ color: AC.muted, fontSize: '0.85rem', lineHeight: 1.6, marginTop: 0 }}>
                        Buka terminal di folder <code style={{ fontSize: '0.8rem' }}>js_scraper</code>, lalu jalankan perintah berikut.
                        Hasil scrape otomatis masuk ke Supabase — cek menu <strong>Scrape Logs</strong>.
                    </p>

                    <pre
                        style={{
                            background: '#1e1e1e',
                            color: '#d4d4d4',
                            padding: '1rem',
                            borderRadius: 8,
                            fontSize: '0.78rem',
                            lineHeight: 1.5,
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            margin: '0 0 12px',
                        }}
                    >
                        {`cd js_scraper\n${cliCommand}`}
                    </pre>

                    <Button variant="gold" onClick={copyCommand} style={{ width: '100%', padding: '0.8rem' }}>
                        {copied ? '✓ Disalin!' : 'Salin Perintah'}
                    </Button>

                    <p style={{ color: AC.muted, fontSize: '0.78rem', marginTop: 12, lineHeight: 1.5 }}>
                        Pastikan <code>.env.local</code> berisi kredensial Supabase. Proses scrape membutuhkan Chrome/Puppeteer di laptop.
                    </p>
                </Card>
            </div>
        </div>
    );
}

const lbl = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: AC.muted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};
