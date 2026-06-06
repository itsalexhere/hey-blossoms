// Dynamic imports will be used inside launchBrowser to prevent Next.js crash
import * as cheerio from 'cheerio';

// ============================================================
// Base Scraper — shared logic for all website scrapers
// ============================================================

export class BaseScraper {
    constructor(options = {}) {
        this.options = options;
        this.browser = null;
        this.page = null;
        this.headless = options.headless !== false;
        this.maxRetries = options.maxRetries || 3;
        this.timeout = options.timeout || 30000;
        this.delay = options.delay || { min: 1000, max: 3000 };
        this.maxPages = options.maxPages || Infinity;
        this.startPage = options.startPage || 1;
        this.maxDurationSeconds = options.maxDurationSeconds > 0 ? Number(options.maxDurationSeconds) : null;
        this._scrapeStartTime = null;
        this._timeLimitReached = false;
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
        ];
    }

    /**
     * Launch Puppeteer browser with anti-detection & Cloudflare bypass
     */
    async launchBrowser() {
        if (this.browser) return this.browser;

        console.log(`[Browser] Launching ${this.headless ? 'headless' : '**VISIBLE**'} browser...`);

        // Dynamically import to prevent Next.js API route crashing at module load
        const puppeteerExtraModule = await import('puppeteer-extra');
        const stealthPluginModule = await import('puppeteer-extra-plugin-stealth');
        
        const puppeteer = puppeteerExtraModule.default || puppeteerExtraModule;
        const StealthPlugin = stealthPluginModule.default || stealthPluginModule;

        // Ensure we only add the plugin once
        if (!puppeteer._plugins || !puppeteer._plugins.find(p => p.name === 'stealth')) {
            puppeteer.use(StealthPlugin());
        }

        this.browser = await puppeteer.launch({
            headless: this.headless ? 'new' : false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1366,768',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--lang=en-US,en',
                '--start-maximized',
                '--disable-notifications',
                '--disable-default-apps',
                '--disable-preconnect',
                '--disable-sync',
            ],
        });

        this.page = await this.browser.newPage();

        // Anti-detection measures
        const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
        console.log(`[Browser] User-Agent: ${userAgent.substring(0, 60)}...`);
        
        await this.page.setUserAgent(userAgent);
        await this.page.setViewport({ width: 1366, height: 768 });

        // Set extra headers to look like real browser
        // Only Accept-Language — forcing Accept/Cache-Control on all subrequests breaks SPAs (ZZER iframe)
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
        });

        // Remove webdriver flag
        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'permissions', {
                get: () => ({
                    query: () => Promise.resolve({ state: Notification.permission }),
                }),
            });
            window.chrome = { runtime: {} };
        });

        // Block unnecessary resources for speed
        // IMPORTANT: Don't block requests entirely to avoid Cloudflare detection
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            try {
                const resourceType = req.resourceType();
                // Only block specific resource types (be more permissive)
                if (['font', 'media'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            } catch {
                // If interception was disabled later, ignore.
            }
        });

        return this.browser;
    }

    /**
     * Navigate to URL with retry logic
     */
    async navigateWithRetry(url, options = {}) {
        const maxRetries = options.maxRetries || this.maxRetries;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (!this.browser) await this.launchBrowser();
                if (!this.page || (typeof this.page.isClosed === 'function' && this.page.isClosed())) {
                    this.page = await this.browser.newPage();
                    const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
                    await this.page.setUserAgent(userAgent);
                    await this.page.setViewport({ width: 1366, height: 768 });
                    await this.page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
                }

                console.log(`[Attempt ${attempt}/${maxRetries}] Navigating to: ${url}`);

                await this.page.goto(url, {
                    waitUntil: options.waitUntil || 'networkidle2',
                    timeout: this.timeout,
                });

                // Wait extra time for JS rendering
                const extraWait = options.waitAfter || 3000;
                await this.sleep(extraWait);

                return true;
            } catch (error) {
                lastError = error;
                console.error(`[Attempt ${attempt}/${maxRetries}] Failed: ${error.message}`);

                if (attempt < maxRetries) {
                    const backoff = Math.pow(2, attempt) * 1000;
                    console.log(`  Retrying in ${backoff / 1000}s...`);
                    await this.sleep(backoff);
                }
            }
        }

        throw lastError;
    }

    /**
     * Get page HTML and load into Cheerio
     */
    async getCheerio() {
        const html = await this.page.content();
        return cheerio.load(html);
    }

    /**
     * Close browser
     */
    async closeBrowser() {
        if (this.browser) {
            try {
                await this.browser.close();
            } catch (e) {
                // ignore
            }
            this.browser = null;
            this.page = null;
        }
    }

    /**
     * Classify error type for logging
     */
    classifyError(error) {
        const msg = (error.message || '').toLowerCase();

        if (msg.includes('timeout') || msg.includes('timed out')) {
            return 'timeout';
        }
        if (msg.includes('403') || msg.includes('forbidden') || msg.includes('blocked') || msg.includes('captcha')) {
            return 'blocked';
        }
        if (msg.includes('net::') || msg.includes('network') || msg.includes('econnrefused') || msg.includes('enotfound')) {
            return 'network_error';
        }
        if (msg.includes('parse') || msg.includes('json') || msg.includes('unexpected token')) {
            return 'parse_error';
        }
        if (msg.includes('not found') || msg.includes('404')) {
            return 'not_found';
        }
        return 'unknown_error';
    }

    /**
     * Random sleep
     */
    async sleep(ms) {
        if (typeof ms === 'object') {
            ms = Math.floor(Math.random() * (ms.max - ms.min + 1)) + ms.min;
        }
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Scroll to bottom to trigger lazy loading and handle infinite scroll
     */
    async autoScroll() {
        const waitTime = this.scrollWaitTime || 6000;
        await this.page.evaluate(async (maxWait) => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 250;
                let maxRetries = Math.max(1, Math.floor(maxWait / 400));
                let retries = 0;

                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight - 200) {
                        // Reached near the bottom
                        if (retries < maxRetries) {
                            retries++;
                        } else {
                            // Checked multiple times, no new content loaded
                            clearInterval(timer);
                            resolve();
                        }
                    } else {
                        // Reset retries if we are no longer at the bottom (new content loaded)
                        retries = 0;
                    }

                    // Attempt to click any common "Load More" buttons if they exist
                    try {
                        const btnSelectors = ['.load-more', '.btn-load-more', '.ajax-load-more', '.infinite-scroll-button', '.load_more'];
                        for (const sel of btnSelectors) {
                            const btns = document.querySelectorAll(sel);
                            for (const btn of btns) {
                                if (btn && btn.offsetParent !== null) {
                                    btn.click();
                                }
                            }
                        }
                        
                        // Also check buttons by text
                        const allBtns = document.querySelectorAll('button, a');
                        for (const btn of allBtns) {
                            if (btn.offsetParent !== null && btn.textContent) {
                                const text = btn.textContent.toLowerCase().trim();
                                if (text === 'load more' || text === 'muat lebih banyak' || text === 'show more') {
                                    btn.click();
                                }
                            }
                        }
                    } catch (e) {
                        // ignore errors from clicking
                    }
                }, 400); // 400ms tick for better rendering window
            });
        }, waitTime);
        await this.sleep(3000); // 3 seconds post-scroll stabilization delay
    }

    /**
     * Wait for at least one of the selectors to render on the page (Smart Delay)
     * @param {Array<string>} selectors - Array of CSS selectors to wait for
     * @param {number} timeout - Maximum timeout in ms
     */
    async waitForAnySelector(selectors, timeout = 12000) {
        console.log(`[BaseScraper] Waiting for dynamic items to render (selectors: ${selectors.join(', ')})...`);
        try {
            await this.page.evaluate(async (selectorsList, t) => {
                return new Promise((resolve) => {
                    const start = Date.now();
                    const check = () => {
                        for (const sel of selectorsList) {
                            if (document.querySelector(sel)) {
                                resolve(sel);
                                return;
                            }
                        }
                        if (Date.now() - start > t) {
                            resolve(null);
                        } else {
                            setTimeout(check, 200);
                        }
                    };
                    check();
                });
            }, selectors, timeout);
        } catch (e) {
            console.warn(`[BaseScraper] Dynamic wait warning: ${e.message}`);
        }
    }

    /**
     * Scrape method — MUST be overridden by child classes
     * @param {string} url - The URL to scrape
     * @returns {Promise<Array>} Array of product objects
     */
    async scrape(url) {
        throw new Error('scrape() must be implemented by child class');
    }

    /**
     * Get the source name — MUST be overridden
     */
    getSourceName() {
        throw new Error('getSourceName() must be implemented by child class');
    }

    /**
     * Get the base URL — MUST be overridden
     */
    getBaseUrl() {
        throw new Error('getBaseUrl() must be implemented by child class');
    }

    /**
     * Get the platform name — MUST be overridden
     */
    getPlatform() {
        return 'custom';
    }

    /** Strip HTML tags from description text. */
    _stripHtml(html, maxLen = 5000) {
        if (!html) return null;
        const text = String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (!text) return null;
        return text.length > maxLen ? text.substring(0, maxLen) : text;
    }

    _normalizeImageUrl(url, baseUrl) {
        if (!url) return null;
        let u = String(url).trim();
        if (!u || u.startsWith('data:')) return null;
        if (u.startsWith('//')) u = 'https:' + u;
        if (u.startsWith('/') && baseUrl) {
            try {
                u = new URL(u, baseUrl).href;
            } catch {
                return null;
            }
        }
        return u.split('?')[0];
    }

    _dedupeImages(urls, baseUrl) {
        const out = [];
        const seen = new Set();
        for (const raw of urls || []) {
            const u = this._normalizeImageUrl(raw, baseUrl);
            if (!u || seen.has(u)) continue;
            seen.add(u);
            out.push(u);
        }
        return out;
    }

    _applyDetailToProduct(product, detail) {
        if (!detail) return false;
        let changed = false;
        if (detail.images?.length) {
            product.images = detail.images;
            product.image_url = detail.images[0];
            changed = true;
        }
        if (detail.description && String(detail.description).trim()) {
            product.description = String(detail.description).trim();
            changed = true;
        }
        const detailPrice = Number(detail.price || 0);
        const currentPrice = Number(product.price_idr || product.price_original || 0);
        if (detailPrice > 0 && currentPrice <= 0) {
            product.price_idr = detailPrice;
            product.price_original = detailPrice;
            product.currency = product.currency || 'IDR';
            product.stock_status = 'available';
            changed = true;
        }
        if (detail.stock_status && product.stock_status !== detail.stock_status) {
            product.stock_status = detail.stock_status;
            changed = true;
        }
        return changed;
    }

    _hasMeaningfulDescription(product) {
        const d = String(product.description || '').trim();
        if (!d) return false;
        if (/^(condition|preloved condition):\s*/i.test(d) && d.length < 120) return false;
        return d.length > 20;
    }

    _needsDetailEnrichment(product) {
        if (!product?.product_url) return false;
        const imgCount = product.images?.length || (product.image_url ? 1 : 0);
        const price = Number(product.price_idr || product.price_original || 0);
        return imgCount <= 1 || !this._hasMeaningfulDescription(product) || price <= 0;
    }

    /**
     * Override in child scrapers to fetch gallery + description from PDP.
     * @returns {Promise<{images?: string[], description?: string}|null>}
     */
    async enrichFromDetailPage(product) {
        return null;
    }

    beginScrapeTimer() {
        this._scrapeStartTime = Date.now();
        this._timeLimitReached = false;
    }

    elapsedScrapeSeconds() {
        if (!this._scrapeStartTime) return 0;
        return Math.round((Date.now() - this._scrapeStartTime) / 1000);
    }

    isTimeLimitReached() {
        if (!this.maxDurationSeconds || !this._scrapeStartTime) return false;
        if (this._timeLimitReached) return true;
        if (this.elapsedScrapeSeconds() >= this.maxDurationSeconds) {
            this._timeLimitReached = true;
            return true;
        }
        return false;
    }

    /**
     * Visit each product detail page and merge images + description.
     */
    async enrichProducts(products) {
        if (this.options.skipDetail) {
            console.log(`[${this.getSourceName()}] Detail enrichment skipped (--skipDetail)`);
            return products;
        }

        const targets = products.filter((p) => this._needsDetailEnrichment(p));
        if (targets.length === 0) {
            console.log(`[${this.getSourceName()}] All products already have detail data.`);
            return products;
        }

        console.log(`[${this.getSourceName()}] Enriching ${targets.length}/${products.length} products from detail pages...`);

        const delayMs = this.options.detailDelay ?? 1000;
        let enriched = 0;
        let browserWasClosed = !this.browser;

        if (!this.browser) {
            await this.launchBrowser();
        }

        for (let i = 0; i < targets.length; i++) {
            if (this.isTimeLimitReached()) {
                console.log(
                    `[${this.getSourceName()}] ⏱️ Batas waktu ${this.maxDurationSeconds}s — stop enrichment (${enriched}/${targets.length} selesai)`
                );
                break;
            }

            const p = targets[i];
            try {
                const detail = await this.enrichFromDetailPage(p);
                if (this._applyDetailToProduct(p, detail)) enriched++;
            } catch (e) {
                console.warn(`[${this.getSourceName()}] Detail failed: ${p.product_url} — ${e.message}`);
            }
            if (i < targets.length - 1) await this.sleep(delayMs);
            if ((i + 1) % 25 === 0) {
                console.log(`[${this.getSourceName()}] Detail progress: ${i + 1}/${targets.length} (${enriched} enriched)`);
            }
        }

        const timeNote = this._timeLimitReached ? ' (batas waktu)' : '';
        console.log(`[${this.getSourceName()}] Detail enrichment done: ${enriched}/${targets.length} updated${timeNote}.`);

        if (browserWasClosed && this.browser) {
            await this.closeBrowser();
        }

        return products;
    }
}
