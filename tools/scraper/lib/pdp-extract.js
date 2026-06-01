/**
 * Shared product detail page extraction (runs inside page.evaluate).
 * Returns { images: string[], description: string|null }
 */
export function buildPdpExtractFn(platform = 'generic') {
    return (baseUrl, platformKey) => {
        const normalize = (raw) => {
            if (!raw) return null;
            let u = String(raw).trim();
            if (!u || u.startsWith('data:')) return null;
            if (u.startsWith('//')) u = 'https:' + u;
            if (u.startsWith('/') && baseUrl) {
                try {
                    u = new URL(u, baseUrl).href;
                } catch {
                    return null;
                }
            }
            return u.split('?')[0].replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
        };

        const toHuntstreetLarge = (raw) => {
            const u = normalize(raw);
            if (!u || !u.includes('img.huntstreet.com/uploads/product/images/')) return null;
            return u.replace(/\/(thumb|medium)\//, '/large/');
        };

        if (platformKey === 'huntstreet') {
            const images = [];
            const seen = new Set();
            const addHsImg = (raw) => {
                const u = toHuntstreetLarge(raw);
                if (!u || seen.has(u)) return;
                seen.add(u);
                images.push(u);
            };

            const galleryRoots = ['#flexslider', '#flexcarousel', '.flexThumbnailsBox', '.flexCarouselBox'];
            for (const root of galleryRoots) {
                document.querySelectorAll(`${root} img[src*="img.huntstreet.com/uploads/product/images"]`).forEach((img) => {
                    addHsImg(img.getAttribute('src') || img.getAttribute('data-src'));
                });
            }

            if (images.length === 0) {
                document.querySelectorAll('img[alt*="Product Preview Image"][src*="img.huntstreet.com"]').forEach((img) => {
                    addHsImg(img.getAttribute('src') || img.getAttribute('data-src'));
                });
            }

            const parts = [];
            const itemNo = document.body.innerText.match(/Item No:\s*(\S+)/i)?.[1];
            if (itemNo) parts.push(`Item No: ${itemNo}`);

            const notes = document.querySelector('.conditionNotes');
            if (notes) {
                const noteText = notes.innerText
                    .replace(/^information\s*/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (noteText.length > 10) parts.push(noteText);
            }

            const specs = document.querySelector('.productSpecs');
            if (specs) {
                const rows = [...specs.querySelectorAll('tr')]
                    .map((tr) => tr.innerText.replace(/\s+/g, ' ').trim())
                    .filter(Boolean);
                if (rows.length) {
                    parts.push(`Product Details:\n${rows.join('\n')}`);
                } else {
                    const specText = specs.innerText.replace(/\s+/g, ' ').trim();
                    if (specText.length > 5) parts.push(`Product Details: ${specText}`);
                }
                const disclaimer = specs.parentElement?.innerText
                    ?.replace(specs.innerText, '')
                    ?.replace(/\s+/g, ' ')
                    ?.trim();
                if (disclaimer && disclaimer.length > 40 && !parts.some((p) => p.includes(disclaimer.slice(0, 30)))) {
                    parts.push(disclaimer);
                }
            }

            return {
                images,
                description: parts.length ? parts.join('\n\n') : null,
            };
        }

        if (platformKey === 'banananina') {
            const images = [];
            const seen = new Set();
            const addBnImg = (raw) => {
                const u = normalize(raw);
                if (!u || !u.includes('inventory/assets/img/product/') || seen.has(u)) return;
                seen.add(u);
                images.push(u);
            };

            let price = 0;
            let stockStatus = null;

            for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
                try {
                    const data = JSON.parse(script.textContent);
                    if (data['@type'] !== 'Product') continue;
                    if (data.offers?.price) price = Number(data.offers.price) || price;
                    const avail = String(data.offers?.availability || '');
                    if (avail.includes('InStock')) stockStatus = 'available';
                    else if (avail.includes('OutOfStock')) stockStatus = 'sold_out';
                    for (const img of [].concat(data.image || [])) addBnImg(img);
                } catch { /* ignore */ }
            }

            if (images.length === 0) {
                document.querySelectorAll('img[src*="inventory/assets/img/product/"]').forEach((img) => {
                    addBnImg(img.getAttribute('src') || img.getAttribute('data-src'));
                });
            }

            const parts = [];
            const condMatch = document.body.innerText.match(/Preloved Condition:\s*([^\n]+)/i);
            if (condMatch) parts.push(`Preloved Condition: ${condMatch[1].trim()}`);

            const boxes = [...document.querySelectorAll('.box-gallery-description')];
            const box = boxes.find((el) => /PREVIOUSLY OWNED|DETAILS/i.test(el.innerText)) || boxes[boxes.length - 1];
            if (box) {
                const raw = box.innerText.trim();
                const introMatch = raw.match(/PREVIOUSLY OWNED\s*\n([\s\S]*?)(?=\nDETAILS\s*\n|$)/i);
                if (introMatch?.[1]?.trim()) {
                    parts.push(`PREVIOUSLY OWNED\n${introMatch[1].trim()}`);
                }
                for (const section of ['DETAILS', 'CONDITION', 'COMPLETENESS']) {
                    const re = new RegExp(
                        `${section}\\s*\\n([\\s\\S]*?)(?=\\n(?:DETAILS|CONDITION|COMPLETENESS)\\s*\\n|$)`,
                        'i'
                    );
                    const m = raw.match(re);
                    if (m?.[1]?.trim()) {
                        const label = section.charAt(0) + section.slice(1).toLowerCase();
                        parts.push(`${label}:\n${m[1].trim()}`);
                    }
                }
            }

            if (price <= 0) {
                const priceEl = document.querySelector('p.fs-16.mb-0.fw-400');
                const m = priceEl?.textContent?.match(/IDR\.?\s*([\d.,]+)/i);
                if (m) price = parseInt(m[1].replace(/\./g, '').replace(/,/g, ''), 10) || 0;
            }

            return {
                images,
                description: parts.length ? parts.join('\n\n') : null,
                price: price > 0 ? price : null,
                stock_status: stockStatus,
            };
        }

        if (platformKey === 'yoogiscloset') {
            const images = [];
            const seen = new Set();
            const addYcImg = (raw) => {
                const u = normalize(raw);
                if (!u || seen.has(u)) return;
                if (!u.includes('catalog/product')) return;
                seen.add(u);
                images.push(u);
            };

            for (const sel of [
                '.gallery-placeholder img',
                '.product-image-gallery img',
                '.fotorama__img',
                'img[src*="catalog/product"]',
                'img[data-src*="catalog/product"]',
            ]) {
                document.querySelectorAll(sel).forEach((img) => {
                    const raw =
                        img.getAttribute('data-large_image')
                        || img.getAttribute('data-zoom-image')
                        || img.getAttribute('data-src')
                        || img.getAttribute('src');
                    addYcImg(raw);
                });
            }

            const findTabPanel = (label) => {
                const btn = [...document.querySelectorAll('[role="tab"], .nav-link')].find(
                    (b) => b.textContent?.trim() === label
                );
                const panelId = btn?.getAttribute('aria-controls');
                return panelId ? document.getElementById(panelId) : null;
            };

            const parts = [];

            const notesPanel = findTabPanel("Yoogi's Notes");
            const notesText = notesPanel?.innerText?.trim();
            if (notesText && notesText.length > 20) {
                parts.push(`Yoogi's Notes:\n${notesText}`);
            }

            const detailsPanel = findTabPanel('Details');
            const detailsList = detailsPanel?.querySelector('.details-tab-content');
            if (detailsList) {
                const rows = [...detailsList.querySelectorAll('li')]
                    .map((li) => {
                        const label = li.querySelector('.font-weight-bold')?.textContent?.replace(/:\s*$/, '').trim();
                        const value = [...li.querySelectorAll('span:not(.font-weight-bold), a')]
                            .map((el) => el.textContent.trim())
                            .filter(Boolean)
                            .join(' ')
                            .trim();
                        if (label && value) return `${label}: ${value}`;
                        const text = li.innerText.replace(/\s+/g, ' ').trim();
                        return text.length > 3 ? text : null;
                    })
                    .filter(Boolean);
                if (rows.length) parts.push(`Details:\n${rows.join('\n')}`);
            } else if (detailsPanel?.innerText?.trim().length > 20) {
                parts.push(`Details:\n${detailsPanel.innerText.trim()}`);
            }

            const itemNo = document.body.innerText.match(/Item Number:\s*(\d+)/i)?.[1];
            if (itemNo && !parts.some((p) => p.includes(itemNo))) {
                parts.unshift(`Item Number: ${itemNo}`);
            }

            return {
                images,
                description: parts.length ? parts.join('\n\n') : null,
            };
        }

        const images = [];
        const seen = new Set();
        const addImg = (raw) => {
            const u = normalize(raw);
            if (!u || seen.has(u)) return;
            seen.add(u);
            images.push(u);
        };

        const isLikelyProductImage = (u) => {
            if (!u) return false;
            const lower = u.toLowerCase();
            if (lower.includes('/icons/') || lower.includes('/flags/') || lower.endsWith('.svg')) return false;
            if (lower.includes('logo') || lower.includes('avatar') || lower.includes('placeholder')) return false;
            return true;
        };

        const gallerySelectors = {
            woocommerce: [
                '.woocommerce-product-gallery img',
                '.woocommerce-product-gallery__image img',
                '.flex-control-nav img',
                '.product-images img',
            ],
            banananina: [
                '.woocommerce-product-gallery img',
                '.product-gallery img',
                '.swiper-slide img',
                'img.wp-post-image',
            ],
            yoogiscloset: [
                '.gallery-placeholder img',
                '.product-image-gallery img',
                '.fotorama__img',
                'img[src*="catalog/product"]',
                'img[data-src*="catalog/product"]',
            ],
            generic: [
                '.product-gallery img',
                '[class*="gallery"] img',
                '.swiper-slide img',
            ],
        };

        const selectors = [
            ...(gallerySelectors[platformKey] || []),
            ...(gallerySelectors.generic || []),
        ];

        for (const sel of selectors) {
            document.querySelectorAll(sel).forEach((img) => {
                const raw =
                    img.getAttribute('data-large_image')
                    || img.getAttribute('data-zoom-image')
                    || img.getAttribute('data-src')
                    || img.getAttribute('src');
                const u = normalize(raw);
                if (isLikelyProductImage(u)) addImg(u);
            });
        }

        const descSelectors = {
            woocommerce: [
                '.woocommerce-product-details__short-description',
                '#tab-description',
                '.woocommerce-Tabs-panel--description',
                '.product-description',
            ],
            banananina: [
                '.woocommerce-product-details__short-description',
                '#tab-description',
                '.product-description',
            ],
            yoogiscloset: [
                '.product-description',
                '.product.attribute.description',
                '#description',
                '[itemprop="description"]',
            ],
            generic: ['.product-description', '[itemprop="description"]', '#description'],
        };

        const descSels = [
            ...(descSelectors[platformKey] || []),
            ...(descSelectors.generic || []),
        ];

        let description = '';
        for (const sel of descSels) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim().length > 20) {
                description = el.textContent.replace(/\s+/g, ' ').trim();
                break;
            }
        }

        return {
            images,
            description: description || null,
        };
    };
}

export async function extractPdpFromPage(page, baseUrl, platform = 'generic') {
    const fn = buildPdpExtractFn(platform);
    return page.evaluate(fn, baseUrl, platform);
}
