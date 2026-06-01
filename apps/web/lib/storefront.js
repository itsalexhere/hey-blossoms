import { getSupabaseAdmin } from '@luxe/shared/supabase';
import { computeSellingPrice, applyMarkup } from '@luxe/shared/pricing';
import { VIP_SOURCES, VIP_BRANDS, VIP_LEAF_SLUGS, buildStoreCategoryGroups } from '@luxe/shared/vip-config';

// ============================================================
// Storefront data layer (public-facing).
// Applies markup to original_price -> selling_price.
//   selling_price = round(original_price * (1 + markup_percent/100))
// Original (real) prices are NEVER exposed to the storefront.
// ============================================================

let _markupCache = { value: null, at: 0 };
let _genderColumnCache = null;

async function hasGenderColumn(supabase) {
    if (_genderColumnCache === true) return true;
    const { error } = await supabase.from('products').select('gender').limit(1);
    if (!error) _genderColumnCache = true;
    return !error;
}

const STORE_PRODUCT_SELECT =
    'id, title, source, description, stock_status, stock_qty, original_price, markup_addon_idr, scraped_at, brands(name), categories(id, name, slug), product_images(image_url, position)';

async function storeProductSelect(supabase) {
    if (await hasGenderColumn(supabase)) {
        return STORE_PRODUCT_SELECT.replace('source,', 'source, gender,');
    }
    return STORE_PRODUCT_SELECT;
}

export { applyMarkup, computeSellingPrice } from '@luxe/shared/pricing';

export async function getMarkupPercent() {
    // cache for 30s to avoid a settings read on every request
    if (_markupCache.value != null && Date.now() - _markupCache.at < 30000) {
        return _markupCache.value;
    }
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from('settings').select('value').eq('key', 'markup_percent').maybeSingle();
    const pct = Number(data?.value ?? 20) || 0;
    _markupCache = { value: pct, at: Date.now() };
    return pct;
}

function upgradeStoreImageUrl(url) {
    if (!url) return null;
    if (url.includes('img.huntstreet.com/uploads/product/images/')) {
        return url.replace(/\/(thumb|medium)\//, '/large/');
    }
    return url;
}

function mapStoreProduct(p, markup) {
    const images = (p.product_images || []).sort((a, b) => a.position - b.position);
    const imageUrls = images.map((i) => upgradeStoreImageUrl(i.image_url)).filter(Boolean);
    return {
        id: p.id,
        title: p.title,
        brand: p.brands?.name || null,
        category: p.categories?.name || null,
        category_slug: p.categories?.slug || null,
        gender: p.gender || null,
        selling_price: computeSellingPrice(p.original_price, markup, p.markup_addon_idr),
        stock_status: p.stock_status,
        stock_qty: p.stock_qty,
        image_url: imageUrls[0] || null,
        images: imageUrls,
        description: p.description || null,
        source: p.source,
        scraped_at: p.scraped_at,
    };
}

/** Selling-price presets for VIP filter UI (values in IDR). */
export const PRICE_BUCKETS = [
    { id: 'below_2m', label: 'Below IDR 2 juta', min: null, max: 2000000 },
    { id: '2_5m', label: 'IDR 2 juta – 5 juta', min: 2000000, max: 5000000 },
    { id: '5_20m', label: 'IDR 5 juta – 20 juta', min: 5000000, max: 20000000 },
    { id: '20_50m', label: 'IDR 20 juta – 50 juta', min: 20000000, max: 50000000 },
    { id: 'above_50m', label: 'Above IDR 50 juta', min: 50000000, max: null },
];

export function priceBucketToRange(bucketId) {
    const b = PRICE_BUCKETS.find((x) => x.id === bucketId);
    if (!b) return { min: null, max: null };
    return { min: b.min, max: b.max };
}

async function resolveCategoryIds(supabase, slug) {
    if (!slug) return null;
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', slug).maybeSingle();
    if (!cat) return null;
    const ids = [cat.id];
    const { data: children } = await supabase.from('categories').select('id').eq('parent_id', cat.id);
    for (const c of children || []) ids.push(c.id);
    return ids;
}

/**
 * Display-label overrides for the source tag shown on storefront cards.
 * Stored in settings.source_labels as a JSON map { originalSource: label }.
 * The real `source` value is never changed (scraper/dedup/sweep rely on it).
 */
export async function getSourceLabels() {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from('settings').select('value').eq('key', 'source_labels').maybeSingle();
    if (!data?.value) return {};
    try {
        const map = JSON.parse(data.value);
        return map && typeof map === 'object' ? map : {};
    } catch {
        return {};
    }
}

/** Public storefront branding (store name shown as logo + optional logo image URL). */
export async function getStoreBranding() {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from('settings').select('key, value').in('key', ['store_name', 'store_logo_url']);
    const map = {};
    (data || []).forEach((r) => (map[r.key] = r.value));
    return {
        store_name: map.store_name || 'LUXE',
        store_logo_url: map.store_logo_url || '',
    };
}

/** WhatsApp contact for floating button. */
export async function getWhatsAppSettings() {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['whatsapp_number', 'whatsapp_message']);
    const map = {};
    (data || []).forEach((r) => (map[r.key] = r.value));
    return {
        whatsapp_number: (map.whatsapp_number || '').replace(/\D/g, ''),
        whatsapp_message: map.whatsapp_message || 'Halo, saya tertarik dengan produk di toko Anda.',
    };
}

/**
 * Fetch products for the storefront with markup applied.
 * Real prices are stripped from the output.
 */
export async function getStoreProducts({
    category,
    brand,
    source,
    gender,
    ids,
    minPrice,
    maxPrice,
    sort = 'newest',
    search,
    limit = 24,
    offset = 0,
} = {}) {
    const supabase = getSupabaseAdmin();
    const markup = await getMarkupPercent();

    let brandId = null;
    let categoryIds = null;
    if (brand) {
        const { data: br } = await supabase.from('brands').select('id').ilike('name', brand).maybeSingle();
        if (!br) return { products: [], total: 0, markup, limit, offset };
        brandId = br.id;
    }
    if (category) {
        categoryIds = await resolveCategoryIds(supabase, category);
        if (!categoryIds?.length) return { products: [], total: 0, markup, limit, offset };
    }

    const idList = ids
        ? String(ids)
              .split(',')
              .map((x) => Number(x.trim()))
              .filter(Boolean)
        : null;

    let query = supabase
        .from('products')
        .select(await storeProductSelect(supabase), { count: 'exact' })
        .eq('is_active', true)
        .eq('stock_status', 'available')
        .in('source', VIP_SOURCES);

    if (idList?.length) query = query.in('id', idList);
    if (categoryIds?.length) query = query.in('category_id', categoryIds);
    if (brandId != null) query = query.eq('brand_id', brandId);
    if (source) query = query.eq('source', source);
    if (gender && (await hasGenderColumn(supabase))) query = query.eq('gender', gender);
    if (search) query = query.ilike('title', `%${search}%`);

    const factor = 1 + markup / 100;
    if (minPrice != null && minPrice !== '') query = query.gte('original_price', Number(minPrice) / factor);
    if (maxPrice != null && maxPrice !== '') query = query.lte('original_price', Number(maxPrice) / factor);

    if (sort === 'cheapest') query = query.order('original_price', { ascending: true });
    else if (sort === 'expensive') query = query.order('original_price', { ascending: false });
    else if (sort === 'title_asc') query = query.order('title', { ascending: true });
    else query = query.order('scraped_at', { ascending: false });

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`getStoreProducts failed: ${error.message}`);

    const products = (data || []).map((p) => mapStoreProduct(p, markup));

    return { products, total: count ?? products.length, markup, limit, offset };
}

/** Single product detail (storefront, markup applied). */
export async function getStoreProduct(id) {
    const supabase = getSupabaseAdmin();
    const markup = await getMarkupPercent();

    const { data, error } = await supabase
        .from('products')
        .select(
            'id, title, source, source_url, description, stock_status, stock_qty, original_price, markup_addon_idr, scraped_at, brands(name), categories(name, slug), product_images(image_url, position)'
        )
        .eq('id', id)
        .maybeSingle();

    if (error) throw new Error(`getStoreProduct failed: ${error.message}`);
    if (!data) return null;

    const images = (data.product_images || []).sort((a, b) => a.position - b.position);
    const imageUrls = images.map((i) => upgradeStoreImageUrl(i.image_url)).filter(Boolean);
    return {
        id: data.id,
        title: data.title,
        brand: data.brands?.name || null,
        category: data.categories?.name || null,
        category_slug: data.categories?.slug || null,
        description: data.description,
        selling_price: computeSellingPrice(data.original_price, markup, data.markup_addon_idr),
        stock_status: data.stock_status,
        stock_qty: data.stock_qty,
        images: imageUrls,
        image_url: imageUrls[0] || null,
        source: data.source,
    };
}

/** Categories grouped for storefront filter dropdown (VIP hierarchy). */
export async function getStoreCategoryGroups() {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, parent_id')
        .in('slug', [...VIP_LEAF_SLUGS, 'apparel', 'fashion-goods'])
        .order('name');
    if (error) throw new Error(`getStoreCategoryGroups failed: ${error.message}`);
    return buildStoreCategoryGroups(data || []);
}

/** Flat leaf categories (legacy compat). */
export async function getStoreCategories() {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug')
        .in('slug', VIP_LEAF_SLUGS)
        .order('name');
    if (error) throw new Error(`getStoreCategories failed: ${error.message}`);
    return data || [];
}

/** Distinct brands for the storefront brand filter (VIP only). */
export async function getStoreBrands() {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('brands').select('id, name').order('name');
    if (error) throw new Error(`getStoreBrands failed: ${error.message}`);
    return (data || []).filter((b) => VIP_BRANDS.includes(b.name));
}

/** VIP source names for storefront filters. */
export function getStoreSources() {
    return [...VIP_SOURCES];
}
