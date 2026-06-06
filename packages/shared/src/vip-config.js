/**
 * VIP catalog scope — only these sources and brands are kept in the app.
 */

export const VIP_SOURCES = ['HuntStreet', 'ZetaBags', 'Banananina', "Yoogi's Closet", 'ZZER'];

export const VIP_BRANDS = ['Louis Vuitton', 'Dior', 'Loro Piana'];

/** Scraper / legacy DB names → canonical VIP brand. */
export const VIP_BRAND_ALIASES = {
    'Christian Dior': 'Dior',
    'Louis Vuitton (LV)': 'Louis Vuitton',
    LV: 'Louis Vuitton',
};

export function normalizeVipBrand(name) {
    if (!name) return null;
    const trimmed = String(name).trim();
    if (VIP_BRAND_ALIASES[trimmed]) return VIP_BRAND_ALIASES[trimmed];
    if (VIP_BRANDS.includes(trimmed)) return trimmed;
    return null;
}

export function isVipSource(source) {
    return VIP_SOURCES.includes(source);
}

/**
 * Storefront category taxonomy (parent groups + leaf categories for products).
 * Products are always assigned to a leaf slug.
 */
export const VIP_CATEGORY_TREE = [
    {
        slug: 'apparel',
        name: 'Apparel',
        children: [
            { slug: 'tops', name: 'Tops' },
            { slug: 'bottoms', name: 'Bottoms' },
            { slug: 'outwear', name: 'Outwear' },
        ],
    },
    { slug: 'bag', name: 'Bag' },
    { slug: 'wallet', name: 'Wallet' },
    { slug: 'shoes', name: 'Shoes' },
    { slug: 'jewelry-accessories', name: 'Jewelry/Accessories' },
    {
        slug: 'fashion-goods',
        name: 'Fashion Goods',
        children: [
            { slug: 'scarf', name: 'Scarf' },
            { slug: 'sunglasses', name: 'Sunglasses' },
            { slug: 'belt', name: 'Belt' },
        ],
    },
];

function collectLeaves(nodes, out = []) {
    for (const node of nodes) {
        if (node.children?.length) collectLeaves(node.children, out);
        else out.push(node.slug);
    }
    return out;
}

/** Leaf slugs products may be assigned to (used by scraper + filters). */
export const VIP_LEAF_SLUGS = collectLeaves(VIP_CATEGORY_TREE);

/** @deprecated use VIP_LEAF_SLUGS */
export const VIP_CATEGORY_SLUGS = VIP_LEAF_SLUGS;

/** slug → display name (all nodes). */
export const VIP_CATEGORIES = {};
(function walk(nodes) {
    for (const node of nodes) {
        VIP_CATEGORIES[node.slug] = node.name;
        if (node.children) walk(node.children);
    }
})(VIP_CATEGORY_TREE);

/** Build storefront filter groups from DB rows that exist. */
export function buildStoreCategoryGroups(categoryRows) {
    const known = new Set((categoryRows || []).map((r) => r.slug));

    return VIP_CATEGORY_TREE.map((node) => {
        if (node.children?.length) {
            const options = node.children
                .filter((c) => known.has(c.slug))
                .map((c) => ({ slug: c.slug, name: c.name }));
            if (!options.length) return null;
            return { label: node.name, options };
        }
        if (!known.has(node.slug)) return null;
        return { label: node.name, options: [{ slug: node.slug, name: node.name }] };
    }).filter(Boolean);
}
