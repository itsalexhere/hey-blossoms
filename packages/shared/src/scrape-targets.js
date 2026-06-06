/**
 * Curated scrape jobs — VIP sources × brands only.
 * Run from Admin → Scraper.
 */

import { VIP_SOURCES, VIP_BRANDS } from './vip-config.js';

export { VIP_SOURCES as CURATED_SITES };

/** Urutan kategori ZZER dalam satu brand. */
const ZZER_CATEGORY_TAB_ORDER = ['Bags', 'Shoes', 'Clothing', 'Accessories', 'Jewelry'];

function brandSortIndex(brand) {
    const idx = VIP_BRANDS.indexOf(brand);
    return idx >= 0 ? idx : VIP_BRANDS.length;
}

function sortTargetsForAdmin(targets) {
    return [...targets].sort((a, b) => {
        const byBrand = brandSortIndex(a.brand) - brandSortIndex(b.brand);
        if (byBrand !== 0) return byBrand;

        const genderOrder = (g) => (g === 'men' ? 0 : g === 'women' ? 1 : 2);
        const byGender = genderOrder(a.gender) - genderOrder(b.gender);
        if (byGender !== 0) return byGender;

        if (a.categoryTab && b.categoryTab) {
            const ca = ZZER_CATEGORY_TAB_ORDER.indexOf(a.categoryTab);
            const cb = ZZER_CATEGORY_TAB_ORDER.indexOf(b.categoryTab);
            const ia = ca >= 0 ? ca : 99;
            const ib = cb >= 0 ? cb : 99;
            if (ia !== ib) return ia - ib;
        }

        return String(a.label).localeCompare(String(b.label));
    });
}

export const HUNTSTREET_TARGETS = [
    {
        id: 'hs_men_dior',
        site: 'HuntStreet',
        label: 'Men — Dior Homme (DIH)',
        url: 'https://www.huntstreet.com/shop/men?designer=DIH',
        gender: 'men',
        brand: 'Dior',
        maxPages: 30,
        partialScrape: true,
    },
    {
        id: 'hs_men_christian_dior',
        site: 'HuntStreet',
        label: 'Men — Christian Dior (DIO)',
        url: 'https://www.huntstreet.com/shop/men?designer=DIO',
        gender: 'men',
        brand: 'Dior',
        maxPages: 30,
        partialScrape: true,
    },
    {
        id: 'hs_men_loro_piana',
        site: 'HuntStreet',
        label: 'Men — Loro Piana',
        url: 'https://www.huntstreet.com/shop?designer=LOP&gender=men',
        gender: 'men',
        brand: 'Loro Piana',
        maxPages: 30,
        partialScrape: true,
    },
    {
        id: 'hs_men_lv',
        site: 'HuntStreet',
        label: 'Men — Louis Vuitton',
        url: 'https://www.huntstreet.com/shop/men?designer=LVU',
        gender: 'men',
        brand: 'Louis Vuitton',
        maxPages: 30,
        partialScrape: true,
    },
    // ── Women ──
    {
        id: 'hs_women_lv',
        site: 'HuntStreet',
        label: 'Women — Louis Vuitton',
        url: 'https://www.huntstreet.com/shop/women?designer=LVU',
        gender: 'women',
        brand: 'Louis Vuitton',
        maxPages: 17,
        partialScrape: true,
    },
    {
        id: 'hs_women_dior',
        site: 'HuntStreet',
        label: 'Women — Dior (DIO+DIH)',
        url: 'https://www.huntstreet.com/shop/women?designer=DIO,DIH',
        gender: 'women',
        brand: 'Dior',
        maxPages: 15,
        partialScrape: true,
    },
    {
        id: 'hs_women_loro_piana',
        site: 'HuntStreet',
        label: 'Women — Loro Piana',
        url: 'https://www.huntstreet.com/shop/women?designer=LOP',
        gender: 'women',
        brand: 'Loro Piana',
        maxPages: 1,
        partialScrape: true,
    },
];

export const ZETABAGS_TARGETS = [
    {
        id: 'zb_men_dior',
        label: 'Men — Dior',
        site: 'ZetaBags',
        url: 'https://zetabags.com/shop/?fill-gender=49&fill-brand=157',
        gender: 'men',
        brand: 'Dior',
        maxPages: 2,
        partialScrape: true,
    },
    {
        id: 'zb_men_lv',
        label: 'Men — Louis Vuitton',
        site: 'ZetaBags',
        url: 'https://zetabags.com/shop/?fill-gender=49&fill-brand=154',
        gender: 'men',
        brand: 'Louis Vuitton',
        maxPages: 4,
        partialScrape: true,
    },
    {
        id: 'zb_men_loro_piana',
        label: 'Men — Loro Piana',
        site: 'ZetaBags',
        url: 'https://zetabags.com/shop/?fill-gender=49&fill-brand=183',
        gender: 'men',
        brand: 'Loro Piana',
        maxPages: 1,
        partialScrape: true,
    },
    // ── Women ──
    {
        id: 'zb_women_lv',
        label: 'Women — Louis Vuitton',
        site: 'ZetaBags',
        url: 'https://zetabags.com/shop/?fill-gender=50&fill-brand=154',
        gender: 'women',
        brand: 'Louis Vuitton',
        maxPages: 34,
        partialScrape: true,
    },
    {
        id: 'zb_women_dior',
        label: 'Women — Dior',
        site: 'ZetaBags',
        url: 'https://zetabags.com/shop/?fill-gender=50&fill-brand=157',
        gender: 'women',
        brand: 'Dior',
        maxPages: 10,
        partialScrape: true,
    },
    {
        id: 'zb_women_loro_piana',
        label: 'Women — Loro Piana',
        site: 'ZetaBags',
        url: 'https://zetabags.com/shop/?fill-gender=50&fill-brand=183',
        gender: 'women',
        brand: 'Loro Piana',
        maxPages: 1,
        partialScrape: true,
    },
];

export const BANANANINA_TARGETS = [
    {
        id: 'bn_louis_vuitton',
        site: 'Banananina',
        label: 'Louis Vuitton (gender dari URL produk)',
        url: 'https://www.banananina.co.id/designer/louis-vuitton',
        gender: null,
        brand: 'Louis Vuitton',
        maxPages: 10,
        partialScrape: true,
    },
    {
        id: 'bn_dior',
        site: 'Banananina',
        label: 'Dior (gender dari URL produk)',
        url: 'https://www.banananina.co.id/designer/christian-dior',
        gender: null,
        brand: 'Dior',
        maxPages: 10,
        partialScrape: true,
    },
    {
        id: 'bn_loro_piana',
        site: 'Banananina',
        label: 'Loro Piana (gender dari URL produk)',
        url: 'https://www.banananina.co.id/designer/loro-piana',
        gender: null,
        brand: 'Loro Piana',
        maxPages: 2,
        partialScrape: true,
    },
];

const ZZER_BASE = 'https://www.zzer.com/';

/** Semua tab kategori yang di-loop dalam satu job per brand. */
export const ZZER_CATEGORY_JOBS = [
    { tab: 'Bags', hint: 'Bag', maxApiPages: 30 },
    { tab: 'Shoes', hint: 'Shoes', maxApiPages: 15 },
    { tab: 'Clothing', hint: 'Tops', maxApiPages: 20 },
    { tab: 'Accessories', hint: 'Jewelry/Accessories', maxApiPages: 10 },
    { tab: 'Jewelry', hint: 'Jewelry/Accessories', maxApiPages: 10 },
];

function buildZzerTargets() {
    return VIP_BRANDS.map((brand) => {
        const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        return {
            id: `zzer_${slug}`,
            site: 'ZZER',
            label: `${brand} — Semua Kategori`,
            url: ZZER_BASE,
            gender: null,
            brand,
            categoryJobs: ZZER_CATEGORY_JOBS,
            maxPages: 30,
            maxDurationSeconds: 3600,
            partialScrape: true,
        };
    });
}

export const ZZER_TARGETS = buildZzerTargets();

export const YOOGIS_TARGETS = [
    {
        id: 'yc_louis_vuitton',
        site: "Yoogi's Closet",
        label: 'Louis Vuitton (gender dari judul produk)',
        url: 'https://www.yoogiscloset.com/louis-vuitton',
        gender: null,
        brand: 'Louis Vuitton',
        maxPages: 14,
        partialScrape: true,
    },
];

export const ALL_SCRAPE_TARGETS = [
    ...HUNTSTREET_TARGETS,
    ...ZETABAGS_TARGETS,
    ...BANANANINA_TARGETS,
    ...YOOGIS_TARGETS,
    ...ZZER_TARGETS,
];

export function getTargetsForSite(siteName) {
    return sortTargetsForAdmin(ALL_SCRAPE_TARGETS.filter((t) => t.site === siteName));
}

export function getScrapeTargetById(id) {
    return ALL_SCRAPE_TARGETS.find((t) => t.id === id) || null;
}
