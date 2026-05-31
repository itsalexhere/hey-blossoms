import { BaseScraper } from './base.js';
import {
    inferCategoryFromTitle,
    inferGenderFromBanananinaProduct,
    mapBanananinaListingCategory,
    parseBanananinaUrl,
} from '@luxe/shared/product-taxonomy';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

// ============================================================
// Banananina Scraper
// Strategy: page.evaluate() on live DOM — bypasses stale HTML issues
// Anti-bot: stealth plugin + fresh incognito context per page
// Pagination: auto-detect total pages from pagination links
// ============================================================

export class BanananinaScraper extends BaseScraper {
    getSourceName() { return 'Banananina'; }
    getBaseUrl() { return 'https://www.banananina.co.id'; }
    getPlatform() { return 'woocommerce'; }

    /**
     * Detect total pages from pagination on current page
     */
    async _detectTotalPages() {
        try {
            const $ = await this.getCheerio();
            // Find the highest page number in pagination links
            let max = 1;
            $('a.page-numbers, .page-numbers a, .pagination a').each((_, el) => {
                const num = parseInt($(el).text().trim());
                if (!isNaN(num) && num > max) max = num;
            });
            return max;
        } catch {
            return this.maxPages;
        }
    }

    /**
     * Scrape all pages using fresh incognito context per page to avoid bot detection.
     * Browser instance is shared (saves startup cost), but each page gets its own
     * isolated context (fresh cookies, storage, fingerprint).
     */
    _resolveContext(url) {
        const parsed = parseBanananinaUrl(url);
        return {
            brand: this.options.brand || parsed.brand || null,
        };
    }

    _normalizeProduct(raw) {
        const brand = this._ctx?.brand || raw.brand || this._extractBrand(raw.title);
        const gender = inferGenderFromBanananinaProduct(raw.product_url, raw.catalogueCategory);

        let category = raw.category;
        if (category && /^(men|women)$/i.test(String(category).trim())) {
            category = mapBanananinaListingCategory(raw.category2) || null;
        } else if (raw.category2) {
            category = mapBanananinaListingCategory(raw.category2) || category;
        }
        if (!category) {
            category = inferCategoryFromTitle(raw.title, brand || '');
        }

        const { catalogueCategory, category2, ...rest } = raw;
        return { ...rest, brand, gender, category };
    }

    async scrape(url) {
        this._ctx = this._resolveContext(url);
        if (this._ctx.brand) {
            console.log(`[Banananina] Context: brand=${this._ctx.brand} (gender inferred per product URL)`);
        }

        const allProducts = [];
        let currentPage = 1;
        let totalPages = this.maxPages;

        const headless = this.headless !== false ? 'new' : false;
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

        // Launch one stealth browser — reuse across pages
        const browser = await puppeteer.launch({
            headless,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1366,768'],
        });

        try {
            while (currentPage <= totalPages) {
                const pageUrl = currentPage === 1 ? url : this._appendPage(url, currentPage);
                console.log(`\n[Banananina] Page ${currentPage}/${totalPages} — ${pageUrl}`);

                // Fresh incognito context per page — new cookies, storage, fingerprint
                const context = await browser.createBrowserContext();
                const page = await context.newPage();

                try {
                    await page.setUserAgent(ua);
                    await page.setViewport({ width: 1366, height: 768 });
                    await page.setExtraHTTPHeaders({ 'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7' });

                    // Block fonts/media to speed up
                    await page.setRequestInterception(true);
                    page.on('request', req => {
                        if (['font', 'media'].includes(req.resourceType())) req.abort();
                        else req.continue();
                    });

                    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 45000 });

                    // Wait for actual product cards to appear in DOM
                    await page.waitForFunction(
                        () => document.querySelectorAll('a.text-secondary.position-relative').length > 0,
                        { timeout: 20000 }
                    ).catch(() => {});

                    // Scroll to trigger lazy load
                    await page.evaluate(async () => {
                        await new Promise(resolve => {
                            let totalHeight = 0;
                            const distance = 300;
                            const timer = setInterval(() => {
                                window.scrollBy(0, distance);
                                totalHeight += distance;
                                if (totalHeight >= document.body.scrollHeight) {
                                    clearInterval(timer);
                                    resolve();
                                }
                            }, 120);
                        });
                    });
                    await page.evaluate(() => window.scrollTo(0, 0));
                    await new Promise(r => setTimeout(r, 1500));

                    // Extract directly from live DOM — no cheerio stale HTML issue
                    const products = (await this._extractFromPage(page, pageUrl))
                        .map((p) => this._normalizeProduct(p));

                    if (products.length === 0) {
                        console.log(`[Banananina] 0 products on page ${currentPage}. Stopping.`);
                        break;
                    }

                    allProducts.push(...products);
                    console.log(`   Found ${products.length} products. Total: ${allProducts.length}`);

                    // Auto-detect total pages from first page
                    if (currentPage === 1) {
                        const detected = await page.evaluate(() => {
                            let max = 1;
                            document.querySelectorAll('a.page-numbers, .page-numbers a').forEach(a => {
                                const n = parseInt(a.textContent.trim());
                                if (!isNaN(n) && n > max) max = n;
                            });
                            return max;
                        });
                        if (detected > 1) {
                            totalPages = Math.min(detected, this.maxPages);
                            console.log(`[Banananina] Auto-detected ${detected} pages → scraping up to ${totalPages}.`);
                        }
                    }

                    // Check next page link
                    const hasNext = await page.evaluate(() => !!document.querySelector('a[rel="next"]'));
                    if (!hasNext) {
                        console.log(`[Banananina] No next page link. Done.`);
                        break;
                    }

                    currentPage++;

                    if (currentPage <= totalPages) {
                        const delayMs = typeof this.delay === 'object'
                            ? Math.floor(Math.random() * (this.delay.max - this.delay.min + 1)) + this.delay.min
                            : (this.delay || 1500);
                        await new Promise(r => setTimeout(r, delayMs));
                    }

                } catch (pageError) {
                    console.error(`[Banananina] Error on page ${currentPage}:`, pageError.message);
                    break;
                } finally {
                    await context.close().catch(() => {});
                }
            }

            const men = allProducts.filter((p) => p.gender === 'men').length;
            const women = allProducts.filter((p) => p.gender === 'women').length;
            console.log(`[Banananina] Gender summary: ${men} men, ${women} women, ${allProducts.length - men - women} unknown`);

            return allProducts;
        } finally {
            await browser.close().catch(() => {});
        }
    }

    /**
     * Extract products directly from live page DOM via page.evaluate().
     * Avoids cheerio/getCheerio stale-HTML issues on paginated pages.
     */
    async _extractFromPage(page, pageUrl) {
        const baseUrl = this.getBaseUrl();

        return page.evaluate((baseUrl, pageUrl) => {
            const results = [];

            // Strategy 1: JSON data layer script tag
            const scriptEl = document.querySelector('script#catalogue-data-layer');
            const jsonItems = [];
            if (scriptEl) {
                try {
                    const data = JSON.parse(scriptEl.textContent);
                    const raw = Array.isArray(data) ? data : (data.items || data.ecommerce?.impressions || []);
                    raw.forEach(item => jsonItems.push({
                        title: item.item_name || item.name || null,
                        price: parseFloat(item.price) || 0,
                        category: item.item_category || item.category || null,
                        category2: item.item_category2 || null,
                        catalogueCategory: item.item_category || null,
                        brand: item.item_brand || item.brand || null,
                    }));
                } catch {}
            }

            // Strategy 2: HTML product cards
            const htmlItems = [];
            const cards = document.querySelectorAll('a.text-secondary.position-relative');
            cards.forEach(card => {
                const titleEl = card.querySelector('.product-name, .product-title, p, span');
                const title = titleEl?.textContent?.trim() || '';
                const priceEl = card.querySelector('.price, [class*="price"]');
                const priceText = priceEl?.textContent?.trim() || '';
                const price = parseInt(priceText.replace(/[^\d]/g, '')) || 0;
                const img = card.querySelector('img');
                const imgUrl = img?.getAttribute('data-src') || img?.getAttribute('src') || null;
                let link = card.getAttribute('href') || '';
                if (link && !link.startsWith('http')) link = baseUrl + link;

                if (title) {
                    htmlItems.push({ title, price, image: imgUrl, link, catalogueCategory: null, category2: null });
                }
            });

            // Merge JSON (title/price) + HTML (image/link)
            const count = Math.max(jsonItems.length, htmlItems.length);
            for (let i = 0; i < count; i++) {
                const j = jsonItems[i] || {};
                const h = htmlItems[i] || {};
                const title = j.title || h.title;
                if (!title) continue;
                results.push({
                    title,
                    brand: j.brand || h.brand || null,
                    category: j.category || null,
                    category2: j.category2 || h.category2 || null,
                    catalogueCategory: j.catalogueCategory || h.catalogueCategory || null,
                    price_original: j.price || h.price || 0,
                    currency: 'IDR',
                    price_idr: j.price || h.price || 0,
                    stock_status: (j.price || h.price) > 0 ? 'available' : 'sold_out',
                    stock_qty: null,
                    image_url: h.image || null,
                    product_url: h.link || pageUrl,
                    description: null,
                });
            }

            return results;
        }, baseUrl, pageUrl);
    }

    /**
     * Append page number to URL (preserve existing query params like filter_product)
     */
    _appendPage(url, page) {
        const urlObj = new URL(url);
        urlObj.searchParams.set('page', page.toString());
        return urlObj.toString();
    }

    /**
     * Parse IDR price text like "Rp 52.500.000" → 52500000
     */
    _parsePrice(text) {
        if (!text) return 0;
        const cleaned = text.replace(/[^\d]/g, '');
        return parseInt(cleaned) || 0;
    }

    /**
     * Extract brand name from product title
     */
    _extractBrand(title) {
        const knownBrands = [
            'Hermes', 'Hermès', 'Chanel', 'Louis Vuitton', 'Gucci', 'Prada',
            'Christian Dior', 'Dior', 'Celine', 'Céline', 'Bottega Veneta',
            'Saint Laurent', 'Valentino', 'Balenciaga', 'Loewe', 'Fendi',
            'Burberry', 'Givenchy', 'Versace', 'Miu Miu', 'Coach',
            'Michael Kors', 'Kate Spade', 'Tory Burch', 'Marc Jacobs',
            'Karl Lagerfeld', 'Longchamp', 'Salvatore Ferragamo', 'Jimmy Choo',
            'Alexander McQueen', 'Bvlgari', 'Cartier', 'Dolce & Gabbana',
            'Goyard', 'Moynat', 'Roger Vivier', 'Tod\'s',
        ];

        const titleLower = title.toLowerCase();
        for (const brand of knownBrands) {
            if (titleLower.startsWith(brand.toLowerCase())) {
                return brand;
            }
        }
        return null;
    }
}
