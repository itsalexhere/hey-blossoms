/**
 * Shared category / gender inference for scrapers and batch mapping scripts.
 * Categories resolve to VIP leaf slugs (see vip-config.js).
 */

import { VIP_LEAF_SLUGS, VIP_CATEGORIES } from './vip-config.js';

export const CATEGORY_KEYWORDS = [
    { keys: ['watch', 'watches', 'tambour', 'horlogerie', 'chronograph'], slug: 'jewelry-accessories' },
    { keys: ['wallet', 'card holder', 'cardholder', 'coin purse'], slug: 'wallet' },
    { keys: ['scarf', 'stole', 'shawl'], slug: 'scarf' },
    { keys: ['sunglass', 'eyewear'], slug: 'sunglasses' },
    { keys: ['belt'], slug: 'belt' },
    { keys: ['ring', 'necklace', 'bracelet', 'earring', 'jewel', 'brooch', 'cufflink'], slug: 'jewelry-accessories' },
    { keys: ['sneaker', 'shoe', 'heel', 'boot', 'loafer', 'oxford', 'sandal', 'mule', 'flat', 'slide', 'pump'], slug: 'shoes' },
    { keys: ['jacket', 'coat', 'blazer', 'outwear', 'outerwear', 'parka', 'windbreaker'], slug: 'outwear' },
    { keys: ['pant', 'trouser', 'skirt', 'jean', 'short', 'legging'], slug: 'bottoms' },
    { keys: ['shirt', 'top', 'blouse', 'tee', 't-shirt', 'polo', 'knit', 'sweater', 'cardigan', 'dress'], slug: 'tops' },
];

/** HuntStreet `designer` query param → canonical brand name in our DB. */
export const HUNTSTREET_DESIGNER_CODES = {
    DIH: 'Dior',
    DIO: 'Dior',
    LVU: 'Louis Vuitton',
    LOP: 'Loro Piana',
};

/** Path segment after /shop/{gender}/ → category hint (VIP leaf name). */
const HUNTSTREET_PATH_CATEGORIES = {
    bags: 'Bag',
    bag: 'Bag',
    shoes: 'Shoes',
    shoe: 'Shoes',
    accessories: 'Jewelry/Accessories',
    accessory: 'Jewelry/Accessories',
    clothing: 'Tops',
    apparel: 'Tops',
    wallets: 'Wallet',
    wallet: 'Wallet',
    beauty: 'Jewelry/Accessories',
    watches: 'Jewelry/Accessories',
    watch: 'Jewelry/Accessories',
};

export function slugify(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Match whole words/phrases — avoids "coat" in "coated", "ring" in "Springs", "top" in "Top Handle Bag". */
function matchesKeyword(hay, key) {
    const k = key.trim().toLowerCase();
    if (!k) return false;
    if (k.includes(' ')) return hay.includes(k);
    return new RegExp(`\\b${escapeRe(k)}\\b`, 'i').test(hay);
}

function matchesAny(hay, keys) {
    return keys.some((k) => matchesKeyword(hay, k));
}

/** Strong bag signals — checked before apparel/jewelry to prevent misclassification. */
const BAG_KEYWORDS = [
    'handbag',
    'backpack',
    'tote',
    'clutch',
    'satchel',
    'crossbody',
    'shoulder bag',
    'top handle',
    'bucket bag',
    'camera bag',
    'belt bag',
    'wallet on chain',
    'wallet bag',
    'trunk bag',
    'bowler bag',
    'hobo bag',
    'messenger bag',
    'neverfull',
    'speedy',
    'keepall',
    'pochette',
    'briefcase',
    'birkin',
    'kelly',
    'bag',
];

/**
 * Resolve a product to one VIP leaf category slug from title + optional hints.
 */
export function resolveProductCategorySlug(title, hint = '', rawCategory = '') {
    const hay = `${title} ${hint} ${rawCategory}`.toLowerCase();

    // 1. Bags first — luxury catalog is bag-heavy; blocks "top"/"coat"/"ring" false positives
    if (matchesAny(hay, BAG_KEYWORDS)) return 'bag';

    for (const rule of CATEGORY_KEYWORDS) {
        if (matchesAny(hay, rule.keys)) return rule.slug;
    }

    const rawSlug = slugify(rawCategory);
    if (rawSlug) {
        if (rawSlug.includes('watch') || matchesKeyword(hay, 'jewelry')) return 'jewelry-accessories';
        if (rawSlug.includes('wallet')) return 'wallet';
        if (rawSlug.includes('scarf')) return 'scarf';
        if (rawSlug.includes('sunglass')) return 'sunglasses';
        if (rawSlug.includes('belt')) return 'belt';
        if (rawSlug.includes('bag') || rawSlug.includes('handbag') || rawSlug.includes('tote') || rawSlug.includes('clutch') || rawSlug.includes('crossbody')) {
            return 'bag';
        }
        if (rawSlug.includes('shoe') || rawSlug.includes('sneaker') || rawSlug.includes('heel') || rawSlug.includes('boot') || rawSlug.includes('loafer')) {
            return 'shoes';
        }
        if (rawSlug.includes('outwear') || rawSlug.includes('outerwear') || matchesAny(hay, ['jacket', 'blazer', 'parka'])) {
            return 'outwear';
        }
        if (matchesAny(hay, ['coat']) && !/\bcoated\b/i.test(hay)) return 'outwear';
        if (rawSlug.includes('bottom') || rawSlug.includes('pant') || rawSlug.includes('skirt')) return 'bottoms';
        if (rawSlug.includes('top') || rawSlug.includes('shirt') || rawSlug.includes('blouse') || rawSlug.includes('dress')) return 'tops';
        if (VIP_LEAF_SLUGS.includes(rawSlug)) return rawSlug;
    }

    const hintSlug = slugify(hint);
    if (hintSlug && VIP_LEAF_SLUGS.includes(hintSlug)) return hintSlug;

    return null;
}

/** Canonical display name for scrapers (legacy compat). */
export function inferCategoryFromTitle(title, hint = '') {
    const slug = resolveProductCategorySlug(title, hint, hint);
    return slug ? VIP_CATEGORIES[slug] : null;
}

export function resolveHuntstreetBrand(designerParam) {
    if (!designerParam) return null;
    const codes = designerParam
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
    if (codes.length === 1) return HUNTSTREET_DESIGNER_CODES[codes[0]] || null;
    return null;
}

/** Banananina `/designer/{slug}` → canonical brand name in our DB. */
export const BANANANINA_DESIGNER_SLUGS = {
    'louis-vuitton': 'Louis Vuitton',
    'christian-dior': 'Dior',
    dior: 'Dior',
    'loro-piana': 'Loro Piana',
};

const BANANANINA_LISTING_CATEGORIES = {
    bags: 'Bag',
    shoes: 'Shoes',
    accessories: 'Jewelry/Accessories',
};

export function inferGenderFromBanananinaProduct(productUrl, catalogueCategory) {
    const cat = String(catalogueCategory || '').trim();
    if (/^men$/i.test(cat)) return 'men';

    if (!productUrl) return null;

    try {
        const path = new URL(productUrl).pathname.toLowerCase();
        if (/\/men(?:\/|$)/.test(path)) return 'men';
        if (/\/product\//.test(path)) return 'women';
    } catch {
        return null;
    }

    return null;
}

export function mapBanananinaListingCategory(itemCategory2) {
    const key = String(itemCategory2 || '').trim().toLowerCase();
    return BANANANINA_LISTING_CATEGORIES[key] || null;
}

export function parseBanananinaUrl(url) {
    const u = new URL(url);
    const m = u.pathname.match(/\/designer\/([^/?]+)/i);
    const slug = m?.[1]?.toLowerCase() || null;
    const brand = slug ? (BANANANINA_DESIGNER_SLUGS[slug] || null) : null;
    return { brand, designerSlug: slug };
}

export const YOOGIS_DESIGNER_SLUGS = {
    'louis-vuitton': 'Louis Vuitton',
    'christian-dior': 'Dior',
    dior: 'Dior',
    'loro-piana': 'Loro Piana',
};

export function inferGenderFromYoogisProduct(title, categoryHint = '') {
    const hay = `${title} ${categoryHint}`.toLowerCase();

    if (/\b(men'?s|mens|for men|homme)\b/.test(hay)) return 'men';
    if (/\b(women'?s|womens|for women|femme|ladies)\b/.test(hay)) return 'women';

    if (/\b(briefcase|tuxedo|cufflink|bow tie|dress shirt|necktie|suspenders)\b/.test(hay)) return 'men';

    if (/\b(dress|skirt|blouse|gown|minaudi[eè]re|minaudiere|pump|wedge|clutch|evening bag)\b/.test(hay)) {
        return 'women';
    }
    if (/\b(cardigan|sweater|top|heel|tote|handbag|crossbody|shoulder bag|satchel)\b/.test(hay)) {
        if (/\bsize\s+(xxs|xs|s|\d{1,2})\b/.test(hay)) return 'women';
    }

    const sizeMatch = hay.match(/\bsize\s+(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
    if (sizeMatch && /\b(sneaker|shoe|loafer|boot|sandal|mule|flat|heel|pump|slide)\b/.test(hay)) {
        const us = parseFloat(sizeMatch[1]);
        const eu = parseInt(sizeMatch[2], 10);
        if (us <= 6.5 || eu <= 38) return 'women';
        if (us >= 10 || eu >= 43) return 'men';
    }

    if (/men'?s accessories/i.test(categoryHint)) return 'men';

    return 'women';
}

export function parseYoogisUrl(url) {
    const u = new URL(url);
    const segment = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0]?.toLowerCase() || null;
    const reserved = new Set(['handbags', 'shoes', 'accessories', 'jewelry', 'clothing', 'sell', 'designers', 'authenticate', '']);
    if (!segment || reserved.has(segment)) return { brand: null, designerSlug: null };
    return {
        brand: YOOGIS_DESIGNER_SLUGS[segment] || null,
        designerSlug: segment,
    };
}

export function parseHuntstreetUrl(url) {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const segments = path.split('/').filter(Boolean);

    let gender = null;
    if (segments.includes('men')) gender = 'men';
    else if (segments.includes('women')) gender = 'women';

    const genderParam = (u.searchParams.get('gender') || '').toLowerCase();
    if (genderParam === 'men' || genderParam === 'women') gender = genderParam;

    const shopIdx = segments.indexOf('shop');
    let categoryHint = null;
    if (shopIdx >= 0) {
        for (let i = shopIdx + 2; i < segments.length; i++) {
            const seg = segments[i];
            if (seg !== 'men' && seg !== 'women' && HUNTSTREET_PATH_CATEGORIES[seg]) {
                categoryHint = HUNTSTREET_PATH_CATEGORIES[seg];
                break;
            }
        }
    }

    const designerCode = u.searchParams.get('designer') || '';
    const brand = resolveHuntstreetBrand(designerCode);

    return { gender, brand, categoryHint, designerCode: designerCode.toUpperCase() };
}
