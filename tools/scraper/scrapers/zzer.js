import { BaseScraper } from './base.js';
import {
    inferCategoryFromTitle,
    inferGenderFromZzerProduct,
    ZZER_CATEGORY_BY_ID,
    ZZER_CATEGORY_TABS,
} from '@luxe/shared/product-taxonomy';
import { normalizeVipBrand } from '@luxe/shared/vip-config';
import { ZZER_CATEGORY_JOBS } from '@luxe/shared/scrape-targets';

// ============================================================
// ZZER Scraper — iframe SPA + API intercept
// Satu sesi per brand: loop semua kategori (Bags → Shoes → …)
// ============================================================

const BASE_URL = 'https://www.zzer.com';
const ZZER_IMG_BASE = 'https://img.goshare2.com/';
const ZZER_PDP_BASE = 'https://mix.goshare2.com/wv/buy/product/detail/';
const ZZER_HOME_URL = 'https://mix.goshare2.com/wv/pc/index/';

const ZZER_BRAND_LABELS = {
    Dior: ['Dior', 'Christian Dior', '迪奥'],
    'Louis Vuitton': ['Louis Vuitton (LV)', 'Louis Vuitton', 'LV', '路易威登', '路易·威登'],
    'Loro Piana': ['Loro Piana', 'LoroPiana', '诺悠翩雅', '诺悠'],
};

const ZZER_SIDEBAR_CATEGORIES = ['Categories', 'Category', '分类', '类目'];

const ZZER_TAB_ZH = {
    Bags: '包袋',
    Clothing: '服装',
    Shoes: '鞋履',
    Accessories: '配饰',
    Jewelry: '珠宝',
};

function zzerClickBrandInPage(tabs) {
    const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const scoreLabel = (text, tab) => {
        if (!text || !tab) return 0;
        const lower = text.toLowerCase();
        const t = tab.toLowerCase();
        if (lower === t) return 100 + t.length;

        // Token pendek (LV, 诺悠) — harus exact / word-boundary, bukan substring acak
        if (t.length <= 3) {
            if (t === 'lv' && /\(lv\)/i.test(text)) return 95;
            if (new RegExp(`(^|[^a-z0-9])${escapeRe(t)}([^a-z0-9]|$)`, 'i').test(text)) {
                return 80 + t.length;
            }
            return 0;
        }

        if (lower.includes(t)) return 50 + t.length;
        if (lower.startsWith(t)) return 40 + t.length;
        return 0;
    };

    const allEls = [...document.querySelectorAll('div, span, a, li, button, img')];
    const scored = [];

    for (const el of allEls) {
        const text = normalize(el.innerText || el.alt || el.title || '');
        if (!text || text.length > 40) continue;

        let best = 0;
        for (const tab of tabs) {
            best = Math.max(best, scoreLabel(text, tab));
        }
        if (best > 0) scored.push({ el, text, score: best });
    }

    if (!scored.length) return { ok: false, reason: 'not_visible' };

    const sorted = scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ra = a.el.getBoundingClientRect();
        const rb = b.el.getBoundingClientRect();
        const inViewA = ra.top >= 0 && ra.top < window.innerHeight && ra.width > 0;
        const inViewB = rb.top >= 0 && rb.top < window.innerHeight && rb.width > 0;
        if (inViewA !== inViewB) return inViewB ? 1 : -1;
        return ra.width * ra.height - rb.width * rb.height;
    });

    const target = sorted[0].el;
    try {
        (target.closest('a, button, li, div') || target).click();
        return { ok: true, label: sorted[0].text };
    } catch (e) {
        return { ok: false, reason: e.message };
    }
}

export class ZzerScraper extends BaseScraper {
    getSourceName() { return 'ZZER'; }
    getBaseUrl() { return BASE_URL; }
    getPlatform() { return 'custom'; }

    constructor(options = {}) {
        super(options);
        this.language = options.language || 'en';
        this.langType = options.langType ?? 1;
        this.maxApiPages = options.maxApiPages ?? options.maxPages ?? 60;
        this.maxProducts = options.maxProducts > 0 ? Number(options.maxProducts) : null;
        this._ctx = null;
        this._frame = null;
    }

    _extractProductId(product) {
        const m = String(product?.product_url || '').match(/\/product\/(\d+)/);
        return m?.[1] || null;
    }

    _toImageUrl(path) {
        if (!path) return null;
        const raw = String(path).trim();
        if (!raw || raw.startsWith('data:')) return null;
        if (raw.startsWith('http')) return raw.replace(/@!.*$/, '').split('?')[0];
        return `${ZZER_IMG_BASE}${raw.replace(/^\/+/, '')}`.replace(/@!.*$/, '').split('?')[0];
    }

    _imagesFromDetail(detail) {
        const paths = [];
        if (Array.isArray(detail?.imageList) && detail.imageList.length) {
            paths.push(...detail.imageList);
        } else if (Array.isArray(detail?.imageListV1)) {
            for (const item of detail.imageListV1) {
                if (item?.type === 0 && item.url) paths.push(item.url);
            }
        }
        return this._dedupeImages(paths.map((p) => this._toImageUrl(p)).filter(Boolean), ZZER_IMG_BASE);
    }

    _descriptionFromDetail(detail) {
        if (!detail) return null;
        const parts = [];
        const condition = detail.degreeDesc || detail.degreeExtEn || detail.degreeExt || detail.degreeName;
        if (condition) parts.push(`Condition: ${condition}`);
        if (detail.sizeName || detail.sizeNameEn) {
            parts.push(`Size: ${[detail.sizeName, detail.sizeNameEn].filter(Boolean).join(' / ')}`);
        }
        if (detail.storeTextEn || detail.storeText || detail.storeProductPositionTextEn || detail.storeProductPositionText) {
            parts.push(`Location: ${detail.storeTextEn || detail.storeText || detail.storeProductPositionTextEn || detail.storeProductPositionText}`);
        }
        if (detail.firstCategoryName) parts.push(`Category: ${detail.firstCategoryName}`);
        if (Array.isArray(detail.flawInfo)) {
            const flaws = detail.flawInfo
                .filter((f) => f?.flawName && String(f.flawName).trim())
                .map((f) => `${f.positionName || 'Detail'}: ${f.flawName}`);
            if (flaws.length) parts.push(`Flaws:\n${flaws.join('\n')}`);
        }
        const text = parts.join('\n').trim();
        return text || null;
    }

    async _loadProductDetail(productId) {
        const frame = this._frame || await this.getContentFrame(this.page);
        const pdpUrl = `${ZZER_PDP_BASE}?id=${productId}&hideHeader=1`;

        const detailPromise = new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), 20000);
            const handler = async (response) => {
                const url = response.url();
                if (!url.includes('product/api/v1/product/detail?') || !url.includes(`id=${productId}`)) return;
                try {
                    const json = await response.json();
                    const detail = json?.data?.detail;
                    if (detail?.imageList?.length || detail?.imageListV1?.length) {
                        clearTimeout(timeout);
                        this.page.off('response', handler);
                        resolve(detail);
                    }
                } catch {
                    // response body may already be consumed
                }
            };
            this.page.on('response', handler);
        });

        await frame.goto(pdpUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
        await this.sleep(1500);
        return detailPromise;
    }

    async enrichFromDetailPage(product) {
        const productId = this._extractProductId(product);
        if (!productId) return null;

        const detail = await this._loadProductDetail(productId);
        if (!detail) return null;

        return {
            images: this._imagesFromDetail(detail),
            description: this._descriptionFromDetail(detail),
        };
    }

    _getCategoryJobs() {
        if (Array.isArray(this.options.categoryJobs) && this.options.categoryJobs.length > 0) {
            return this.options.categoryJobs;
        }
        if (this.options.categoryTab) {
            return [{
                tab: this.options.categoryTab,
                hint: this.options.categoryHint || ZZER_CATEGORY_TABS[this.options.categoryTab] || null,
                maxApiPages: this.maxApiPages,
            }];
        }
        return ZZER_CATEGORY_JOBS;
    }

    _tabLabelsFor(tab) {
        const zhTab = ZZER_TAB_ZH[tab];
        return this.language === 'zh' && zhTab ? [zhTab, tab] : [tab];
    }

    _resolveContext(categoryTab = null, categoryHint = null) {
        const tab = categoryTab || this.options.categoryTab || 'Bags';
        return {
            brand: this.options.brand || null,
            categoryTab: tab,
            categoryHint: categoryHint || this.options.categoryHint || ZZER_CATEGORY_TABS[tab] || null,
        };
    }

    _normalizeProduct(raw, ctx) {
        const title = raw.title || raw.productName || raw.name || raw.goodsName;
        if (!title) return null;

        const categoryId = raw.firstCategoryId;
        const category =
            inferCategoryFromTitle(title, ctx.categoryHint || '') ||
            ctx.categoryHint ||
            (categoryId ? ZZER_CATEGORY_BY_ID[categoryId] : null) ||
            raw.categoryName ||
            null;

        const apiBrand = normalizeVipBrand(raw.brandName || raw.brand);
        if (!apiBrand) return null;
        if (ctx.brand && apiBrand !== ctx.brand) return null;
        const brand = apiBrand;

        const gender = inferGenderFromZzerProduct(title, category || ctx.categoryHint || '', raw);
        const sellPrice = Number(raw.price || raw.sellPrice || 0);
        const marketPrice = Number(raw.marketPrice || raw.originalPrice || sellPrice || 0);

        return {
            title,
            brand,
            category,
            gender,
            price_original: marketPrice || sellPrice,
            currency: 'CNY',
            price_idr: marketPrice || sellPrice,
            stock_status: raw.stock > 0 || raw.status === 10 || raw.status === 1 ? 'available' : 'out_of_stock',
            stock_qty: raw.stock ?? null,
            image_url: raw.ico
                ? `https://img.goshare2.com/${raw.ico}`
                : (raw.image || raw.mainImage || raw.picUrl || ''),
            product_url: `https://www.zzer.com/product/${raw.id || raw.goodsId || raw.sku || ''}`,
        };
    }

    async getContentFrame(page, timeoutMs = 20000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const frame = page.frames().find((f) => f.url().includes('mix.goshare2.com'));
            if (frame) return frame;
            await this.sleep(500);
        }
        return page.mainFrame();
    }

    async waitForCategoryTabs(frame, labels, timeoutMs = 25000) {
        const deadline = Date.now() + timeoutMs;
        const labelList = Array.isArray(labels) ? labels : [labels];
        while (Date.now() < deadline) {
            const found = await frame.evaluate((tabs) => {
                const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
                return [...document.querySelectorAll('div, span, a, li, button')].some((el) => {
                    const text = normalize(el.innerText);
                    return tabs.some((tab) => text === tab);
                });
            }, labelList);
            if (found) return true;
            await this.sleep(600);
        }
        return false;
    }

    async handleLanguagePopup(frame) {
        const preferChinese = this.language === 'zh';
        const clicked = await frame.evaluate((wantZh) => {
            const candidates = [...document.querySelectorAll('button, a, div, span, p')]
                .filter((el) => {
                    const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
                    if (!text || text.length > 80) return false;
                    if (wantZh) {
                        return text.includes('切换中文') || text.includes('Switch to Chinese');
                    }
                    return text.includes('保持英文') || text.includes('Stay in English');
                });

            const sorted = candidates.sort((a, b) => {
                const areaA = a.getBoundingClientRect?.().width * a.getBoundingClientRect?.().height || 99999;
                const areaB = b.getBoundingClientRect?.().width * b.getBoundingClientRect?.().height || 99999;
                return areaA - areaB;
            });

            const target = sorted.find((el) => ['BUTTON', 'A'].includes(el.tagName)) || sorted[0];
            if (target) {
                try { target.click(); return true; } catch { /* ignore */ }
            }
            return false;
        }, preferChinese);

        if (clicked) {
            console.log(`   🌐 Bahasa: ${preferChinese ? '中文' : 'English'}`);
            await this.sleep(3000);
        }
    }

    async waitForFrameReady(frame, timeoutMs = 40000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const ready = await frame.evaluate((sidebarLabels) => {
                const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
                const texts = [...document.querySelectorAll('div, span, a, li, p, button')].map((el) => normalize(el.innerText));
                const hasSidebar = texts.some((t) => sidebarLabels.includes(t));
                const hasTopTab = texts.includes('Bags') || texts.includes('包袋') || texts.includes('Featured');
                return hasSidebar || hasTopTab;
            }, ZZER_SIDEBAR_CATEGORIES);
            if (ready) {
                await this.sleep(3000);
                return true;
            }
            await this.sleep(1000);
        }
        console.warn('   ⚠ Frame belum fully ready — lanjut dengan delay tambahan');
        await this.sleep(4000);
        return false;
    }

    async _goHome(frame) {
        await frame.goto(ZZER_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await this.waitForFrameReady(frame, 25000);
    }

    async clickSidebarCategories(frame) {
        const result = await frame.evaluate((labels) => {
            const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
            const area = (el) => {
                const r = el.getBoundingClientRect();
                return Math.max(1, r.width * r.height);
            };

            const exact = [...document.querySelectorAll('div, span, a, li, button, p')]
                .filter((el) => {
                    const text = normalize(el.innerText);
                    if (!labels.includes(text)) return false;
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.height > 0 && r.left < window.innerWidth * 0.45;
                })
                .sort((a, b) => area(a) - area(b));

            if (exact.length) {
                const leaf = exact[0];
                try {
                    (leaf.closest('a, button, li') || leaf).click();
                    return { ok: true, label: normalize(leaf.innerText), via: 'sidebar-exact' };
                } catch (e) {
                    return { ok: false, reason: e.message };
                }
            }

            return { ok: false, reason: 'not_found' };
        }, ZZER_SIDEBAR_CATEGORIES);

        if (result.ok) {
            console.log(`   📂 Categories diklik: "${result.label}"`);
            await this.sleep(4000);
            return true;
        }

        console.log('   ℹ Sidebar Categories tidak terlihat — lanjut ke tab kategori');
        return false;
    }

    async _clickExactLabel(frame, labels, stepName) {
        const result = await frame.evaluate((targets) => {
            const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
            const area = (el) => {
                const r = el.getBoundingClientRect();
                return Math.max(1, r.width * r.height);
            };

            const hits = [...document.querySelectorAll('div, span, a, li, button, img')]
                .filter((el) => {
                    const text = normalize(el.innerText);
                    const alt = normalize(el.alt || el.title || '');
                    return targets.some((t) => text === t || alt === t);
                })
                .sort((a, b) => area(a) - area(b));

            if (!hits.length) return { ok: false, reason: 'not_found' };

            const leaf = hits[0];
            try {
                (leaf.closest('a, button, li, div') || leaf).click();
                return { ok: true, label: normalize(leaf.innerText || leaf.alt || leaf.title || '') };
            } catch (e) {
                return { ok: false, reason: e.message };
            }
        }, labels);

        if (result.ok) {
            console.log(`   🏷️ ${stepName}: "${result.label}"`);
            await this.sleep(3500);
            return true;
        }
        console.log(`   ℹ ${stepName} tidak ketemu (${labels.join(' / ')})`);
        return false;
    }

    /**
     * Flow user: setelah kategori → klik "Brands" → klik "Brand" → scroll cari LP.
     */
    async openBrandPicker(frame) {
        const brandsLabels = ['Brands', 'Brand', '品牌', '热门品牌', 'Hot Brands'];
        const brandTabLabels = ['Brand', '品牌'];

        // 1) Buka section Brands (filter bar / hot brands)
        let opened = await this._clickExactLabel(frame, ['Brands', '品牌', 'Hot Brands', '热门品牌'], 'Brands dibuka');
        if (!opened) {
            opened = await frame.evaluate(() => {
                const icon = document.querySelector('img[src*="goods-filter-brand"], img[src*="goods-filter-icon"]');
                if (!icon) return false;
                (icon.closest('div, a, button') || icon).click();
                return true;
            });
            if (opened) {
                console.log('   🏷️ Brands dibuka (ikon filter)');
                await this.sleep(3500);
            }
        }

        // 2) Klik tab "Brand" (bukan "Brands") untuk buka daftar brand lengkap
        const tabResult = await frame.evaluate((targets) => {
            const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
            const area = (el) => {
                const r = el.getBoundingClientRect();
                return Math.max(1, r.width * r.height);
            };
            const exclude = new Set(['Brands', 'Hot Brands', '热门品牌', '品牌列表']);

            const hits = [...document.querySelectorAll('div, span, a, li, button')]
                .filter((el) => {
                    const text = normalize(el.innerText);
                    if (!text || exclude.has(text)) return false;
                    return targets.some((t) => text === t);
                })
                .sort((a, b) => area(a) - area(b));

            if (!hits.length) return { ok: false, reason: 'not_found' };

            const leaf = hits[0];
            try {
                (leaf.closest('a, button, li, div') || leaf).click();
                return { ok: true, label: normalize(leaf.innerText) };
            } catch (e) {
                return { ok: false, reason: e.message };
            }
        }, brandTabLabels);

        if (tabResult.ok) {
            console.log(`   🏷️ Tab Brand diklik: "${tabResult.label}"`);
            await this.sleep(3500);
        } else {
            console.log(`   ℹ Tab Brand diklik tidak ketemu (${brandTabLabels.join(' / ')})`);
        }
    }

    async _scrollVertical(frame, amount = 450) {
        await frame.evaluate((px) => {
            const scrollables = [...document.querySelectorAll('div, ul, section, main')].filter((el) => {
                const st = window.getComputedStyle(el);
                return (st.overflowY === 'auto' || st.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 40;
            });
            const panel = scrollables.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0];
            if (panel) panel.scrollBy({ top: px, behavior: 'auto' });
            else window.scrollBy({ top: px, behavior: 'auto' });
        }, amount);
    }

    async selectBrandInPanel(frame, brandName) {
        if (!brandName) return false;

        const labels = ZZER_BRAND_LABELS[brandName] || [brandName];
        const maxVertical = 50;

        console.log(`   🔍 Cari brand "${brandName}" (scroll bawah dulu)...`);
        for (let i = 0; i < maxVertical; i++) {
            if (this.isTimeLimitReached()) return false;
            const result = await frame.evaluate(zzerClickBrandInPage, labels);
            if (result.ok) {
                console.log(`   🏷️ Brand dipilih: "${result.label || brandName}" (vertical #${i})`);
                await this.sleep(3500);
                return true;
            }
            await this._scrollVertical(frame, 420);
            await this.sleep(700);
        }

        console.log('   ↪ Fallback: brand rail horizontal...');
        return this.scrollAndClickBrandRail(frame, brandName);
    }

    async scrollAndClickBrandRail(frame, brandName) {
        if (!brandName) return false;

        const labels = ZZER_BRAND_LABELS[brandName] || [brandName];
        const maxAttempts = 28;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const result = await frame.evaluate(zzerClickBrandInPage, labels);
            if (result.ok) {
                console.log(`   🏷️ Brand dipilih: "${result.label || brandName}" (rail #${attempt})`);
                await this.sleep(3000);
                return true;
            }

            await frame.evaluate(() => {
                const scrollers = [...document.querySelectorAll('div, ul, section')].filter((el) => {
                    const style = window.getComputedStyle(el);
                    return (
                        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
                        el.scrollWidth > el.clientWidth + 20
                    );
                });
                const rail =
                    scrollers.find((el) => el.clientHeight < 120 && el.scrollWidth > el.clientWidth) ||
                    scrollers[0];
                if (rail) rail.scrollBy({ left: 320, behavior: 'auto' });
                else window.scrollBy({ left: 240, behavior: 'auto' });
            });
            await this.sleep(600);
        }

        console.warn(`   ⚠ Brand "${brandName}" tidak ketemu (vertical + rail)`);
        return false;
    }

    async clickCategoryTab(frame, labels) {
        const labelList = Array.isArray(labels) ? labels : [labels];
        const result = await frame.evaluate((tabs) => {
            const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
            const candidates = [...document.querySelectorAll('div, span, a, li, button')]
                .filter((el) => {
                    const text = normalize(el.innerText);
                    if (!text || text.length > 24) return false;
                    return tabs.some((tab) => text === tab || text === tab.toLowerCase());
                });

            if (candidates.length === 0) {
                return { ok: false, reason: 'not_found', tried: tabs };
            }

            const sorted = candidates.sort((a, b) => {
                const ra = a.getBoundingClientRect();
                const rb = b.getBoundingClientRect();
                return ra.width * ra.height - rb.width * rb.height;
            });

            const target = sorted[0];
            try {
                target.click();
                return { ok: true, label: normalize(target.innerText), tag: target.tagName };
            } catch (e) {
                return { ok: false, reason: e.message };
            }
        }, labelList);

        if (result.ok) {
            console.log(`   👜 Kategori dipilih: "${result.label}" (${result.tag})`);
            await this.sleep(3500);
            return true;
        }

        console.warn(`   ⚠ Kategori tidak ketemu (${labelList.join(', ')}): ${result.reason || 'unknown'}`);
        return false;
    }

    _atProductLimit(count) {
        return this.maxProducts != null && count >= this.maxProducts;
    }

    _shouldStopCollecting(count) {
        return this._atProductLimit(count) || this.isTimeLimitReached();
    }

    _stopReason() {
        if (this.isTimeLimitReached()) {
            return `batas waktu ${this.maxDurationSeconds}s (${this.elapsedScrapeSeconds()}s berjalan)`;
        }
        if (this.maxProducts != null) return `batas ${this.maxProducts} produk`;
        return 'stop';
    }

    ingestListPayload(json, allProducts, seenIds, ctx) {
        const list = json?.data?.list;
        if (!Array.isArray(list)) return;

        const addRaw = (p) => {
            if (this._shouldStopCollecting(allProducts.length)) return;
            const normalized = this._normalizeProduct(p, ctx);
            if (!normalized || !normalized.brand) return;
            const key = String(p.id || p.sku || normalized.title);
            if (seenIds.has(key)) return;
            seenIds.add(key);
            allProducts.push(normalized);
        };

        const brandFilter = Boolean(ctx.brand);

        for (const item of list) {
            if (this._shouldStopCollecting(allProducts.length)) break;
            if (item.product) addRaw(item.product);
            if (brandFilter) continue;
            if (item.positionPut?.guessHotRank?.rankList) {
                for (const p of item.positionPut.guessHotRank.rankList) {
                    if (this._shouldStopCollecting(allProducts.length)) break;
                    addRaw(p);
                }
            }
            if (item.positionProductList?.products) {
                for (const p of item.positionProductList.products) {
                    if (this._shouldStopCollecting(allProducts.length)) break;
                    addRaw(p);
                }
            }
            if (item.id && (item.name || item.title)) addRaw(item);
        }
    }

    async paginateApi(frame, baseApiUrl, allProducts, seenIds, ctx) {
        const parsed = new URL(baseApiUrl);
        const limit = this.maxApiPages > 0 ? this.maxApiPages : 9999;
        let page = 2;
        let emptyStreak = 0;

        while (page <= limit) {
            if (this.isTimeLimitReached() || this._shouldStopCollecting(allProducts.length)) break;
            parsed.searchParams.set('page', String(page));
            let json;
            try {
                json = await frame.evaluate(async (u) => {
                    const res = await fetch(u, { credentials: 'include' });
                    if (!res.ok) return null;
                    return res.json();
                }, parsed.toString());
            } catch {
                emptyStreak++;
                if (emptyStreak >= 3) break;
                page++;
                continue;
            }

            if (!json?.data?.list || !Array.isArray(json.data.list)) break;

            const before = allProducts.length;
            this.ingestListPayload(json, allProducts, seenIds, ctx);
            const added = allProducts.length - before;

            if (added === 0) {
                emptyStreak++;
                if (emptyStreak >= 3) break;
            } else {
                emptyStreak = 0;
                process.stdout.write(`\r   📦 Hal ${page}/${limit} → total ${allProducts.length} produk`);
            }

            await this.sleep(350);
            page++;
        }
        if (page > 2) {
            console.log(`\n   ✅ Pagination kategori selesai (${allProducts.length} produk kumulatif)`);
        }
    }

    async scrollFeed(frame, passes, steps, allProducts) {
        for (let pageNum = 1; pageNum <= passes; pageNum++) {
            if (allProducts && this._shouldStopCollecting(allProducts.length)) break;
            for (let i = 0; i < steps; i++) {
                if (allProducts && this._shouldStopCollecting(allProducts.length)) break;
                await frame.evaluate(() => {
                    const cards = document.querySelectorAll(
                        '[class*="product"], [class*="goods"], [class*="item"], [class*="card"]'
                    );
                    if (cards.length > 0) {
                        cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }

                    const scrollables = [...document.querySelectorAll('div, main, section')].filter((e) => {
                        const style = window.getComputedStyle(e);
                        return (
                            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                            e.scrollHeight > e.clientHeight
                        );
                    });

                    if (scrollables.length > 0) {
                        scrollables.forEach((el) => el.scrollBy({ top: 800, behavior: 'smooth' }));
                    } else {
                        window.scrollBy({ top: 800, behavior: 'smooth' });
                    }
                });
                await this.sleep(1800);
            }
            console.log(`   📜 Scroll pass ${pageNum}/${passes}`);
            await this.sleep(2000);
        }
    }

    async _scrapeCategory(frame, catJob, allProducts, seenIds, sessionState) {
        const labels = this._tabLabelsFor(catJob.tab);
        this._ctx = this._resolveContext(catJob.tab, catJob.hint);

        console.log(`\n[ZZER] ── Kategori: ${catJob.tab} (hint: ${this._ctx.categoryHint}) ──`);

        sessionState.ingestEnabled = false;
        sessionState.lastListApiUrl = null;

        if (sessionState.categoryIndex > 0) {
            await this._goHome(frame);
        }

        await this.waitForFrameReady(frame);
        await this.clickSidebarCategories(frame);

        const catOk = await this.clickCategoryTab(frame, labels);
        if (!catOk) {
            throw new Error(`Kategori "${catJob.tab}" tidak bisa dipilih.`);
        }

        await this.sleep(2000);

        if (this._ctx.brand) {
            await this.openBrandPicker(frame);
            const brandOk = await this.selectBrandInPanel(frame, this._ctx.brand);
            if (!brandOk) {
                throw new Error(
                    `Brand "${this._ctx.brand}" tidak ketemu di panel brand ZZER.`
                );
            }
            sessionState.ingestEnabled = true;
            console.log(`   🔒 Ingest aktif — brandName harus = ${this._ctx.brand}`);
            await this.sleep(2500);
        } else {
            sessionState.ingestEnabled = true;
        }

        const savedMaxApi = this.maxApiPages;
        this.maxApiPages = catJob.maxApiPages ?? savedMaxApi;

        const testMode = this.maxProducts != null;
        const scrollSteps = testMode ? 3 : Math.max(8, Number(this.options?.scrollSteps || 10));
        const maxScrollPasses = testMode ? 1 : Math.max(3, Number(this.options?.maxScrollPasses || 8));
        if (testMode && allProducts.length === 0) {
            this.maxApiPages = 1;
        }

        console.log('   📜 Scroll feed...');
        await this.scrollFeed(frame, maxScrollPasses, scrollSteps, allProducts);

        if (sessionState.lastListApiUrl && !this._shouldStopCollecting(allProducts.length)) {
            console.log('   🔄 Paginasi API...');
            await this.paginateApi(frame, sessionState.lastListApiUrl, allProducts, seenIds, this._ctx);
        }

        this.maxApiPages = savedMaxApi;
        sessionState.categoryIndex = (sessionState.categoryIndex || 0) + 1;
        console.log(`   ✓ Kategori ${catJob.tab}: ${allProducts.length} produk kumulatif`);
    }

    async scrape(url) {
        const allProducts = [];
        const seenIds = new Set();
        const sessionState = { ingestEnabled: false, lastListApiUrl: null, categoryIndex: 0 };
        const categoryJobs = this._getCategoryJobs();
        const brand = this.options.brand || null;

        console.log(
            `[ZZER] Brand: ${brand || '-'} | ${categoryJobs.length} kategori: ${categoryJobs.map((c) => c.tab).join(' → ')}`
        );

        try {
            this.beginScrapeTimer();
            if (this.maxDurationSeconds) {
                const mins = Math.round(this.maxDurationSeconds / 60);
                console.log(`   ⏱️ Batas waktu: ${this.maxDurationSeconds}s (~${mins} menit)`);
            }

            await this.launchBrowser();
            const page = this.page;
            await page.setViewport({ width: 1366, height: 768 });

            page.on('response', async (response) => {
                if (!sessionState.ingestEnabled) return;
                const reqUrl = response.url();
                if (!reqUrl.includes('gwapi') && !reqUrl.includes('productList')) return;

                try {
                    let json = await response.json().catch(() => null);
                    if (!json) {
                        const text = await response.text().catch(() => '');
                        if (text.trim().startsWith('{')) json = JSON.parse(text);
                    }
                    if (!json?.data?.list) return;

                    if (reqUrl.includes('productList')) {
                        sessionState.lastListApiUrl = reqUrl;
                    }

                    this.ingestListPayload(json, allProducts, seenIds, this._ctx);
                } catch {
                    // non-JSON responses
                }
            });

            await this.navigateWithRetry(url, {
                waitUntil: 'networkidle2',
                waitAfter: 5000,
                maxRetries: this.maxRetries,
            });

            const frame = await this.getContentFrame(page);
            this._frame = frame;
            console.log(`   📦 Content frame: ${frame.url()}`);

            await this.sleep(4000);
            await this.handleLanguagePopup(frame);
            await this.waitForFrameReady(frame);

            const allTabLabels = categoryJobs.flatMap((c) => this._tabLabelsFor(c.tab));
            await this.waitForCategoryTabs(frame, [...new Set([...allTabLabels, ...ZZER_SIDEBAR_CATEGORIES])]);

            if (this.maxProducts != null) {
                console.log(`   🧪 Mode tes: max ${this.maxProducts} produk total`);
            }

            for (const catJob of categoryJobs) {
                if (this._shouldStopCollecting(allProducts.length)) {
                    console.log(`   ⏹ ${this._stopReason()} — stop loop kategori`);
                    break;
                }
                await this._scrapeCategory(frame, catJob, allProducts, seenIds, sessionState);
                if (this.isTimeLimitReached()) {
                    console.log(`   ⏹ ${this._stopReason()} — stop setelah kategori ${catJob.tab}`);
                    break;
                }
            }

            const capped = this.maxProducts != null
                ? allProducts.slice(0, this.maxProducts)
                : allProducts;
            const timeNote = this._timeLimitReached
                ? ` (dihentikan: batas waktu ${this.elapsedScrapeSeconds()}s)`
                : '';
            console.log(`\n[ZZER] Selesai: ${capped.length} produk VIP${timeNote}`);
            return await this.enrichProducts(capped);
        } catch (error) {
            console.error('[ZZER] Scraping error:', error);
            throw error;
        } finally {
            if (this.page) await this.page.close().catch(() => {});
            await this.closeBrowser();
        }
    }
}
