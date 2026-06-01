import { BaseScraper } from './base.js';
import { parseHuntstreetUrl, inferCategoryFromTitle } from '@luxe/shared/product-taxonomy';
import { extractPdpFromPage } from '../lib/pdp-extract.js';

// ============================================================
// HuntStreet Scraper — Full paginated scrape (up to 111+ pages)
// Strategy: auto-detect total pages on page 1, then parallel
//           batch-fetch remaining pages (concurrency=5)
// ============================================================

const BASE_URL = 'https://www.huntstreet.com';
const CONCURRENCY = 5;   // simultaneous browser tabs
const PAGE_DELAY_MS = 800; // ms between each tab open within a batch

export class HuntstreetScraper extends BaseScraper {
    getSourceName() { return 'HuntStreet'; }
    getBaseUrl()    { return BASE_URL; }
    getPlatform()   { return 'custom'; }

    /** Resolved once per scrape run from URL + options. */
    _resolveContext(url) {
        const fromUrl = parseHuntstreetUrl(url);
        return {
            gender: this.options.gender || fromUrl.gender || null,
            brand: this.options.brand || fromUrl.brand || null,
            categoryHint: this.options.categoryHint || fromUrl.categoryHint || null,
        };
    }

    _normalizeProduct(raw, ctx) {
        const title = raw.title;
        const brand = ctx.brand || raw.brand || null;
        const category =
            inferCategoryFromTitle(title, ctx.categoryHint || raw.brand || '') ||
            ctx.categoryHint ||
            null;

        return {
            title,
            brand,
            category,
            gender: ctx.gender || null,
            price_original: this._parsePrice(raw.priceRaw),
            currency: 'IDR',
            price_idr: this._parsePrice(raw.priceRaw),
            stock_status: 'available',
            stock_qty: null,
            image_url: this._upgradeHuntstreetImage(raw.imageUrl) || null,
            product_url: raw.href,
            description: raw.cond ? `Condition: ${raw.cond}` : null,
        };
    }

    // ─────────────────────────────────────────────
    // Main entry
    // ─────────────────────────────────────────────
    async scrape(url) {
        const allProducts = [];
        const seenUrls   = new Set();
        this._ctx = this._resolveContext(url);
        console.log(`[HuntStreet] Context: gender=${this._ctx.gender || '-'} brand=${this._ctx.brand || '-'} categoryHint=${this._ctx.categoryHint || '-'}`);

        try {
            await this.launchBrowser();

            // ── Page 1: get products + detect total pages ──
            console.log(`[HuntStreet] Scraping page 1: ${url}`);
            const { products: p1, totalPages } = await this._scrapePage(url, 1);
            this._mergeProducts(p1, allProducts, seenUrls);
            console.log(`[HuntStreet] Page 1: ${p1.length} produk | Total halaman terdeteksi: ${totalPages}`);

            // Honour maxPages option as an upper cap
            const cap = (this.maxPages && this.maxPages !== Infinity)
                ? Math.min(this.maxPages, totalPages)
                : totalPages;

            if (cap <= 1) {
                console.log(`[HuntStreet] maxPages=1, selesai — lanjut enrichment detail.`);
                return await this.enrichProducts(allProducts);
            }

            // ── Pages 2..cap in parallel batches ──
            const remaining = [];
            for (let p = 2; p <= cap; p++) remaining.push(p);

            console.log(`[HuntStreet] Mulai scrape ${remaining.length} halaman sisa (concurrency=${CONCURRENCY})...`);

            for (let i = 0; i < remaining.length; i += CONCURRENCY) {
                const batch = remaining.slice(i, i + CONCURRENCY);

                const results = await Promise.allSettled(
                    batch.map((pageNum, idx) => {
                        const pageUrl = this._pageUrl(url, pageNum);
                        // Stagger tab opens slightly to avoid burst
                        return this._delay(idx * PAGE_DELAY_MS).then(() =>
                            this._scrapePageInTab(pageUrl, pageNum)
                        );
                    })
                );

                for (const r of results) {
                    if (r.status === 'fulfilled') {
                        this._mergeProducts(r.value, allProducts, seenUrls);
                    } else {
                        console.warn(`[HuntStreet] Batch error: ${r.reason?.message}`);
                    }
                }

                const done = Math.min(i + CONCURRENCY, remaining.length);
                console.log(`[HuntStreet] Progress: ${done}/${remaining.length} halaman sisa | Total: ${allProducts.length} produk`);
            }

            console.log(`[HuntStreet] SELESAI — ${allProducts.length} produk dari ${cap} halaman.`);
            return await this.enrichProducts(allProducts);

        } finally {
            await this.closeBrowser();
        }
    }

    async enrichFromDetailPage(product) {
        await this.navigateWithRetry(product.product_url, { waitAfter: 2000, waitUntil: 'networkidle2' });
        await this.page.waitForSelector('#flexslider img, #flexcarousel img', { timeout: 15000 }).catch(() => {});
        await this.sleep(800);
        const detail = await extractPdpFromPage(this.page, this.getBaseUrl(), 'huntstreet');
        const parts = [];
        if (detail.description) parts.push(detail.description);
        if (product.description && !parts.includes(product.description)) {
            parts.unshift(product.description);
        }
        return {
            images: this._dedupeImages(detail.images, this.getBaseUrl()),
            description: parts.join('\n\n') || null,
        };
    }

    // ─────────────────────────────────────────────
    // Scrape one page using the shared main page
    // ─────────────────────────────────────────────
    async _scrapePage(url, pageNum) {
        await this.navigateWithRetry(url, { waitAfter: 2500, waitUntil: 'networkidle2' });
        await this.waitForAnySelector(['.productBox', '.productContainer'], 12000);
        await this.autoScroll();
        await this._delay(1500);

        const products   = await this._extractProducts(url);
        const totalPages = await this._detectTotalPages();
        return { products, totalPages };
    }

    // ─────────────────────────────────────────────
    // Open a NEW tab for parallel page scraping
    // ─────────────────────────────────────────────
    async _scrapePageInTab(url, pageNum) {
        let tab = null;
        try {
            tab = await this.browser.newPage();
            await tab.setUserAgent(this.userAgents[pageNum % this.userAgents.length]);
            await tab.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

            // Abort fonts & media for speed
            await tab.setRequestInterception(true);
            tab.on('request', req => {
                try {
                    if (['font', 'media'].includes(req.resourceType())) req.abort();
                    else req.continue();
                } catch { /* ignore */ }
            });

            await tab.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

            // Wait for at least one product box
            await tab.waitForSelector('.productBox', { timeout: 12000 }).catch(() => {});
            await this._delay(1000);

            const products = await this._extractFromTab(tab, url);
            console.log(`[HuntStreet] Page ${pageNum}: ${products.length} produk`);
            return products;

        } catch (e) {
            console.error(`[HuntStreet] Tab error page ${pageNum}: ${e.message}`);
            return [];
        } finally {
            if (tab) await tab.close().catch(() => {});
        }
    }

    // ─────────────────────────────────────────────
    // Extract products from a puppeteer Page/Frame
    // ─────────────────────────────────────────────
    async _extractFromTab(tab, pageUrl) {
        return tab.evaluate((base) => {
            const results = [];
            document.querySelectorAll('.productBox').forEach(box => {
                try {
                    const linkEl = box.querySelector('.productListImg a');
                    if (!linkEl) return;

                    let href = linkEl.href || '';
                    if (!href || href.includes('/member/sell') || href.includes('/sell/item/create')) return;
                    if (!href.startsWith('http')) href = base + (href.startsWith('/') ? '' : '/') + href;

                    const brand = (box.querySelector('.productName')?.textContent || '').trim();
                    const title = (box.querySelector('.productType')?.textContent || '').trim();
                    const img   = box.querySelector('.productListImg img');
                    const priceRaw = (box.querySelector('.productPrice .currentPrice')?.textContent || '').trim();
                    const cond  = (box.querySelector('.condition_item')?.textContent || '').trim();

                    if (!title) return;

                    results.push({ title, brand, priceRaw, imageUrl: img?.src || img?.dataset?.src || '', href, cond });
                } catch { /* skip */ }
            });
            return results;
        }, BASE_URL).then(items => items.map(p => this._normalizeProduct(p, this._ctx)));
    }

    // ─────────────────────────────────────────────
    // Extract products from main page (via Cheerio)
    // ─────────────────────────────────────────────
    async _extractProducts(pageUrl) {
        const $ = await this.getCheerio();
        const products = [];

        $('.productBox').each((_, el) => {
            try {
                const linkEl = $(el).find('.productListImg a').first();
                let href = linkEl.attr('href') || '';
                if (!href || href.includes('/member/sell') || href.includes('/sell/item/create')) return;
                if (!href.startsWith('http')) href = BASE_URL + (href.startsWith('/') ? '' : '/') + href;

                const brand    = $(el).find('.productName').first().text().trim();
                const title    = $(el).find('.productType').first().text().trim();
                const imgEl    = $(el).find('.productListImg img').first();
                let   imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';
                if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
                const priceRaw = $(el).find('.productPrice .currentPrice').first().text().trim();
                const cond     = $(el).find('.condition_item').first().text().trim();

                if (!title) return;

                products.push(this._normalizeProduct({
                    title,
                    brand,
                    priceRaw,
                    imageUrl: imageUrl || null,
                    href,
                    cond,
                }, this._ctx));
            } catch { /* skip */ }
        });

        return products;
    }

    // ─────────────────────────────────────────────
    // Auto-detect total pages from pagination text
    // e.g. "First « 1 2 3 ... 110 111 » Last"
    // ─────────────────────────────────────────────
    async _detectTotalPages() {
        try {
            // Try reading all numbers from pagination widget
            const text = await this.page.evaluate(() => {
                const el = document.querySelector('[class*="pagin"], [class*="pager"], .pagination');
                return el ? el.innerText : '';
            });

            // Extract all integers, last one is the highest page number
            const nums = [...text.matchAll(/\d+/g)].map(m => parseInt(m[0])).filter(n => n > 0);
            if (nums.length > 0) return Math.max(...nums);
        } catch { /* ignore */ }

        // Fallback: look for page= links in HTML
        try {
            const $ = await this.getCheerio();
            const nums = [];
            $('a[href*="page="]').each((_, a) => {
                const m = $(a).attr('href')?.match(/page=(\d+)/);
                if (m) nums.push(parseInt(m[1]));
            });
            if (nums.length > 0) return Math.max(...nums);
        } catch { /* ignore */ }

        return 1;
    }

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────
    _mergeProducts(newItems, allProducts, seenUrls) {
        for (const p of newItems) {
            const key = p.product_url || p.title;
            if (!seenUrls.has(key)) {
                seenUrls.add(key);
                allProducts.push(p);
            }
        }
    }

    _pageUrl(base, page) {
        const u = new URL(base);
        u.searchParams.set('page', String(page));
        return u.toString();
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _upgradeHuntstreetImage(url) {
        if (!url) return null;
        let u = String(url).trim();
        if (u.startsWith('//')) u = 'https:' + u;
        if (u.includes('img.huntstreet.com/uploads/product/images/')) {
            return u.split('?')[0].replace(/\/(thumb|medium)\//, '/large/');
        }
        return u.split('?')[0] || null;
    }

    _parsePrice(text) {
        if (!text) return 0;
        const cleaned = text.replace(/[^\d.,]/g, '');
        if (cleaned.includes('.') && !cleaned.includes(',')) return parseInt(cleaned.replace(/\./g, '')) || 0;
        if (cleaned.includes(',')) return parseInt(cleaned.replace(/,/g, '')) || 0;
        return parseInt(cleaned) || 0;
    }
}
