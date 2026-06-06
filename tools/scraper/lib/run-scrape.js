import {
    getScraperForUrl,
    isValidUrl,
    isSupportedUrl,
    getSourceInfoFromUrl,
} from './router.js';
import { isVipSource } from '@luxe/shared/vip-config';
import { toIDR } from '@luxe/shared/currency';
import {
    getOrCreateSource,
    createSession,
    updateSession,
    insertProducts,
    markMissingSoldOut,
    dedupeActiveProducts,
    logError,
} from '@luxe/shared/db';

/**
 * Run a full scrape session (listing + detail enrichment + DB save).
 * Used by CLI and admin API (local dev only).
 */
export async function runScrape({
    url,
    headless = true,
    maxPages,
    gender,
    brand,
    categoryHint,
    categoryTab,
    categoryJobs,
    maxApiPages,
    maxProducts,
    maxDurationSeconds,
    partialScrape = false,
    skipDetail = false,
}) {
    const startTime = Date.now();
    let sessionId = null;
    let sourceId = null;

    if (!url) {
        return { success: false, error_type: 'INVALID_URL', message: 'URL wajib diisi.' };
    }
    if (!isValidUrl(url)) {
        return { success: false, error_type: 'INVALID_URL', message: `URL tidak valid: ${url}` };
    }
    if (!isSupportedUrl(url)) {
        return { success: false, error_type: 'UNSUPPORTED_SITE', message: 'Website tidak didukung.' };
    }

    const sourceInfo = getSourceInfoFromUrl(url);
    if (!isVipSource(sourceInfo.name)) {
        return { success: false, error_type: 'UNSUPPORTED_SITE', message: `Sumber "${sourceInfo.name}" bukan VIP catalog.` };
    }

    const source = await getOrCreateSource(sourceInfo.name, sourceInfo.baseUrl, sourceInfo.platform);
    sourceId = source.id;
    sessionId = await createSession(sourceId, url);

    const scraperOptions = { headless, skipDetail };
    if (maxPages) scraperOptions.maxPages = Number(maxPages);
    if (gender) scraperOptions.gender = gender;
    if (brand) scraperOptions.brand = brand;
    if (categoryHint) scraperOptions.categoryHint = categoryHint;
    if (categoryTab) scraperOptions.categoryTab = categoryTab;
    if (categoryJobs) scraperOptions.categoryJobs = categoryJobs;
    if (maxApiPages) scraperOptions.maxApiPages = Number(maxApiPages);
    if (maxProducts) scraperOptions.maxProducts = Number(maxProducts);
    if (maxDurationSeconds) scraperOptions.maxDurationSeconds = Number(maxDurationSeconds);

    const scraper = getScraperForUrl(url, scraperOptions);
    let products = [];

    try {
        products = await scraper.scrape(url);
    } catch (scrapeError) {
        const errorType = scraper.classifyError ? scraper.classifyError(scrapeError) : 'unknown_error';
        await logError(sessionId, sourceId, url, errorType, scrapeError.message);
        const duration = Math.round((Date.now() - startTime) / 1000);
        await updateSession(sessionId, 'failed', 0, 1, 0, duration);
        return {
            success: false,
            error_type: errorType.toUpperCase(),
            message: scrapeError.message,
            session_id: sessionId,
        };
    }

    let totalErrors = 0;
    const validProducts = [];

    for (const product of products) {
        if (!product.title || product.title === 'Unknown') {
            totalErrors++;
            await logError(sessionId, sourceId, product.product_url || url, 'validation_error', 'Product has no title');
            continue;
        }
        if (!product.product_url) product.product_url = url;
        validProducts.push(product);
    }

    for (const p of validProducts) {
        const cur = String(p.currency || 'IDR').toUpperCase();
        if (cur !== 'IDR' && Number(p.price_idr || 0) === Number(p.price_original || 0) && Number(p.price_original || 0) > 0) {
            try {
                p.price_idr = await toIDR(p.price_original, cur);
            } catch { /* keep original */ }
        }
    }

    const dbResult = await insertProducts(validProducts, sourceId, sessionId);

    let soldOutResult = { marked: 0, skipped: true };
    try {
        if (partialScrape) {
            soldOutResult = { marked: 0, skipped: true, reason: 'partial scrape — sold-out sweep disabled' };
        } else {
            soldOutResult = await markMissingSoldOut(sourceId, new Date(startTime).toISOString(), validProducts.length);
        }
    } catch { /* non-fatal */ }

    let dedupeResult = { duplicateGroups: 0, deactivated: 0, activated: 0 };
    try {
        dedupeResult = await dedupeActiveProducts();
    } catch { /* non-fatal */ }

    const duration = Math.round((Date.now() - startTime) / 1000);
    totalErrors += dbResult.errors;

    await updateSession(
        sessionId,
        'completed',
        validProducts.length,
        totalErrors,
        0,
        duration,
        dbResult.inserted,
        dbResult.updated
    );

    const withGallery = validProducts.filter((p) => (p.images?.length || 0) > 1).length;
    const withDesc = validProducts.filter((p) => p.description && String(p.description).trim()).length;

    return {
        success: true,
        session_id: sessionId,
        source: sourceInfo.name,
        url,
        total_products: validProducts.length,
        total_errors: totalErrors,
        duration_seconds: duration,
        time_limit_reached: !!scraper._timeLimitReached,
        max_duration_seconds: maxDurationSeconds ? Number(maxDurationSeconds) : null,
        detail_stats: {
            multi_photo: withGallery,
            with_description: withDesc,
            skip_detail: skipDetail,
        },
        db_result: {
            inserted: dbResult.inserted,
            updated: dbResult.updated,
            price_changes: dbResult.priceChanges,
            sold_out: soldOutResult.marked,
            sold_out_skipped: soldOutResult.skipped ? (soldOutResult.reason || true) : false,
            duplicates_hidden: dedupeResult.deactivated,
        },
    };
}
