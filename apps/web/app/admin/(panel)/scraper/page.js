'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { AC, PageTitle, Card, Button, inputStyle } from '../../../components/admin-ui';
import { CURATED_SITES, getTargetsForSite, getScrapeTargetById } from '@luxe/shared/scrape-targets';
import { VIP_BRANDS } from '@luxe/shared/vip-config';

const GENDER_FROM_URL_SITES = new Set(['HuntStreet', 'ZetaBags']);
const GENDER_INFERRED_SITES = new Set(['Banananina', "Yoogi's Closet", 'ZZER']);

function firstTarget(site) {
    return getTargetsForSite(site)[0] || null;
}

function buildCliCommand({ url, headless, maxPages, maxDurationMinutes, gender, brand, partialScrape, skipDetail, site, curatedId }) {
    const parts = ['npm run scrape --', `--url "${url}"`, `--maxPages ${maxPages}`, `--headless ${headless}`];
    if (gender && !GENDER_INFERRED_SITES.has(site)) parts.push(`--gender ${gender}`);
    if (brand) parts.push(`--brand "${brand}"`);
    const target = curatedId ? getScrapeTargetById(curatedId) : null;
    if (target?.categoryJobs?.length) {
        parts.push(`--categoryJobs "${target.categoryJobs.map((c) => c.tab).join(',')}"`);
    } else if (target?.categoryTab) {
        parts.push(`--categoryTab "${target.categoryTab}"`);
        if (target?.categoryHint) parts.push(`--categoryHint "${target.categoryHint}"`);
    }
    if (target?.maxApiPages) parts.push(`--maxApiPages ${target.maxApiPages}`);
    if (maxDurationMinutes > 0) parts.push(`--maxDuration ${Number(maxDurationMinutes) * 60}`);
    if (partialScrape) parts.push('--partial');
    if (skipDetail) parts.push('--skipDetail');
    return parts.join(' ');
}

export default function ScraperPage() {
    const initialTarget = firstTarget('HuntStreet');
    const [site, setSite] = useState('HuntStreet');
    const [url, setUrl] = useState(initialTarget?.url || '');
    const [maxPages, setMaxPages] = useState(initialTarget?.maxPages || 1);
    const [maxDurationMinutes, setMaxDurationMinutes] = useState(
        initialTarget?.maxDurationSeconds ? Math.round(initialTarget.maxDurationSeconds / 60) : ''
    );
    const [headless, setHeadless] = useState(true);
    const [gender, setGender] = useState(initialTarget?.gender || '');
    const [brand, setBrand] = useState(initialTarget?.brand || '');
    const [partialScrape, setPartialScrape] = useState(true);
    const [skipDetail, setSkipDetail] = useState(false);
    const [curatedId, setCuratedId] = useState(initialTarget?.id || '');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef(null);

    const siteTargets = useMemo(() => getTargetsForSite(site), [site]);

    const cliCommand = useMemo(
        () => buildCliCommand({ url, headless, maxPages, maxDurationMinutes, gender, brand, partialScrape, skipDetail, site, curatedId }),
        [url, headless, maxPages, maxDurationMinutes, gender, brand, partialScrape, skipDetail, site, curatedId]
    );

    useEffect(() => () => clearInterval(timerRef.current), []);

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
        setMaxDurationMinutes(t.maxDurationSeconds ? Math.round(t.maxDurationSeconds / 60) : '');
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
        } catch { /* clipboard blocked */ }
    }

    async function runScrapeFromAdmin() {
        setLoading(true);
        setError('');
        setResult(null);
        setElapsed(0);
        timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

        try {
            const body = {
                url,
                headless,
                maxPages: Number(maxPages),
                partialScrape,
                skipDetail,
            };
            if (gender && !GENDER_INFERRED_SITES.has(site)) body.gender = gender;
            if (brand) body.brand = brand;

            const target = curatedId ? getScrapeTargetById(curatedId) : null;
            if (target?.categoryJobs?.length) {
                body.categoryJobs = target.categoryJobs;
            } else {
                if (target?.categoryTab) body.categoryTab = target.categoryTab;
                if (target?.categoryHint) body.categoryHint = target.categoryHint;
            }
            if (target?.maxApiPages) body.maxApiPages = target.maxApiPages;
            const durationMins = Number(maxDurationMinutes);
            if (durationMins > 0) body.maxDurationSeconds = durationMins * 60;

            const res = await fetch('/api/admin/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const d = await res.json();
            if (d.success) setResult(d);
            else setError(d.message || 'Sinkronisasi gagal.');
        } catch (e) {
            setError(e.message);
        } finally {
            clearInterval(timerRef.current);
            setLoading(false);
        }
    }

    return (
        <div>
            <PageTitle
                title="Product List"
                subtitle="Jalankan dari laptop lokal (Laragon). Termasuk multi-foto + deskripsi otomatis."
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
                <Card>
                    <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Konfigurasi</h3>

                    <label style={lbl}>Website</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {CURATED_SITES.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => changeSite(s)}
                                disabled={loading}
                                style={{
                                    padding: '0.45rem 0.9rem',
                                    borderRadius: 20,
                                    border: `1px solid ${site === s ? AC.dark : AC.border}`,
                                    background: site === s ? AC.dark : 'transparent',
                                    color: site === s ? '#fff' : AC.text,
                                    cursor: loading ? 'default' : 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <label style={lbl}>Job product list — {site}</label>
                    <select
                        value={curatedId}
                        onChange={(e) => applyCuratedTarget(e.target.value)}
                        disabled={loading}
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
                        disabled={loading}
                        style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                        <div>
                            <label style={lbl}>Gender</label>
                            <input
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                placeholder={GENDER_INFERRED_SITES.has(site) ? 'Otomatis per produk' : 'men / women'}
                                disabled={loading || GENDER_INFERRED_SITES.has(site)}
                                style={{ ...inputStyle, width: '100%', opacity: GENDER_INFERRED_SITES.has(site) ? 0.65 : 1 }}
                            />
                        </div>
                        <div>
                            <label style={lbl}>Brand</label>
                            <input
                                value={brand}
                                onChange={(e) => setBrand(e.target.value)}
                                placeholder={VIP_BRANDS.join(' / ')}
                                disabled={loading}
                                style={{ ...inputStyle, width: '100%' }}
                            />
                        </div>
                        <div>
                            <label style={lbl}>Max Halaman</label>
                            <input
                                type="number"
                                value={maxPages}
                                onChange={(e) => setMaxPages(e.target.value)}
                                disabled={loading}
                                style={{ ...inputStyle, width: '100%' }}
                            />
                        </div>
                        <div>
                            <label style={lbl}>Batas Waktu (menit)</label>
                            <input
                                type="number"
                                min="1"
                                value={maxDurationMinutes}
                                onChange={(e) => setMaxDurationMinutes(e.target.value)}
                                placeholder="Kosong = tanpa batas"
                                disabled={loading}
                                style={{ ...inputStyle, width: '100%' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', cursor: loading ? 'default' : 'pointer' }}>
                            <input type="checkbox" checked={partialScrape} onChange={(e) => setPartialScrape(e.target.checked)} disabled={loading} />
                            Sinkronisasi sebagian (jangan sweep sold-out global)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', cursor: loading ? 'default' : 'pointer' }}>
                            <input type="checkbox" checked={headless} onChange={(e) => setHeadless(e.target.checked)} disabled={loading} />
                            Headless browser
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', cursor: loading ? 'default' : 'pointer' }}>
                            <input type="checkbox" checked={skipDetail} onChange={(e) => setSkipDetail(e.target.checked)} disabled={loading} />
                            Lewati multi-foto &amp; deskripsi (sinkronisasi cepat)
                        </label>
                    </div>

                    <Button variant="pink" onClick={runScrapeFromAdmin} disabled={loading} style={{ width: '100%', padding: '0.8rem', marginBottom: 10 }}>
                        {loading ? `Memproses... (${elapsed}s)` : 'Mulai Sinkronisasi'}
                    </Button>
                    {loading && (
                        <p style={{ color: AC.muted, fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                            Proses berjalan di laptop ini (Chrome/Puppeteer). Jangan tutup tab — bisa beberapa menit jika banyak produk.
                        </p>
                    )}
                </Card>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <Card>
                        <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Hasil</h3>
                        {!result && !error && !loading && (
                            <div style={{ color: AC.muted, fontSize: '0.9rem' }}>Belum ada eksekusi. Klik Mulai Sinkronisasi.</div>
                        )}
                        {loading && <div style={{ color: AC.blue, fontSize: '0.9rem' }}>● Sedang berjalan ({elapsed}s)...</div>}
                        {error && (
                            <div style={{ background: 'rgba(192,57,43,0.1)', color: AC.danger, padding: '0.8rem', borderRadius: 8, fontSize: '0.85rem' }}>
                                {error}
                            </div>
                        )}
                        {result && (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                    <Stat label="Total Produk" value={result.total_products} />
                                    <Stat label="Durasi" value={`${result.duration_seconds}s`} />
                                    <Stat label="Baru" value={result.db_result?.inserted ?? 0} color={AC.success} />
                                    <Stat label="Diperbarui" value={result.db_result?.updated ?? 0} />
                                    <Stat label="Multi-foto" value={result.detail_stats?.multi_photo ?? 0} color={AC.blue} />
                                    <Stat label="Ada deskripsi" value={result.detail_stats?.with_description ?? 0} />
                                    <Stat label="Error" value={result.total_errors} color={result.total_errors ? AC.danger : AC.muted} />
                                </div>
                                {result.time_limit_reached && (
                                    <div style={{ color: AC.blue, fontSize: '0.85rem', marginBottom: 8 }}>
                                        ⏱️ Dihentikan karena batas waktu ({result.max_duration_seconds}s) — data yang terkumpul tetap disimpan.
                                    </div>
                                )}
                                <div style={{ color: AC.success, fontWeight: 600, fontSize: '0.9rem' }}>
                                    ✓ Tersimpan ke Supabase (sesi #{result.session_id})
                                </div>
                            </div>
                        )}
                    </Card>

                    <Card>
                        <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Alternatif: Terminal</h3>
                        <p style={{ color: AC.muted, fontSize: '0.85rem', lineHeight: 1.6, marginTop: 0 }}>
                            Atau salin perintah terminal di bawah. Di Vercel (production) sinkronisasi hanya bisa via terminal lokal.
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
                        <Button variant="outline" onClick={copyCommand} style={{ width: '100%' }}>
                            {copied ? '✓ Disalin!' : 'Salin Perintah CLI'}
                        </Button>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, color }) {
    return (
        <div style={{ background: '#fafafa', borderRadius: 8, padding: '0.7rem' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: color || AC.text }}>{value}</div>
            <div style={{ color: AC.muted, fontSize: '0.75rem' }}>{label}</div>
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
