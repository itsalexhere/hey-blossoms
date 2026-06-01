/**
 * Scrape & save ONE Yoogi's Closet product (sample test).
 * Usage: cd js_scraper && node tools/scrape-one-yoogis.mjs [product_url]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const envFile of ['.env.local', 'apps/web/.env.local']) {
    const envPath = path.join(root, envFile);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r$/, '').trim();
    }
}

const { YoogisclosetScraper } = await import('../tools/scraper/scrapers/yoogiscloset.js');
const {
    getOrCreateSource,
    createSession,
    updateSession,
    insertProducts,
} = await import('../packages/shared/src/db.js');
const { toIDR } = await import('../packages/shared/src/currency.js');

const listingUrl = 'https://www.yoogiscloset.com/louis-vuitton';
const productUrlArg = process.argv[2] || null;

const scraper = new YoogisclosetScraper({
    headless: true,
    maxPages: 1,
    brand: 'Louis Vuitton',
    skipDetail: false,
});

const startTime = Date.now();
const source = await getOrCreateSource("Yoogi's Closet");
const sessionId = await createSession(source.id, listingUrl + ' (sample 1 produk)');

try {
    await scraper.launchBrowser();
    await scraper.navigateWithRetry(listingUrl, { waitAfter: 2000, waitUntil: 'networkidle2' });
    await scraper.page.waitForFunction(
        () => document.querySelectorAll('.product-info h3').length > 0,
        { timeout: 25000 }
    ).catch(() => {});

    let products = await scraper._extractFromPage();
    products = products.map((p) => scraper._normalizeProduct(p));

    let product = productUrlArg
        ? products.find((p) => p.product_url === productUrlArg)
        : products[0];

    if (productUrlArg && !product) {
        product = scraper._normalizeProduct({
            title: 'Sample',
            product_url: productUrlArg,
            price_original: 0,
            image_url: null,
            condition: null,
        });
    }

    if (!product?.product_url) {
        throw new Error('Tidak ada produk ditemukan di halaman listing.');
    }

    console.log('Produk:', product.title);
    console.log('URL:', product.product_url);

    const [enriched] = await scraper.enrichProducts([product]);
    product = enriched;

    if (product.currency === 'USD' && Number(product.price_original) > 0) {
        product.price_idr = await toIDR(product.price_original, 'USD');
    }

    console.log('Foto:', product.images?.length || (product.image_url ? 1 : 0));
    console.log('Deskripsi preview:', (product.description || '').slice(0, 300));

    const dbResult = await insertProducts([product], source.id, sessionId);
    const duration = Math.round((Date.now() - startTime) / 1000);

    await updateSession(
        sessionId,
        'completed',
        1,
        0,
        0,
        duration,
        dbResult.inserted,
        dbResult.updated
    );

    console.log('\nSelesai — tersimpan ke Supabase:', dbResult);
    console.log('Refresh toko dan cari:', product.title);
} catch (e) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    await updateSession(sessionId, 'failed', 0, 1, 0, duration).catch(() => {});
    console.error('Gagal:', e.message);
    process.exit(1);
} finally {
    await scraper.closeBrowser();
}
