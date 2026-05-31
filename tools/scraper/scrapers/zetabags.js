import { BaseScraper } from './base.js';
import { inferCategoryFromTitle } from '@luxe/shared/product-taxonomy';

/** ZetaBags shop filter IDs → gender (from fill-gender query param). */
const ZETABAGS_GENDER_FILLS = {
    '49': 'men',
    '50': 'women',
};

/** ZetaBags fill-brand IDs → canonical brand name. */
const ZETABAGS_BRAND_FILLS = {
    '157': 'Dior',
    '154': 'Louis Vuitton',
    '183': 'Loro Piana',
};

// ============================================================
// ZetaBags Scraper (WooCommerce + Elementor Platform)
// Full catalog: WooCommerce Store API (fast)
// Filtered /shop/ & HTML fallback: slow scroll + load-more (Elementor)
// — BUKAN pagination paralel seperti HuntStreet
// ============================================================

export class ZetabagsScraper extends BaseScraper {
    constructor(options = {}) {
        super(options);
        this.scrollWaitTime = 20000;
    }

    getSourceName() { return 'ZetaBags'; }
    getBaseUrl() { return 'https://zetabags.com'; }
    getPlatform() { return 'woocommerce'; }

    _resolveContext(url) {
        const u = new URL(url);
        const fillGender = u.searchParams.get('fill-gender') || '';
        const fillBrand = u.searchParams.get('fill-brand') || '';
        return {
            gender: this.options.gender || ZETABAGS_GENDER_FILLS[fillGender] || null,
            brand: this.options.brand || ZETABAGS_BRAND_FILLS[fillBrand] || null,
        };
    }

    _isFilteredShopUrl(url) {
        const u = new URL(url);
        return u.searchParams.has('fill-gender') || u.searchParams.has('fill-brand');
    }

    _normalizeProduct(raw) {
        const title = raw.title;
        const brand = this._ctx?.brand || raw.brand || null;
        const category = raw.category || inferCategoryFromTitle(title, brand || '') || null;
        return {
            ...raw,
            title,
            brand,
            category,
            gender: this._ctx?.gender || null,
        };
    }

    /**
     * Scrape products from ZetaBags
     */
    async scrape(url) {
        this._ctx = this._resolveContext(url);
        console.log(`[ZetaBags] Context: gender=${this._ctx.gender || '-'} brand=${this._ctx.brand || '-'}`);

        if (this._isFilteredShopUrl(url)) {
            console.log('[ZetaBags] Filtered shop URL — slow scroll HTML scrape (bukan pagination HuntStreet)');
            return this._scrapeFilteredShop(url);
        }

        // Try WooCommerce Store API first (full catalog only)
        try {
            console.log('[ZetaBags] Trying WooCommerce Store API...');
            const products = await this._scrapeViaWcApi();
            if (products.length > 0) {
                console.log(`[ZetaBags] API success! ${products.length} products found.`);
                return products;
            }
        } catch (e) {
            console.log(`[ZetaBags] WC API failed: ${e.message}. Falling back to HTML scraping.`);
        }

        // Fallback: Puppeteer HTML scraping
        return this._scrapeViaHtml(url);
    }

    /**
     * Scrape using WooCommerce Store API
     * GET /wp-json/wc/store/v1/products?per_page=100&page=N
     * Returns up to 100 products per page, with x-wp-total and x-wp-totalpages headers
     */
    async _scrapeViaWcApi() {
        const allProducts = [];
        const perPage = 100;
        let currentPage = 1;
        let totalPages = null;

        const apiBase = `${this.getBaseUrl()}/wp-json/wc/store/v1/products`;

        while (true) {
            const apiUrl = `${apiBase}?per_page=${perPage}&page=${currentPage}`;
            console.log(`[ZetaBags API] Fetching page ${currentPage}${totalPages ? '/' + totalPages : ''}: ${apiUrl}`);

            const response = await fetch(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Read total from headers on first request
            if (totalPages === null) {
                const total = response.headers.get('x-wp-total');
                totalPages = parseInt(response.headers.get('x-wp-totalpages')) || 1;
                console.log(`[ZetaBags API] Total products: ${total}, Total pages: ${totalPages}`);
            }

            const data = await response.json();

            if (!Array.isArray(data) || data.length === 0) {
                console.log(`[ZetaBags API] Page ${currentPage}: empty response. Done.`);
                break;
            }

            for (const product of data) {
                const parsed = this._parseWcProduct(product);
                if (parsed) {
                    allProducts.push(this._normalizeProduct(parsed));
                }
            }

            console.log(`[ZetaBags API] Page ${currentPage}: ${data.length} products. Total collected: ${allProducts.length}`);

            // Stop if we've reached the last page or our maxPages limit
            if (currentPage >= totalPages || currentPage >= this.maxPages) {
                break;
            }

            currentPage++;
            await this.sleep(500); // Be nice to the API
        }

        return allProducts;
    }

    /**
     * Parse a WooCommerce Store API product object
     */
    _parseWcProduct(product) {
        if (!product || !product.name) return null;

        // Price (WC Store API returns price as string)
        const priceStr = product.prices?.price || '0';
        const price = parseInt(priceStr) || 0;

        // Stock status
        const stockStatus = product.is_in_stock ? 'available' : 'sold_out';

        // Image
        const imageUrl = product.images && product.images[0]
            ? product.images[0].src
            : null;

        // Brand (from brands field)
        let brand = null;
        if (product.brands && product.brands.length > 0) {
            brand = product.brands[0].name;
        }

        // Category (pick the most specific one)
        let category = null;
        if (product.categories && product.categories.length > 0) {
            const specificCats = product.categories.filter(c =>
                c.slug !== 'brands' && c.slug !== 'women' && c.slug !== 'men'
            );
            category = specificCats.length > 0 ? specificCats[0].name : product.categories[0].name;
        }

        return {
            title: product.name,
            brand: brand,
            category: category,
            price_original: price,
            currency: product.prices?.currency_code || 'IDR',
            price_idr: price,
            stock_status: stockStatus,
            stock_qty: product.low_stock_remaining || null,
            image_url: imageUrl,
            product_url: product.permalink || `${this.getBaseUrl()}/product/${product.slug}/`,
            description: this._stripHtml(product.short_description || product.description || ''),
        };
    }

    /**
     * ZetaBags loads products via slow scroll + optional "Load more" (Elementor).
     * Used for filtered /shop/ and category HTML fallback — NOT HuntStreet-style pagination-only.
     */
    async _slowScrollUntilLoaded(opts = {}) {
        const maxLoops = opts.maxLoops ?? 80;
        const waitMs = opts.waitMs ?? 11000;
        const stepPx = opts.stepPx ?? 800;

        let lastHeight = 0;
        let scrollRetries = 0;
        let loopCount = 0;
        let lastScrollY = -1;

        while (loopCount < maxLoops) {
            loopCount++;

            await this.page.evaluate((step) => {
                window.scrollBy(0, step);
                try {
                    const btns = document.querySelectorAll('.load-more, .ajax-load-more, button, a');
                    for (const btn of btns) {
                        if (btn.offsetParent !== null && btn.textContent) {
                            const text = btn.textContent.toLowerCase().trim();
                            if (
                                text === 'load more' ||
                                text === 'muat lebih banyak' ||
                                text.includes('loading more')
                            ) {
                                btn.click();
                            }
                        }
                    }
                } catch { /* ignore */ }
            }, stepPx);

            console.log(`[ZetaBags] Scroll ${loopCount}/${maxLoops}, tunggu ${waitMs / 1000}s...`);
            await this.sleep(waitMs);

            const status = await this.page.evaluate(() => ({
                scrollHeight: document.body.scrollHeight,
                scrollY: window.scrollY,
                isAtBottom: window.scrollY + window.innerHeight >= document.body.scrollHeight - 300,
                productCount: document.querySelectorAll(
                    '.product-item, li.product, .product-card, .elementor-widget-wc-products li'
                ).length,
            }));

            console.log(`[ZetaBags] Scroll status: ${status.productCount} kartu DOM, bottom=${status.isAtBottom}`);

            const scrollNotMoving = Math.abs(status.scrollY - lastScrollY) < 10;

            if (scrollNotMoving || status.isAtBottom) {
                if (Math.abs(status.scrollHeight - lastHeight) < 200) {
                    scrollRetries++;
                    if (scrollRetries >= 2) {
                        console.log('[ZetaBags] Mentok bawah, tidak ada konten baru.');
                        break;
                    }
                } else {
                    scrollRetries = 0;
                }
            } else {
                scrollRetries = 0;
            }

            lastScrollY = status.scrollY;
            lastHeight = status.scrollHeight;
        }

        if (loopCount >= maxLoops) {
            console.log('[ZetaBags] Batas scroll tercapai, lanjut parse.');
        }
    }

    _mergeUniqueProducts(batch, allProducts, seen) {
        for (const p of batch) {
            const key = p.product_url || p.title;
            if (!seen.has(key)) {
                seen.add(key);
                allProducts.push(p);
            }
        }
    }

    /**
     * Filtered /shop/ (fill-gender, fill-brand) — scroll perlahan per halaman,
     * lalu parse. Jika situs punya link page/2/, ulangi scroll di halaman berikutnya.
     */
    async _scrapeFilteredShop(url) {
        const allProducts = [];
        const seen = new Set();

        try {
            await this.launchBrowser();
            const pageCap = this.maxPages && this.maxPages !== Infinity ? this.maxPages : 20;

            for (let page = 1; page <= pageCap; page++) {
                const pageUrl = page === 1 ? url : this._appendFilteredPage(url, page);
                console.log(`[ZetaBags Filtered] Buka halaman ${page}: ${pageUrl}`);

                await this.navigateWithRetry(pageUrl, { waitAfter: 8000 });
                await this.waitForAnySelector(
                    ['.product-item', 'li.product', '.product-card', '.elementor-products'],
                    15000
                );

                await this._slowScrollUntilLoaded({ maxLoops: page === 1 ? 40 : 30, waitMs: 9000 });

                const $ = await this.getCheerio();
                const batch = this._parseHtmlProducts($, pageUrl).map((p) => this._normalizeProduct(p));
                const before = allProducts.length;
                this._mergeUniqueProducts(batch, allProducts, seen);

                console.log(
                    `[ZetaBags Filtered] Halaman ${page}: ${batch.length} kartu, +${allProducts.length - before} baru | Total unik: ${allProducts.length}`
                );

                const totalPages = page === 1 ? Math.min(this._detectHtmlTotalPages($), pageCap) : pageCap;
                if (page === 1 && totalPages > 1) {
                    console.log(`[ZetaBags Filtered] Pagination WP terdeteksi: ${totalPages} halaman (tiap halaman di-scroll dulu)`);
                }
                if (page >= totalPages || batch.length === 0) break;
            }

            console.log(`[ZetaBags Filtered] SELESAI — ${allProducts.length} produk`);
            if (allProducts.length === 0) {
                console.log('[ZetaBags Filtered] Tidak ada produk di halaman (stok kosong / filter kosong) — OK, coba lagi nanti.');
            }
            return allProducts;
        } finally {
            await this.closeBrowser();
        }
    }

    _appendFilteredPage(url, page) {
        const u = new URL(url);
        let path = u.pathname;
        if (!path.endsWith('/')) path += '/';
        path = path.replace(/\/page\/\d+\/?/i, '/');
        if (page > 1) {
            path = path.replace(/\/?$/, `/page/${page}/`);
        }
        u.pathname = path;
        return u.toString();
    }

    _detectHtmlTotalPages($) {
        const nums = [];
        $('.page-numbers, .pagination, nav.pagination').find('a, span').each((_, el) => {
            const n = parseInt($(el).text().trim());
            if (n > 0) nums.push(n);
        });
        $('a.page-numbers').each((_, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/\/page\/(\d+)/);
            if (m) nums.push(parseInt(m[1]));
        });
        return nums.length ? Math.max(...nums) : 1;
    }

    /**
     * Fallback: HTML scraping with Puppeteer (Elementor + WooCommerce)
     */
    async _scrapeViaHtml(url) {
        const allProducts = [];
        let currentPage = 1;
        let hasNextPage = true;

        try {
            await this.launchBrowser();

            while (hasNextPage && currentPage <= this.maxPages) {
                const pageUrl = currentPage === 1 ? url : this._appendPage(url, currentPage);
                console.log(`[ZetaBags HTML] Scraping page ${currentPage}: ${pageUrl}`);

                try {
                    console.log(`[ZetaBags HTML] Scraping page ${currentPage}: ${pageUrl}`);
                    await this.navigateWithRetry(pageUrl, { waitAfter: 10000 });
                    await this.waitForAnySelector(['.product-item', 'li.product', '.product-card', '.elementor-products'], 15000);

                    await this._slowScrollUntilLoaded();

                    const $ = await this.getCheerio();
                    const products = this._parseHtmlProducts($, pageUrl).map((p) =>
                        this._ctx ? this._normalizeProduct(p) : p
                    );

                    if (products.length === 0) {
                        hasNextPage = false;
                    } else {
                        allProducts.push(...products);
                        console.log(`[ZetaBags HTML] Page ${currentPage}: ${products.length} products. Total: ${allProducts.length}`);
                        hasNextPage = false;
                    }
                } catch (pageError) {
                    console.error(`[ZetaBags HTML] Page ${currentPage} error:`, pageError.message);
                    hasNextPage = false;
                }
            }

            return allProducts;
        } finally {
            await this.closeBrowser();
        }
    }

    /**
     * Parse HTML product cards (Elementor + WooCommerce theme)
     */
    _parseHtmlProducts($, pageUrl) {
        const products = [];

        const cardSelectors = [
            '.product-item',
            '.elementor-widget-wc-products li',
            'li.product',
            '.product-card',
            '.grid__item .card',
            '.product-grid-item',
        ];

        let $cards = $([]);
        for (const sel of cardSelectors) {
            $cards = $(sel);
            if ($cards.length > 0) break;
        }

        $cards.each((i, el) => {
            try {
                const titleSelectors = ['.woocommerce-loop-product__title', '.product-item-title', '.product-card__title', 'h2', 'h3'];
                let title = '';
                for (const sel of titleSelectors) {
                    title = $(el).find(sel).text().trim();
                    if (title) break;
                }

                const priceSelectors = ['.woocommerce-Price-amount', '.price-item', '.product-card__price', '.price', '.money', 'span.amount'];
                let priceText = '';
                for (const sel of priceSelectors) {
                    priceText = $(el).find(sel).first().text().trim();
                    if (priceText) break;
                }
                const price = this._parsePrice(priceText);

                const brand = $(el).find('.product-item-brand').text().trim() || null;

                const imgEl = $(el).find('img').first();
                let imageUrl = imgEl.attr('data-src') || imgEl.attr('src') || imgEl.attr('data-srcset');
                if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

                let link = $(el).find('a').first().attr('href') || '';
                if (link && !link.startsWith('http')) link = this.getBaseUrl() + link;

                const soldOut =
                    $(el).find('.sold-out, .badge--sold-out, .outofstock').length > 0 ||
                    /out of stock|sold/i.test($(el).text());

                if (title) {
                    products.push({
                        title,
                        brand: brand || null,
                        category: null,
                        price_original: price,
                        currency: 'IDR',
                        price_idr: price,
                        stock_status: soldOut ? 'sold_out' : 'available',
                        stock_qty: null,
                        image_url: imageUrl,
                        product_url: link || pageUrl,
                        description: null,
                    });
                }
            } catch (e) {
                // skip this card
            }
        });

        return products;
    }

    _appendPage(url, page) {
        const urlObj = new URL(url);
        let pathname = urlObj.pathname;
        if (!pathname.endsWith('/')) pathname += '/';
        if (pathname.includes('/page/')) {
            pathname = pathname.replace(/\/page\/\d+\//, `/page/${page}/`);
        } else {
            pathname += `page/${page}/`;
        }
        urlObj.pathname = pathname;
        return urlObj.toString();
    }

    _parsePrice(text) {
        if (!text) return 0;
        const cleaned = text.replace(/[^\d.,]/g, '');
        if (cleaned.includes('.') && !cleaned.includes(',')) {
            return parseInt(cleaned.replace(/\./g, '')) || 0;
        }
        if (cleaned.includes(',')) {
            return parseInt(cleaned.replace(/,/g, '')) || 0;
        }
        return parseInt(cleaned) || 0;
    }

    _stripHtml(html) {
        if (!html) return null;
        return html.replace(/<[^>]*>/g, '').trim().substring(0, 500);
    }
}
