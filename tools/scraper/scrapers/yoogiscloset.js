import { BaseScraper } from './base.js';
import {
    inferCategoryFromTitle,
    inferGenderFromYoogisProduct,
    parseYoogisUrl,
} from '@luxe/shared/product-taxonomy';

// ============================================================
// Yoogi's Closet Scraper (Nuxt/Magento storefront)
// Brand pages: /louis-vuitton?page=N (60 items/page)
// Gender: inferred per product from title (no site gender filter)
// ============================================================

const BASE_URL = 'https://www.yoogiscloset.com';

export class YoogisclosetScraper extends BaseScraper {
    getSourceName() { return "Yoogi's Closet"; }
    getBaseUrl() { return BASE_URL; }
    getPlatform() { return 'magento'; }

    _resolveContext(url) {
        const parsed = parseYoogisUrl(url);
        return {
            brand: this.options.brand || parsed.brand || null,
        };
    }

    _normalizeProduct(raw) {
        const brand = this._ctx?.brand || raw.brand || 'Louis Vuitton';
        const category = inferCategoryFromTitle(raw.title, brand);
        const gender = inferGenderFromYoogisProduct(raw.title, category || '');
        const priceUsd = Number(raw.price_original || 0);

        return {
            title: raw.title,
            brand,
            category,
            gender,
            price_original: priceUsd,
            currency: 'USD',
            price_idr: priceUsd,
            stock_status: priceUsd > 0 ? 'available' : 'sold_out',
            stock_qty: null,
            image_url: raw.image_url || null,
            product_url: raw.product_url,
            description: raw.condition ? `Condition: ${raw.condition}` : null,
        };
    }

    async scrape(url) {
        this._ctx = this._resolveContext(url);
        console.log(`[Yoogi's Closet] Context: brand=${this._ctx.brand || '-'} (gender inferred per product title)`);

        const allProducts = [];
        const seen = new Set();
        let totalPages = this.maxPages || 14;

        try {
            await this.launchBrowser();

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const pageUrl = this._pageUrl(url, pageNum);
                console.log(`[Yoogi's Closet] Page ${pageNum}/${totalPages} — ${pageUrl}`);

                await this.navigateWithRetry(pageUrl, { waitAfter: 2000 });

                await this.page.evaluate(async () => {
                    await new Promise((resolve) => {
                        let totalHeight = 0;
                        const timer = setInterval(() => {
                            window.scrollBy(0, 400);
                            totalHeight += 400;
                            if (totalHeight >= document.body.scrollHeight) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 80);
                    });
                    window.scrollTo(0, 0);
                });
                await this.sleep(1500);

                await this.page.waitForFunction(
                    () => document.querySelectorAll('.product-info h3').length > 0,
                    { timeout: 25000 }
                ).catch(() => {});

                if (pageNum === 1) {
                    const detected = await this.page.evaluate(() => {
                        const m = document.body.innerText.match(/(\d[\d,]*)\s+items/i);
                        const total = m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
                        const perPage = document.querySelectorAll('.product-info h3').length || 60;
                        return total > 0 ? Math.ceil(total / perPage) : 1;
                    });
                    if (detected > 1) {
                        totalPages = Math.min(detected, this.maxPages || detected);
                        console.log(`[Yoogi's Closet] Detected ${detected} pages → scraping up to ${totalPages}.`);
                    }
                }

                const raw = await this._extractFromPage();
                const products = raw.map((p) => this._normalizeProduct(p)).filter((p) => {
                    if (!p.product_url || seen.has(p.product_url)) return false;
                    seen.add(p.product_url);
                    return true;
                });

                if (products.length === 0) {
                    console.log(`[Yoogi's Closet] 0 products on page ${pageNum}. Stopping.`);
                    break;
                }

                allProducts.push(...products);
                console.log(`   Found ${products.length} products. Total: ${allProducts.length}`);

                if (pageNum < totalPages) {
                    await this.sleep(typeof this.delay === 'object'
                        ? Math.floor(Math.random() * (this.delay.max - this.delay.min + 1)) + this.delay.min
                        : (this.delay || 1500));
                }
            }

            const men = allProducts.filter((p) => p.gender === 'men').length;
            const women = allProducts.filter((p) => p.gender === 'women').length;
            console.log(`[Yoogi's Closet] Gender summary: ${men} men, ${women} women`);

            return allProducts;
        } finally {
            await this.closeBrowser();
        }
    }

    async _extractFromPage() {
        const baseUrl = this.getBaseUrl();
        return this.page.evaluate((baseUrl) => {
            const pickImage = (card) => {
                if (!card) return null;
                const img =
                    card.querySelector('.product-image img[src*="catalog/product"]') ||
                    card.querySelector('.product-image img[data-src*="catalog/product"]') ||
                    card.querySelector('img[src*="catalog/product"]') ||
                    card.querySelector('img[data-src*="catalog/product"]');
                if (!img) return null;
                return img.getAttribute('src') || img.getAttribute('data-src') || null;
            };

            const results = [];
            document.querySelectorAll('.product-info').forEach((info) => {
                const card = info.closest('.product-card, .product-wrapper, .product-link');
                const link =
                    card?.querySelector('a[href*="/designers/"]') ||
                    info.querySelector('a[href*="/designers/"]');
                const brand = info.querySelector('h2')?.textContent?.trim() || null;
                const title = info.querySelector('h3')?.textContent?.trim() || null;
                let href = link?.getAttribute('href') || link?.href || null;
                if (href && href.startsWith('/')) href = baseUrl + href;

                const priceText = info.querySelector('h6')?.textContent || '';
                const priceMatch = priceText.match(/NOW\s*\$?\s*([\d,]+)/i) || priceText.match(/\$\s*([\d,]+)/);
                const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;

                const condEl = [...(card?.querySelectorAll('p, span, div') || [])].find((el) =>
                    /^condition:/i.test(el.textContent.trim())
                );
                const condition = condEl?.textContent?.replace(/^condition:\s*/i, '').trim() || null;

                const image_url = pickImage(card);

                if (title && href) {
                    results.push({ brand, title, product_url: href, price_original: price, condition, image_url });
                }
            });
            return results;
        }, baseUrl);
    }

    _pageUrl(baseUrl, page) {
        const u = new URL(baseUrl);
        if (page <= 1) {
            u.searchParams.delete('page');
            u.searchParams.delete('p');
        } else {
            u.searchParams.set('page', String(page));
        }
        return u.toString();
    }
}
