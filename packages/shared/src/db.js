import { getSupabaseAdmin } from './supabase.js';
import { normalizeVipBrand, isVipSource } from './vip-config.js';
import { resolveProductCategorySlug } from './product-taxonomy.js';
import { buildCategorySlugLookup, ensureVipCategoryTree } from './category-seed.js';

// ============================================================
// Supabase-backed data layer.
// Function signatures are kept identical to the previous JSON
// engine so the scraper + API routes keep working unchanged.
//   - "sessions" map to the scrape_logs table
//   - products are upserted by source_url
//   - brand/category strings auto-map to master tables
// ============================================================

const CHUNK = 200;          // rows per upsert (POST body)
const URL_CHECK_CHUNK = 40;  // urls per existence SELECT (GET query string — keep small)

/** Retry a Supabase call on transient gateway errors (Cloudflare 520/503, network). */
async function withRetry(fn, label, attempts = 4) {
    let lastErr;
    for (let i = 1; i <= attempts; i++) {
        try {
            const res = await fn();
            const msg = res?.error?.message || '';
            if (res?.error && /520|503|502|504|web server|fetch failed|timeout/i.test(msg)) {
                throw new Error(msg);
            }
            return res;
        } catch (e) {
            lastErr = e;
            const wait = 500 * i * i; // 0.5s, 2s, 4.5s, 8s
            console.warn(`  ${label} attempt ${i}/${attempts} failed: ${String(e.message).slice(0, 80)} — retrying in ${wait}ms`);
            await new Promise((r) => setTimeout(r, wait));
        }
    }
    throw lastErr;
}

function slugify(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

// ============================================================
// SOURCES (no dedicated table — source is a plain string column)
// ============================================================

export async function getOrCreateSource(name, baseUrl, platform = null) {
    // Source identity is just its name; kept as an object for API compatibility.
    return { id: name, name, base_url: baseUrl, platform };
}

export async function getSourceByDomain(domain) {
    return null; // not needed with the string-based source model
}

// ============================================================
// SCRAPE SESSIONS  ->  scrape_logs table
// ============================================================

export async function createSession(sourceId, scrapeUrl) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('scrape_logs')
        .insert({
            source: sourceId,
            scrape_url: scrapeUrl,
            status: 'running',
            started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

    if (error) throw new Error(`createSession failed: ${error.message}`);
    return data.id;
}

export async function updateSession(
    sessionId,
    status,
    totalProducts = 0,
    totalErrors = 0,
    totalPages = 0,
    durationSeconds = 0,
    inserted = null,
    updated = null,
) {
    const supabase = getSupabaseAdmin();
    const patch = {
        status,
        total_products: totalProducts,
        errors: totalErrors,
        duration_seconds: durationSeconds,
        completed_at: new Date().toISOString(),
    };
    if (inserted != null) patch.inserted = inserted;
    if (updated != null) patch.updated = updated;

    const { error } = await supabase.from('scrape_logs').update(patch).eq('id', sessionId);
    if (error) console.error('updateSession failed:', error.message);
}

export async function getSessions(limit = 50) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('scrape_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`getSessions failed: ${error.message}`);

    return (data || []).map((s) => ({
        id: s.id,
        source_name: s.source,
        base_url: s.scrape_url,
        scrape_url: s.scrape_url,
        status: s.status,
        total_products: s.total_products,
        total_errors: s.errors,
        inserted: s.inserted,
        updated: s.updated,
        total_pages: 0,
        duration_seconds: s.duration_seconds,
        started_at: s.started_at,
        completed_at: s.completed_at,
    }));
}

// ============================================================
// BRAND / CATEGORY master resolution (batched, cached)
// ============================================================

async function buildLookup(table) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from(table).select('id, name');
    if (error) throw new Error(`load ${table} failed: ${error.message}`);
    const map = new Map();
    for (const row of data || []) map.set(row.name.toLowerCase(), row.id);
    return map;
}

async function ensureMasters(table, names, lookup, conflictCol = 'name') {
    const missing = [];
    const seenSlug = new Set();
    for (const name of names) {
        if (!name) continue;
        if (!lookup.has(name.toLowerCase())) missing.push(name);
    }
    if (missing.length === 0) return;

    const supabase = getSupabaseAdmin();
    // Dedupe by slug to avoid in-batch ON CONFLICT collisions on slug
    const rows = [];
    for (const name of missing) {
        const slug = slugify(name);
        if (conflictCol === 'slug') {
            if (seenSlug.has(slug)) continue;
            seenSlug.add(slug);
        }
        rows.push({ name, slug });
    }

    const { data, error } = await supabase
        .from(table)
        .upsert(rows, { onConflict: conflictCol, ignoreDuplicates: true })
        .select('id, name');
    if (error) throw new Error(`ensure ${table} failed: ${error.message}`);
    for (const row of data || []) lookup.set(row.name.toLowerCase(), row.id);

    // Re-read any that upsert skipped (ignoreDuplicates returns nothing for those)
    const stillMissing = missing.filter((n) => !lookup.has(n.toLowerCase()));
    if (stillMissing.length > 0) {
        const { data: existing } = await supabase
            .from(table)
            .select('id, name')
            .in('name', stillMissing);
        for (const row of existing || []) lookup.set(row.name.toLowerCase(), row.id);
    }
}

let _genderColumnCache = null;

export async function hasGenderColumn(supabase) {
    if (_genderColumnCache === true) return true;
    const { error } = await supabase.from('products').select('gender').limit(1);
    if (!error) _genderColumnCache = true;
    return !error;
}

/**
 * Upsert a batch of products into Supabase.
 * Returns { inserted, updated, priceChanges, errors }.
 */
export async function insertProducts(products, sourceId, sessionId) {
    const results = { inserted: 0, updated: 0, priceChanges: 0, errors: 0 };
    if (!products || products.length === 0) return results;
    if (!isVipSource(sourceId)) {
        console.warn(`insertProducts skipped: non-VIP source "${sourceId}"`);
        return results;
    }

    const supabase = getSupabaseAdmin();

    const eligible = products
        .filter((p) => p.product_url && p.title)
        .map((p) => {
            const canonicalBrand = normalizeVipBrand(p.brand);
            if (!canonicalBrand) return null;
            return { ...p, brand: canonicalBrand };
        })
        .filter(Boolean);

    if (eligible.length === 0) return results;

    // 1. Resolve brand + category master ids (batched)
    const brandLookup = await buildLookup('brands');
    const categoryLookup = await buildCategorySlugLookup();
    const brandNames = [...new Set(eligible.map((p) => p.brand).filter(Boolean))];
    await ensureMasters('brands', brandNames, brandLookup, 'name');
    await ensureVipCategoryTree(categoryLookup);

    const genderSupported = await hasGenderColumn(supabase);

    // 2. Determine which source_urls already exist
    const urls = eligible.map((p) => p.product_url).filter(Boolean);
    const existingByUrl = new Map();
    for (const part of chunk(urls, URL_CHECK_CHUNK)) {
        const { data, error } = await withRetry(
            () => supabase.from('products').select('id, source_url, original_price').in('source_url', part),
            'load existing products'
        );
        if (error) throw new Error(`load existing products failed: ${error.message}`);
        for (const row of data || []) existingByUrl.set(row.source_url, row);
    }

    // 3. Build product rows
    const now = new Date().toISOString();
    const rows = eligible.map((p) => {
            const priceIdr = Number(p.price_idr || 0);
            const catSlug = resolveProductCategorySlug(p.title, p.category || '', p.category || '');
            const row = {
                source: sourceId,
                source_url: p.product_url,
                title: p.title,
                brand_id: p.brand ? brandLookup.get(p.brand.toLowerCase()) ?? null : null,
                category_id: catSlug ? categoryLookup.get(catSlug) ?? null : null,
                original_price: priceIdr,
                currency: p.currency || 'IDR',
                original_amount: Number(p.price_original || 0) || null,
                stock_status: p.stock_status || 'available',
                stock_qty: p.stock_qty ?? null,
                description: p.description || null,
                scraped_at: now,
                updated_at: now,
            };
            if (genderSupported && p.gender) row.gender = p.gender;
            return row;
        });

    // 4. Count inserted vs updated + price changes
    for (const r of rows) {
        const existing = existingByUrl.get(r.source_url);
        if (existing) {
            results.updated++;
            if (Number(existing.original_price) !== r.original_price && r.original_price > 0) {
                results.priceChanges++;
            }
        } else {
            results.inserted++;
        }
    }

    // 5. Upsert products in chunks, collecting id<->source_url for images
    const idByUrl = new Map();
    for (const part of chunk(rows, CHUNK)) {
        const { data, error } = await withRetry(
            () => supabase.from('products').upsert(part, { onConflict: 'source_url' }).select('id, source_url'),
            'upsert products'
        );
        if (error) {
            results.errors += part.length;
            console.error('upsert products chunk failed:', error.message);
            continue;
        }
        for (const row of data || []) idByUrl.set(row.source_url, row.id);
    }

    // 6. Insert product images (one per product from image_url; dedupe via unique index)
    const imageRows = [];
    for (const p of products) {
        const pid = idByUrl.get(p.product_url);
        if (pid && p.image_url) {
            imageRows.push({ product_id: pid, image_url: p.image_url, position: 0 });
        }
    }
    for (const part of chunk(imageRows, CHUNK)) {
        const { error } = await withRetry(
            () => supabase.from('product_images').upsert(part, { onConflict: 'product_id,image_url', ignoreDuplicates: true }),
            'upsert product_images'
        );
        if (error) console.error('upsert product_images chunk failed:', error.message);
    }

    return results;
}

/**
 * Mark products of a source that were NOT seen in the latest scrape as out_of_stock.
 *
 * A full scrape sets scraped_at = runTs for every product still present on the
 * source. Any product of the same source whose scraped_at is older than runTs was
 * not found this run → it has been removed/sold from the source, so we flag it
 * out_of_stock (data is kept; it just disappears from the storefront).
 *
 * Safety guards (avoid wiping inventory when a scrape partially fails / anti-bot):
 *   - skip when fewer than MIN_SEEN products were scraped, or
 *   - skip when this run saw less than MIN_SEEN_RATIO of the source's currently
 *     available products.
 *
 * @returns {Promise<{marked:number, skipped:boolean, reason?:string}>}
 */
export async function markMissingSoldOut(sourceId, runTsIso, seenCount) {
    const MIN_SEEN = 5;          // a real full catalog has more than a handful
    const MIN_SEEN_RATIO = 0.3;  // saw <30% of what was available → suspicious

    const supabase = getSupabaseAdmin();

    if (!seenCount || seenCount < MIN_SEEN) {
        return { marked: 0, skipped: true, reason: `only ${seenCount || 0} products scraped (< ${MIN_SEEN}), skip sold-out sweep` };
    }

    // How many of this source are currently available (the pool at risk)?
    const { count: availableBefore, error: cErr } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('source', sourceId)
        .eq('stock_status', 'available');

    if (cErr) {
        console.error('markMissingSoldOut count failed:', cErr.message);
        return { marked: 0, skipped: true, reason: cErr.message };
    }

    if (availableBefore && seenCount < availableBefore * MIN_SEEN_RATIO) {
        return {
            marked: 0,
            skipped: true,
            reason: `scraped ${seenCount} but ${availableBefore} were available (< ${MIN_SEEN_RATIO * 100}%), likely partial scrape — skip sold-out sweep`,
        };
    }

    // Flag everything not refreshed in this run.
    const { data, error } = await withRetry(
        () =>
            supabase
                .from('products')
                .update({ stock_status: 'out_of_stock', stock_qty: 0, updated_at: new Date().toISOString() })
                .eq('source', sourceId)
                .eq('stock_status', 'available')
                .lt('scraped_at', runTsIso)
                .select('id'),
        'mark missing sold-out'
    );

    if (error) {
        console.error('markMissingSoldOut failed:', error.message);
        return { marked: 0, skipped: true, reason: error.message };
    }

    return { marked: data?.length || 0, skipped: false };
}

/**
 * Count products grouped by a column, paginating past Supabase's 1000-row
 * default cap. Returns a plain { value: count } map.
 */
export async function countProductsBy(column) {
    const supabase = getSupabaseAdmin();
    const counts = {};
    let from = 0;
    const PAGE = 1000;
    for (;;) {
        const { data, error } = await withRetry(
            () => supabase.from('products').select(column).range(from, from + PAGE - 1),
            `count by ${column}`
        );
        if (error) throw new Error(`countProductsBy(${column}) failed: ${error.message}`);
        for (const row of data || []) {
            const v = row[column];
            if (v != null) counts[v] = (counts[v] || 0) + 1;
        }
        if (!data || data.length < PAGE) break;
        from += PAGE;
    }
    return counts;
}

function normalizeTitle(t) {
    return String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Collapse duplicate listings so only ONE shows on the storefront.
 * The source sites sometimes list the same physical product multiple times under
 * different URLs. We KEEP every row (admin still sees full data) but set
 * is_active=false on all-but-one per (brand_id + normalized title) group.
 * Canonical pick: in-stock first, then cheapest price, then most recently scraped.
 *
 * @returns {Promise<{duplicateGroups:number, deactivated:number, activated:number}>}
 */
export async function dedupeActiveProducts() {
    const supabase = getSupabaseAdmin();

    let all = [];
    let from = 0;
    const PAGE = 1000;
    for (;;) {
        const { data, error } = await withRetry(
            () =>
                supabase
                    .from('products')
                    .select('id, brand_id, title, stock_status, original_price, scraped_at, is_active')
                    .range(from, from + PAGE - 1),
            'dedupe fetch'
        );
        if (error) throw new Error(`dedupeActiveProducts fetch failed: ${error.message}`);
        all = all.concat(data || []);
        if (!data || data.length < PAGE) break;
        from += PAGE;
    }

    const groups = new Map();
    for (const p of all) {
        const key = (p.brand_id ?? 'nb') + '||' + normalizeTitle(p.title);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(p);
    }

    const toActivate = [];
    const toDeactivate = [];
    let duplicateGroups = 0;

    for (const arr of groups.values()) {
        if (arr.length < 2) continue;
        duplicateGroups++;
        const sorted = [...arr].sort((a, b) => {
            const aAv = a.stock_status === 'available' ? 0 : 1;
            const bAv = b.stock_status === 'available' ? 0 : 1;
            if (aAv !== bAv) return aAv - bAv;
            const ap = Number(a.original_price) || Infinity;
            const bp = Number(b.original_price) || Infinity;
            if (ap !== bp) return ap - bp;
            return new Date(b.scraped_at || 0) - new Date(a.scraped_at || 0);
        });
        const canonical = sorted[0];
        if (!canonical.is_active) toActivate.push(canonical.id);
        for (const dup of sorted.slice(1)) {
            if (dup.is_active) toDeactivate.push(dup.id);
        }
    }

    let deactivated = 0;
    let activated = 0;
    for (const part of chunk(toDeactivate, 200)) {
        const { error } = await withRetry(
            () => supabase.from('products').update({ is_active: false }).in('id', part),
            'dedupe deactivate'
        );
        if (!error) deactivated += part.length;
    }
    for (const part of chunk(toActivate, 200)) {
        const { error } = await withRetry(
            () => supabase.from('products').update({ is_active: true }).in('id', part),
            'dedupe activate'
        );
        if (!error) activated += part.length;
    }

    return { duplicateGroups, deactivated, activated };
}

/** Single-product upsert kept for API compatibility. */
export async function upsertProduct(product, sourceId, sessionId) {
    const res = await insertProducts([product], sourceId, sessionId);
    return {
        id: null,
        isNew: res.inserted > 0,
        priceChanged: res.priceChanges > 0,
    };
}

/**
 * Query products for storefront/admin. Returns { products, total, limit, offset }.
 * Output rows are flattened to match the previous JSON shape.
 */
export async function getProducts({ source, brand, stockStatus, search, limit = 50, offset = 0 } = {}) {
    const supabase = getSupabaseAdmin();

    let query = supabase
        .from('products')
        .select(
            'id, source, source_url, title, original_price, currency, original_amount, stock_status, stock_qty, description, scraped_at, updated_at, brands(name), categories(name), product_images(image_url, position)',
            { count: 'exact' }
        );

    if (source) query = query.ilike('source', `%${source}%`);
    if (stockStatus) query = query.eq('stock_status', stockStatus);
    if (search) query = query.ilike('title', `%${search}%`);

    query = query.order('scraped_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`getProducts failed: ${error.message}`);

    let products = (data || []).map((p) => {
        const images = (p.product_images || []).sort((a, b) => a.position - b.position);
        return {
            id: p.id,
            source_name: p.source,
            title: p.title,
            brand: p.brands?.name || null,
            category: p.categories?.name || null,
            price_original: Number(p.original_amount || p.original_price || 0),
            currency: p.currency || 'IDR',
            price_idr: Number(p.original_price || 0),
            stock_status: p.stock_status,
            stock_qty: p.stock_qty,
            image_url: images[0]?.image_url || null,
            images: images.map((i) => i.image_url),
            product_url: p.source_url,
            description: p.description,
            scraped_at: p.scraped_at,
            updated_at: p.updated_at,
        };
    });

    // brand filter applied client-side (joined column can't be filtered inline easily)
    if (brand) {
        const b = brand.toLowerCase();
        products = products.filter((p) => (p.brand || '').toLowerCase().includes(b));
    }

    return { products, total: count ?? products.length, limit, offset };
}

// ============================================================
// ERROR LOGS — detailed errors stored in scrape_errors table.
// Aggregate counts also live in scrape_logs.errors.
// Insert is defensive: if the table is missing it degrades to console.
// ============================================================

export async function logError(sessionId, sourceId, url, errorType, errorMessage, retryCount = 0) {
    console.error(`[scrape error] ${errorType} @ ${url || sourceId}: ${errorMessage}`);
    try {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from('scrape_errors').insert({
            log_id: typeof sessionId === 'number' ? sessionId : null,
            source: sourceId != null ? String(sourceId) : null,
            url: url || null,
            error_type: errorType || 'unknown_error',
            message: (errorMessage || '').slice(0, 2000),
        });
        if (error) console.error('logError insert failed:', error.message);
    } catch (e) {
        console.error('logError exception:', e.message);
    }
    return null;
}

export async function getErrorLogs({ limit = 50, offset = 0, source = '', errorType = '' } = {}) {
    try {
        const supabase = getSupabaseAdmin();
        let q = supabase
            .from('scrape_errors')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (source) q = q.eq('source', source);
        if (errorType) q = q.eq('error_type', errorType);
        const { data, count, error } = await q;
        if (error) {
            console.error('getErrorLogs failed:', error.message);
            return { errors: [], total: 0, limit, offset };
        }
        return { errors: data || [], total: count ?? 0, limit, offset };
    } catch (e) {
        return { errors: [], total: 0, limit, offset };
    }
}

// ============================================================
// PRICE LOGS — not part of the spec; kept as no-ops.
// ============================================================

export async function logPriceChange() {
    /* no-op: price history not tracked in current schema */
}

// ============================================================
// SETTINGS helpers (used later by storefront + admin)
// ============================================================

export async function getSetting(key, fallback = null) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
    if (error) {
        console.error('getSetting failed:', error.message);
        return fallback;
    }
    return data?.value ?? fallback;
}

export async function setSetting(key, value) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
        .from('settings')
        .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(`setSetting failed: ${error.message}`);
}

// ============================================================
// LEGACY COMPATIBILITY
// ============================================================

export function getProductsLegacy() {
    return getProducts({ limit: 1000 }).then((r) => r.products);
}

export function getPool() {
    return { query: async () => [[]] };
}
